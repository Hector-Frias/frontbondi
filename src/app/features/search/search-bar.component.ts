import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { SugerenciaUbicacion } from '../../core/models';
import { BusquedaService } from '../../core/services/busqueda.service';
import { GeolocationService } from '../../core/services/geolocation.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-bar.component.html',
})
export class SearchBarComponent {
  protected readonly busqueda = inject(BusquedaService);
  protected readonly geolocation = inject(GeolocationService);

  /** Índice de la sugerencia resaltada con el teclado. */
  protected readonly indiceActivo = signal(-1);

  /** El input tiene el foco: el desplegable queda abierto. */
  protected readonly enfocado = signal(false);

  /** Se pidió la ubicación y todavía no llegó: al llegar se usa como destino. */
  private readonly pendienteDeUbicacion = signal(false);

  protected readonly sugerencias = computed(() => this.busqueda.sugerencias());

  protected readonly desplegableAbierto = computed(
    () => this.enfocado() && this.sugerencias().length > 0 && this.busqueda.consulta().length > 0,
  );

  protected readonly errorUbicacion = computed(() => this.geolocation.error());

  constructor() {
    effect(() => {
      const posicion = this.geolocation.posicion();

      if (!this.pendienteDeUbicacion() || !posicion) return;

      this.pendienteDeUbicacion.set(false);
      this.busqueda.usarMiUbicacion();
    });
  }

  protected onInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;

    this.busqueda.consultar(valor);
    this.indiceActivo.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const total = this.sugerencias().length;

    if (total === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.indiceActivo.update((indice) => (indice + 1) % total);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.indiceActivo.update((indice) => (indice <= 0 ? total - 1 : indice - 1));
        break;
      case 'Enter': {
        const indice = this.indiceActivo();
        const sugerencia = indice >= 0 ? this.sugerencias()[indice] : undefined;

        if (sugerencia) {
          event.preventDefault();
          this.elegir(sugerencia);
        }
        break;
      }
      case 'Escape':
        this.enfocado.set(false);
        break;
      default:
        break;
    }
  }

  /** Evita que el input pierda el foco antes de que se ejecute el click. */
  protected mantenerFoco(event: MouseEvent): void {
    event.preventDefault();
  }

  protected elegir(sugerencia: SugerenciaUbicacion): void {
    this.busqueda.seleccionar(sugerencia);
    this.indiceActivo.set(-1);
    this.enfocado.set(false);
  }

  protected limpiar(): void {
    this.busqueda.limpiar();
    this.indiceActivo.set(-1);
  }

  /** Usa la posición del pasajero como ubicación a analizar. */
  protected usarMiUbicacion(): void {
    if (this.geolocation.posicion()) {
      this.busqueda.usarMiUbicacion();
      return;
    }

    this.pendienteDeUbicacion.set(true);
    this.geolocation.solicitar();
  }

  protected claseSugerencia(indice: number): string {
    return indice === this.indiceActivo()
      ? 'flex w-full items-center gap-3 bg-sky-50 px-3 py-2 text-left'
      : 'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50';
  }
}
