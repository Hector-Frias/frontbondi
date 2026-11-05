import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONOS_CONTROL, buscarIconoControl } from '../../core/data/iconos-control';
import { Parada, PuntoControl, RecorridoDetalle } from '../../core/models';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';
import { svgConfiable } from '../../core/utils/svg';

export interface PuntoControlItem {
  punto: PuntoControl;
  parada: Parada;
  recorrido: RecorridoDetalle;
}

/**
 * Listado de los puntos de control de la línea activa (ambos sentidos).
 * Permite verlos de un vistazo, enfocar la parada en el mapa o quitar el
 * punto de control (la parada del recorrido no se toca).
 */
@Component({
  selector: 'app-control-points-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-points-panel.component.html',
})
export class ControlPointsPanelComponent {
  /** Avisa al header para que cierre el menú. */
  readonly cerrado = output<void>();

  protected readonly estado = inject(SibusStateService);

  private readonly puntosControl = inject(PuntosControlService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly svgPorIcono = new Map<string, SafeHtml>(
    ICONOS_CONTROL.map((icono) => [icono.id, svgConfiable(this.sanitizer, icono.svg)]),
  );

  private readonly svgVacio = svgConfiable(
    this.sanitizer,
    buscarIconoControl('info')?.svg ?? '<svg viewBox="0 0 24 24"></svg>',
  );

  protected readonly linea = computed(() => this.estado.lineaSeleccionada());

  /** Puntos de control de la línea activa, ordenados por recorrido y parada. */
  protected readonly items = computed<PuntoControlItem[]>(() => {
    const items: PuntoControlItem[] = [];

    for (const recorrido of this.estado.recorridosLinea()) {
      for (const parada of recorrido.paradas) {
        const punto = this.puntosControl.puntoDe(recorrido.id, parada.id);
        if (!punto) continue;

        items.push({ punto, parada, recorrido });
      }
    }

    return items;
  });

  protected readonly cargando = computed(
    () => this.estado.cargando() && this.estado.recorridosLinea().length === 0,
  );

  constructor() {
    effect(() => {
      const linea = this.estado.lineaSeleccionada();
      if (!linea) return;

      this.estado.cargarRecorridosLinea(linea.id);
    });
  }

  protected svgDe(punto: PuntoControl): SafeHtml {
    return this.svgPorIcono.get(punto.iconoId) ?? this.svgVacio;
  }

  protected colorDe(punto: PuntoControl): string {
    return buscarIconoControl(punto.iconoId)?.color ?? '#0284c7';
  }

  protected nombreDe(punto: PuntoControl): string {
    return buscarIconoControl(punto.iconoId)?.nombre ?? 'Punto de control';
  }

  /** Enfoca la parada en el mapa (cambia de sentido si hace falta) y cierra el panel. */
  protected enfocar(item: PuntoControlItem): void {
    this.estado.enfocarParadaEnRecorrido(item.recorrido, item.parada);
    this.cerrado.emit();
  }

  /** Quita solo el punto de control: la parada sigue en el recorrido. */
  protected quitar(item: PuntoControlItem): void {
    this.puntosControl.eliminar(item.punto.id);
  }
}
