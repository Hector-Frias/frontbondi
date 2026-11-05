import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONOS_CONTROL } from '../../core/data/iconos-control';
import { Parada, PuntoControl } from '../../core/models';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';
import { svgConfiable } from '../../core/utils/svg';

/**
 * Selector de punto de control: al elegir un ícono la parada queda anotada y
 * el ícono se ve en el mapa. "Quitar" borra solo la anotación, la parada sigue
 * formando parte del recorrido.
 */
@Component({
  selector: 'app-control-point-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-point-sheet.component.html',
})
export class ControlPointSheetComponent {
  protected readonly estado = inject(SibusStateService);

  private readonly puntosControl = inject(PuntosControlService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly iconos = ICONOS_CONTROL.map((icono) => ({
    ...icono,
    svgSeguro: svgConfiable(this.sanitizer, icono.svg),
  }));

  protected readonly parada = computed<Parada | null>(() => {
    const edicion = this.estado.paradaEnEdicion();
    if (!edicion) return null;

    return this.estado.buscarParada(edicion.recorridoId, edicion.paradaId);
  });

  protected readonly puntoActual = computed<PuntoControl | null>(() => {
    const edicion = this.estado.paradaEnEdicion();
    if (!edicion) return null;

    return this.puntosControl.puntoDe(edicion.recorridoId, edicion.paradaId) ?? null;
  });

  protected esIconoActual(iconoId: string): boolean {
    return this.puntoActual()?.iconoId === iconoId;
  }

  protected elegir(iconoId: string): void {
    const edicion = this.estado.paradaEnEdicion();
    if (!edicion) return;

    this.puntosControl.guardar(
      edicion.lineaId,
      edicion.recorridoId,
      edicion.paradaId,
      iconoId,
    );
    this.estado.cerrarEditorPuntoControl();
  }

  protected quitar(): void {
    const edicion = this.estado.paradaEnEdicion();
    if (!edicion) return;

    this.puntosControl.eliminarDeParada(edicion.recorridoId, edicion.paradaId);
    this.estado.cerrarEditorPuntoControl();
  }

  protected cerrar(): void {
    this.estado.cerrarEditorPuntoControl();
  }
}
