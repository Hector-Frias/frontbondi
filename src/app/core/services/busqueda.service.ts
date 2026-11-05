import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AnalisisDestino,
  AnalisisLinea,
  Destino,
  Linea,
  Parada,
  RecorridoDetalle,
  SugerenciaUbicacion,
} from '../models';
import {
  distanciaHaversine,
  distanciaMinimaARecorrido,
  formatearDistancia,
  indiceVerticeMasCercano,
  tiempoCaminata,
} from '../utils/geo';
import { GeocodingService } from './geocoding.service';
import { GeolocationService } from './geolocation.service';
import { SibusApiService } from './sibus-api.service';
import { SibusStateService } from './sibus-state.service';

/** Distancia máxima (en metros) para decir que la línea "pasa por" el destino. */
const UMBRAL_PASA = 60;

/** Distancia máxima (en metros) a la parada para considerarla una opción cercana. */
const UMBRAL_CERCA = 400;

/** Distancia máxima (en metros) a la parada para que la línea sea una alternativa viable. */
const UMBRAL_VIABLE = 1200;

/** Retraso del autocompletado remoto, en ms. */
const RETRASO_DEBOUNCE = 600;

/** Intervalo mínimo entre consultas a Nominatim, en ms (su política admite 1 por segundo). */
const INTERVALO_MINIMO = 1100;

/** Máximo de líneas mostradas en el panel de resultados. */
const MAXIMO_LINEAS_VISIBLES = 8;

/** Análisis de un recorrido frente al destino. */interface AnalisisRecorrido {
  recorrido: RecorridoDetalle;
  distanciaTraza: number;
  indiceDestino: number;
  paradaCercana: Parada;
  distanciaParada: number;
  indiceParada: number;
}

/**
 * Buscador de ubicaciones: responde qué colectivo deja al pasajero más cerca
 * de un destino cualquiera.
 *
 * El flujo es: texto escrito → sugerencias (paradas locales + Nominatim) →
 * destino elegido → ranking de las 21 líneas ordenado por cercanía, con la línea
 * activa del usuario al frente.
 */
@Injectable({ providedIn: 'root' })
export class BusquedaService {
  private readonly api = inject(SibusApiService);
  private readonly geocoding = inject(GeocodingService);
  private readonly geolocation = inject(GeolocationService);
  private readonly estado = inject(SibusStateService);

  private readonly recorridos = signal<RecorridoDetalle[]>([]);
  private readonly lineasPorId = new Map<number, Linea>();

  readonly consulta = signal<string>('');
  readonly sugerenciasLocales = signal<SugerenciaUbicacion[]>([]);
  readonly sugerenciasRemotas = signal<SugerenciaUbicacion[]>([]);
  readonly cargandoRemoto = signal(false);
  readonly destino = signal<Destino | null>(null);

  /**
   * El panel de resultados está desplegado.
   * Es independiente del destino: al cerrar el panel la cruz del destino
   * sigue en el mapa, que es lo que el usuario necesita para ubicarse.
   */
  readonly panelAbierto = signal(false);

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private controlador: AbortController | null = null;
  private ultimoEnvio = 0;

  constructor() {
    const datos = this.api.datosInmediatos();

    if (datos) {
      this.cargarDatos(datos.lineas, datos.recorridos);
    } else {
      this.api.obtenerRecorridos().subscribe((recorridos) => {
        this.cargarDatos(this.api.datosInmediatos()?.lineas ?? [], recorridos);
      });
    }
  }

  /** Todas las sugerencias: primero las paradas locales, después los lugares de OSM. */
  readonly sugerencias = computed<SugerenciaUbicacion[]>(() => {
    const vistas = new Set<string>();
    const resultado: SugerenciaUbicacion[] = [];

    for (const sugerencia of [...this.sugerenciasLocales(), ...this.sugerenciasRemotas()]) {
      if (vistas.has(sugerencia.id)) continue;
      vistas.add(sugerencia.id);
      resultado.push(sugerencia);
    }

    return resultado;
  });

  /** Hay un destino analizado: el mapa muestra la cruz y las paradas de subida. */
  readonly hayDestino = computed(() => this.destino() !== null);

  /** Análisis completo del destino elegido. */
  readonly analisis = computed<AnalisisDestino | null>(() => {
    const destino = this.destino();
    if (!destino) return null;

    const lineas = this.analizarLineas(destino);
    if (lineas.length === 0) return null;

    const lineaActivaId = this.estado.lineaSeleccionada()?.id ?? null;
    const lineaActiva = lineas.find((item) => item.linea.id === lineaActivaId) ?? null;

    const ordenadas = [...lineas].sort((a, b) => {
      if (a.linea.id === lineaActivaId) return -1;
      if (b.linea.id === lineaActivaId) return 1;
      return compararAnalisis(a, b);
    });

    return { destino, lineas: ordenadas, lineaActiva };
  });

  /** Líneas del ranking, ya filtradas a las que realmente sirven. */
  readonly lineasUtiles = computed<AnalisisLinea[]>(() => {
    const analisis = this.analisis();
    if (!analisis) return [];

    const utiles = analisis.lineas.filter((item) => item.distanciaParada <= UMBRAL_VIABLE);
    const resto = analisis.lineas.filter((item) => item.distanciaParada > UMBRAL_VIABLE);

    return [...utiles, ...resto];
  });

  /** Primeras líneas del ranking: las que se muestran sin pedir "ver todas". */
  readonly lineasVisibles = computed<AnalisisLinea[]>(() =>
    this.lineasUtiles().slice(0, MAXIMO_LINEAS_VISIBLES),
  );

  /** Paradas por las que conviene subirse en las líneas mejor posicionadas. */
  readonly paradasDeSubida = computed<Parada[]>(() => {
    const analisis = this.analisis();
    if (!analisis) return [];

    const vistas = new Set<string>();
    const paradas: Parada[] = [];

    for (const item of analisis.lineas.slice(0, 3)) {
      const clave = `${item.paradaCercana.nombreCalle}|${item.paradaCercana.latitud.toFixed(4)}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      paradas.push(item.paradaCercana);
    }

    return paradas;
  });

  /**
   * Registra lo que el usuario escribe: resuelve las paradas locales al instante
   * y programa la consulta a Nominatim.
   */
  consultar(texto: string): void {
    this.consulta.set(texto);

    const limpio = texto.trim();

    if (limpio.length === 0) {
      this.limpiarConsulta();
      return;
    }

    this.sugerenciasLocales.set(this.geocoding.buscarLocal(limpio));
    this.programarRemoto(limpio);
  }

  /** Elige una sugerencia como destino y abre el panel de resultados. */
  seleccionar(sugerencia: SugerenciaUbicacion): void {
    this.destino.set({
      id: sugerencia.id,
      etiqueta: sugerencia.etiqueta,
      latitud: sugerencia.latitud,
      longitud: sugerencia.longitud,
      origen: sugerencia.origen,
      parada: sugerencia.parada,
      linea: sugerencia.linea,
    });

    this.panelAbierto.set(true);
    this.limpiarConsulta();
  }

  /** Usa la posición actual del pasajero como destino. */
  usarMiUbicacion(): void {
    const posicion = this.geolocation.posicion();
    if (!posicion) return;

    this.destino.set({
      id: 'mi-ubicacion',
      etiqueta: 'Mi ubicación',
      latitud: posicion.latitud,
      longitud: posicion.longitud,
      origen: 'lugar',
    });

    this.panelAbierto.set(true);
    this.limpiarConsulta();
  }

  /**
   * Cierra el panel de resultados sin borrar el destino: la cruz sigue
   * marcada en el mapa para que el usuario sepa dónde quedó la ubicación.
   */
  cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  /** Limpia la búsqueda, el destino y el panel. */
  limpiar(): void {
    this.limpiarConsulta();
    this.destino.set(null);
    this.panelAbierto.set(false);
  }

  /** Vacía el texto escrito y las sugerencias, sin tocar el destino. */
  private limpiarConsulta(): void {
    this.consulta.set('');
    this.sugerenciasLocales.set([]);
    this.sugerenciasRemotas.set([]);
    this.cancelarRemoto();
  }

  /**
   * Aplica una línea del ranking: la selecciona, cambia al sentido que sirve y
   * enfoca la parada de subida.
   */
  elegirLinea(item: AnalisisLinea): void {
    this.estado.seleccionarLineaConSentido(item.linea, item.sentido, item.paradaCercana);
  }

  /** Texto corto que resume el veredicto de una línea para el destino. */
  resumen(item: AnalisisLinea): string {
    switch (item.veredicto) {
      case 'pasa':
        return `Pasa a ${formatearDistancia(item.distanciaTraza)} del destino`;
      case 'cerca':
        return `Parada a ${formatearDistancia(item.distanciaParada)} · ${item.minutosCaminata} min`;
      default:
        return `Parada más cercana a ${formatearDistancia(item.distanciaParada)}`;
    }
  }

  private cargarDatos(lineas: Linea[], recorridos: RecorridoDetalle[]): void {
    this.lineasPorId.clear();
    for (const linea of lineas) {
      this.lineasPorId.set(linea.id, linea);
    }
    this.recorridos.set(recorridos);
  }

  /** Analiza las 21 líneas contra el destino y devuelve el ranking. */
  private analizarLineas(destino: Destino): AnalisisLinea[] {
    const punto = { latitud: destino.latitud, longitud: destino.longitud };
    const porLinea = new Map<number, AnalisisRecorrido[]>();

    for (const recorrido of this.recorridos()) {
      const analisis = this.analizarRecorrido(recorrido, punto);
      if (!analisis) continue;

      const lista = porLinea.get(recorrido.lineaId) ?? [];
      lista.push(analisis);
      porLinea.set(recorrido.lineaId, lista);
    }

    const resultado: AnalisisLinea[] = [];

    for (const [lineaId, analisis] of porLinea) {
      const linea = this.lineasPorId.get(lineaId);
      if (!linea) continue;

      const mejor = this.mejorDe(analisis);
      const contrario = analisis.find((item) => item !== mejor);

      resultado.push({
        linea,
        sentido: mejor.recorrido.sentido,
        recorridoId: mejor.recorrido.id,
        distanciaTraza: mejor.distanciaTraza,
        paradaCercana: mejor.paradaCercana,
        distanciaParada: mejor.distanciaParada,
        sentidoContrarioSirve: contrario ? contrario.distanciaTraza <= UMBRAL_PASA : false,
        veredicto: this.veredictoDe(mejor.distanciaTraza, mejor.distanciaParada),
        posicionParada: this.posicionDe(mejor.indiceParada, mejor.indiceDestino),
        minutosCaminata: tiempoCaminata(mejor.distanciaParada),
      });
    }

    return resultado;
  }

  /** Analiza un recorrido: distancia a la traza y parada más próxima. */
  private analizarRecorrido(
    recorrido: RecorridoDetalle,
    punto: { latitud: number; longitud: number },
  ): AnalisisRecorrido | null {
    if (recorrido.paradas.length === 0) return null;

    const { distancia, indice } = distanciaMinimaARecorrido(punto, recorrido.coordenadasRuta);

    let paradaCercana: Parada | null = null;
    let distanciaParada = Number.POSITIVE_INFINITY;

    for (const parada of recorrido.paradas) {
      const actual = distanciaHaversine(punto, parada);
      if (actual < distanciaParada) {
        distanciaParada = actual;
        paradaCercana = parada;
      }
    }

    if (!paradaCercana) return null;

    return {
      recorrido,
      distanciaTraza: distancia,
      indiceDestino: indice,
      paradaCercana,
      distanciaParada,
      indiceParada: indiceVerticeMasCercano(paradaCercana, recorrido.coordenadasRuta),
    };
  }

  /** Elige el sentido que mejor sirve: primero por traza, después por parada. */
  private mejorDe(analisis: AnalisisRecorrido[]): AnalisisRecorrido {
    return [...analisis].sort((a, b) => {
      if (a.distanciaTraza !== b.distanciaTraza) return a.distanciaTraza - b.distanciaTraza;
      return a.distanciaParada - b.distanciaParada;
    })[0];
  }

  private veredictoDe(
    distanciaTraza: number,
    distanciaParada: number,
  ): AnalisisLinea['veredicto'] {
    if (distanciaTraza <= UMBRAL_PASA) return 'pasa';
    if (distanciaParada <= UMBRAL_CERCA) return 'cerca';
    return 'lejos';
  }

  /**
   * Posición de la parada de subida respecto del destino en el recorrido.
   * "antes" significa que el colectivo sigue de largo hasta el destino.
   */
  private posicionDe(indiceParada: number, indiceDestino: number): AnalisisLinea['posicionParada'] {
    if (indiceParada < 0 || indiceDestino < 0) return 'igual';
    if (indiceParada < indiceDestino) return 'antes';
    if (indiceParada > indiceDestino) return 'despues';
    return 'igual';
  }

  /** Programa la consulta remota respetando el debounce y el intervalo mínimo. */
  private programarRemoto(texto: string): void {
    this.cancelarRemoto();

    const espera = Math.max(
      RETRASO_DEBOUNCE,
      this.ultimoEnvio + INTERVALO_MINIMO - Date.now(),
    );

    this.temporizador = setTimeout(() => {
      void this.enviarRemoto(texto);
    }, espera);
  }

  private async enviarRemoto(texto: string): Promise<void> {
    this.controlador = new AbortController();
    this.ultimoEnvio = Date.now();
    this.cargandoRemoto.set(true);

    try {
      const sugerencias = await this.geocoding.buscarRemoto(texto, this.controlador.signal);

      // La consulta pudo quedar vieja mientras esperaba la red.
      if (this.consulta().trim() !== texto) return;

      this.sugerenciasRemotas.set(sugerencias);
    } finally {
      this.cargandoRemoto.set(false);
    }
  }

  private cancelarRemoto(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }

    this.controlador?.abort();
    this.controlador = null;
    this.cargandoRemoto.set(false);
  }
}

/** Ordena dos líneas del ranking: primero las que pasan más cerca del destino. */
function compararAnalisis(a: AnalisisLinea, b: AnalisisLinea): number {
  if (a.distanciaTraza !== b.distanciaTraza) return a.distanciaTraza - b.distanciaTraza;
  return a.distanciaParada - b.distanciaParada;
}
