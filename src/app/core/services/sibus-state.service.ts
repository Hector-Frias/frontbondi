import { Injectable, computed, inject, signal } from '@angular/core';
import { SibusApiService } from './sibus-api.service';
import { Linea, Parada, RecorridoDetalle, RecorridoVisible, SentidoRecorrido } from '../models';
import { varianteColor } from '../utils/color';

const COLOR_TRAZA_POR_DEFECTO = '#0284c7';
const GIRO_COLOR_SECUNDARIO = 150;

@Injectable({ providedIn: 'root' })
export class SibusStateService {
  private api = inject(SibusApiService);

  // Signals de Estado Primario
  readonly lineas = signal<Linea[]>([]);
  readonly lineaSeleccionada = signal<Linea | null>(null);
  readonly sentidoActivo = signal<SentidoRecorrido>('IDA');
  readonly recorridoActual = signal<RecorridoDetalle | null>(null);
  readonly paradaEnfocada = signal<Parada | null>(null);
  readonly cargando = signal<boolean>(false);
  readonly filtroTexto = signal<string>('');

  /** Parada abierta en el editor de punto de control (banderas aparte). */
  readonly paradaEnEdicion = signal<{
    lineaId: number;
    recorridoId: number;
    paradaId: number;
  } | null>(null);

  /** Recorridos (IDA y VUELTA) de la línea activa: sirve para listar sus puntos de control. */
  readonly recorridosLinea = signal<RecorridoDetalle[]>([]);

  /** Muestra IDA y VUELTA en simultáneo (el activo toma el color de la línea). */
  readonly mostrarAmbosSentidos = signal<boolean>(false);
  /** Recorrido del sentido contrario, se carga solo si ambos sentidos están visibles. */
  readonly recorridoContrario = signal<RecorridoDetalle | null>(null);

  // Signals Computados
  readonly paradasFiltradas = computed(() => {
    const recorrido = this.recorridoActual();
    const query = this.filtroTexto().trim().toLowerCase();
    if (!recorrido) return [];
    if (!query) return recorrido.paradas;
    return recorrido.paradas.filter(
      (p) =>
        p.nombreCalle.toLowerCase().includes(query) ||
        (p.codigoParada && p.codigoParada.toLowerCase().includes(query)),
    );
  });

  readonly cabeceras = computed(() => {
    const rec = this.recorridoActual();
    if (!rec) return { origen: '', destino: '' };
    return { origen: rec.origen, destino: rec.destino };
  });

  /** Recorridos a dibujar en el mapa, cada uno con su color. */
  readonly recorridosVisibles = computed<RecorridoVisible[]>(() => {
    const actual = this.recorridoActual();
    if (!actual) return [];

    const colorLinea = this.lineaSeleccionada()?.colorHex ?? COLOR_TRAZA_POR_DEFECTO;
    const visibles: RecorridoVisible[] = [
      { recorrido: actual, colorHex: colorLinea, secundario: false },
    ];

    if (this.mostrarAmbosSentidos()) {
      const contrario = this.recorridoContrario();
      if (contrario) {
        visibles.push({
          recorrido: contrario,
          colorHex: varianteColor(colorLinea, GIRO_COLOR_SECUNDARIO),
          secundario: true,
        });
      }
    }

    return visibles;
  });

  constructor() {
    this.cargarLineas();
  }

  // Métodos de Mutación de Estado
  seleccionarLinea(linea: Linea): void {
    this.lineaSeleccionada.set(linea);
    this.cargarRecorrido();
  }

  /**
   * Selecciona la línea y el sentido en una sola operación.
   * Evita la doble carga que produciría llamar a `seleccionarLinea` y luego
   * `cambiarSentido` (el buscador de ubicaciones lo necesita así).
   *
   * `paradaEnfocar` se enfoca cuando termina de cargar el recorrido: si se
   * enfocara antes, la carga lo borraría.
   */
  seleccionarLineaConSentido(
    linea: Linea,
    sentido: SentidoRecorrido,
    paradaEnfocar?: Parada,
  ): void {
    this.mostrarAmbosSentidos.set(false);
    this.lineaSeleccionada.set(linea);
    this.sentidoActivo.set(sentido);
    this.cargarRecorrido(paradaEnfocar);
  }

  cambiarSentido(sentido: SentidoRecorrido): void {
    if (this.sentidoActivo() === sentido && !this.mostrarAmbosSentidos()) return;
    this.mostrarAmbosSentidos.set(false);
    this.sentidoActivo.set(sentido);
    this.cargarRecorrido();
  }

  /** Marca o desmarca la visualization simultánea de IDA y VUELTA. */
  alternarAmbosSentidos(): void {
    const activar = !this.mostrarAmbosSentidos();
    this.mostrarAmbosSentidos.set(activar);
    this.recorridoContrario.set(null);

    if (activar) {
      this.cargarRecorridoContrario();
    }
  }

  enfocarParada(parada: Parada | null): void {
    this.paradaEnfocada.set(parada);
  }

  /** Abre el editor de punto de control sobre una parada del recorrido visible. */
  abrirEditorPuntoControl(recorridoId: number, paradaId: number): void {
    const recorrido = this.buscarRecorrido(recorridoId);
    if (!recorrido) return;
    if (!recorrido.paradas.some((parada) => parada.id === paradaId)) return;

    this.paradaEnEdicion.set({
      lineaId: recorrido.lineaId,
      recorridoId,
      paradaId,
    });
  }

  cerrarEditorPuntoControl(): void {
    this.paradaEnEdicion.set(null);
  }

  /** Busca la parada en el recorrido activo o en el contrario. */
  buscarParada(recorridoId: number, paradaId: number): Parada | null {
    const recorrido = this.buscarRecorrido(recorridoId);
    if (!recorrido) return null;

    return recorrido.paradas.find((parada) => parada.id === paradaId) ?? null;
  }

  /** Busca el recorrido visible (activo o contrario) por su id. */
  buscarRecorrido(recorridoId: number): RecorridoDetalle | null {
    for (const recorrido of [this.recorridoActual(), this.recorridoContrario()]) {
      if (recorrido && recorrido.id === recorridoId) return recorrido;
    }

    return null;
  }

  /**
   * Enfoca una parada del recorrido indicado. Si la parada es del sentido
   * contrario al visible, cambia el sentido y la enfoca al recargar.
   */
  enfocarParadaEnRecorrido(recorrido: RecorridoDetalle, parada: Parada): void {
    if (this.sentidoActivo() !== recorrido.sentido) {
      this.mostrarAmbosSentidos.set(false);
      this.sentidoActivo.set(recorrido.sentido);
      this.cargarRecorrido(parada);
      return;
    }

    this.enfocarParada(parada);
  }

  /** Carga los dos recorridos (IDA y VUELTA) de una línea. */
  cargarRecorridosLinea(lineaId: number): void {
    this.api.obtenerRecorrido(lineaId, 'IDA').subscribe({
      next: (ida) => {
        this.api.obtenerRecorrido(lineaId, 'VUELTA').subscribe({
          next: (vuelta) => this.recorridosLinea.set([ida, vuelta]),
          error: () => this.recorridosLinea.set([ida]),
        });
      },
      error: () => this.recorridosLinea.set([]),
    });
  }

  private cargarLineas(): void {
    this.cargando.set(true);
    this.api.obtenerLineas().subscribe({
      next: (lineas) => {
        this.lineas.set(lineas);
        this.cargando.set(false);
        const lineaInicial = lineas.find((linea) => linea.activo) ?? lineas[0];
        if (lineaInicial) {
          this.seleccionarLinea(lineaInicial);
        }
      },
      error: () => this.cargando.set(false),
    });
  }

  private cargarRecorrido(paradaEnfocar?: Parada): void {
    const linea = this.lineaSeleccionada();
    const sentido = this.sentidoActivo();
    if (!linea) return;

    this.cargando.set(true);
    this.recorridoActual.set(null);
    this.paradaEnfocada.set(null);
    this.paradaEnEdicion.set(null);
    this.recorridoContrario.set(null);
    this.recorridosLinea.set([]);

    this.api.obtenerRecorrido(linea.id, sentido).subscribe({
      next: (rec) => {
        this.recorridoActual.set(rec);
        this.paradaEnfocada.set(paradaEnfocar ?? null);
        if (this.mostrarAmbosSentidos()) {
          this.cargarRecorridoContrario();
        } else {
          this.cargando.set(false);
        }
      },
      error: () => this.cargando.set(false),
    });
  }

  private cargarRecorridoContrario(): void {
    const linea = this.lineaSeleccionada();
    if (!linea) return;

    const contrario: SentidoRecorrido = this.sentidoActivo() === 'IDA' ? 'VUELTA' : 'IDA';

    this.api.obtenerRecorrido(linea.id, contrario).subscribe({
      next: (rec) => {
        this.recorridoContrario.set(rec);
        this.cargando.set(false);
      },
      error: () => {
        this.recorridoContrario.set(null);
        this.cargando.set(false);
      },
    });
  }
}
