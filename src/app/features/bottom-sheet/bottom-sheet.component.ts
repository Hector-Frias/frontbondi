import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Parada, PuntoControl } from '../../core/models';
import { BusquedaService } from '../../core/services/busqueda.service';
import { MapService } from '../../core/services/map.service';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';
import {
  ICONOS_CONTROL,
  SVG_BANDERA_NEUTRA,
  buscarIconoControl,
} from '../../core/data/iconos-control';
import { svgConfiable } from '../../core/utils/svg';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-sheet.component.html',
})
export class BottomSheetComponent {
  protected readonly estado = inject(SibusStateService);

  private readonly mapService = inject(MapService);
  private readonly puntosControl = inject(PuntosControlService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly busqueda = inject(BusquedaService);

  private readonly svgPorIcono = new Map<string, SafeHtml>(
    ICONOS_CONTROL.map((icono) => [icono.id, svgConfiable(this.sanitizer, icono.svg)]),
  );

  private readonly svgSinPunto = svgConfiable(this.sanitizer, SVG_BANDERA_NEUTRA);

  protected readonly expandido = signal(false);

  constructor() {
    // El panel de resultados del buscador ocupa la parte superior del mapa: la
    // hoja inferior se pliega para no taparlo.
    effect(() => {
      if (this.busqueda.hayDestino()) {
        this.expandido.set(false);
      }
    });
  }

  protected readonly totalParadas = computed(
    () => this.estado.recorridoActual()?.paradas.length ?? 0,
  );

  protected readonly paradasOrdenadas = computed(() =>
    [...this.estado.paradasFiltradas()].sort((a, b) => a.orden - b.orden),
  );

  protected alternar(): void {
    this.expandido.update((valor) => !valor);
    setTimeout(() => this.mapService.invalidarTamano(), 200);
  }

  protected enfocar(parada: Parada): void {
    this.estado.enfocarParada(parada);
  }

  /** Abre el editor para asignar (o editar) el punto de control de la parada. */
  protected abrirEditor(parada: Parada): void {
    const recorrido = this.estado.recorridoActual();
    if (!recorrido) return;

    this.estado.abrirEditorPuntoControl(recorrido.id, parada.id);
  }

  protected puntoDe(parada: Parada): PuntoControl | undefined {
    const recorrido = this.estado.recorridoActual();
    if (!recorrido) return undefined;

    return this.puntosControl.puntoDe(recorrido.id, parada.id);
  }

  protected svgPunto(parada: Parada): SafeHtml {
    const punto = this.puntoDe(parada);
    if (!punto) return this.svgSinPunto;

    return this.svgPorIcono.get(punto.iconoId) ?? this.svgSinPunto;
  }

  protected colorPunto(parada: Parada): string {
    const punto = this.puntoDe(parada);
    if (!punto) return '#94a3b8';

    return buscarIconoControl(punto.iconoId)?.color ?? '#0284c7';
  }

  protected etiquetaControl(parada: Parada): string {
    return this.puntoDe(parada)
      ? 'Editar punto de control'
      : 'Agregar punto de control';
  }

  protected esParadaEnfocada(parada: Parada): boolean {
    return this.estado.paradaEnfocada()?.id === parada.id;
  }

  protected claseParada(parada: Parada): string {
    return this.esParadaEnfocada(parada)
      ? 'flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-left'
      : 'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100';
  }

  protected claseNumero(parada: Parada): string {
    const base =
      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold';

    return this.esParadaEnfocada(parada)
      ? `${base} border-sky-600 bg-sky-600 text-white`
      : `${base} border-slate-300 text-slate-500`;
  }

  protected claseBotonControl(parada: Parada): string {
    const base =
      'flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-colors';

    return this.puntoDe(parada)
      ? `${base} border-solid`
      : `${base} border-dashed border-slate-300 text-slate-400`;
  }
}
