import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AnalisisLinea } from '../../core/models';
import { BusquedaService } from '../../core/services/busqueda.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { distanciaHaversine, formatearDistancia } from '../../core/utils/geo';

@Component({
  selector: 'app-search-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-results.component.html',
})
export class SearchResultsComponent {
  protected readonly busqueda = inject(BusquedaService);
  protected readonly geolocation = inject(GeolocationService);

  /** Muestra el ranking completo o solo las líneas más útiles. */
  protected readonly mostrarTodas = signal(false);

  protected readonly analisis = computed(() => this.busqueda.analisis());

  protected readonly lineas = computed(() =>
    this.mostrarTodas() ? this.busqueda.lineasUtiles() : this.busqueda.lineasVisibles(),
  );

  /** Hay más líneas en el ranking de las que se están mostrando. */
  protected readonly hayMas = computed(
    () => this.busqueda.lineasUtiles().length > this.busqueda.lineasVisibles().length,
  );

  /** Distancia entre la posición del pasajero y el destino, si se conoce. */
  protected readonly distanciaAlDestino = computed<number | null>(() => {
    const destino = this.busqueda.destino();
    const posicion = this.geolocation.posicion();

    if (!destino || !posicion) return null;

    return distanciaHaversine(posicion, destino);
  });

  protected resumen(item: AnalisisLinea): string {
    return this.busqueda.resumen(item);
  }

  /** Texto que aclara si el colectivo sigue de largo hasta el destino. */
  protected mensajePosicion(item: AnalisisLinea): string {
    switch (item.posicionParada) {
      case 'antes':
        return 'El colectivo sigue hasta el destino.';
      case 'despues':
        return 'El colectivo ya pasó el destino: te conviene bajarte antes.';
      default:
        return '';
    }
  }

  protected veredictoDe(item: AnalisisLinea): string {
    switch (item.veredicto) {
      case 'pasa':
        return 'Pasa por el destino';
      case 'cerca':
        return 'Parada cercana';
      default:
        return 'No pasa cerca';
    }
  }

  protected claseVeredicto(item: AnalisisLinea): string {
    switch (item.veredicto) {
      case 'pasa':
        return 'bg-emerald-100 text-emerald-700';
      case 'cerca':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  }

  protected claseBoton(item: AnalisisLinea): string {
    return 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100';
  }

  protected cerrar(): void {
    this.busqueda.limpiar();
  }

  protected formatear(metros: number): string {
    return formatearDistancia(metros);
  }
}
