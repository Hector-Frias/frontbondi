import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Parada } from '../../core/models';
import { MapService } from '../../core/services/map.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-sheet.component.html',
})
export class BottomSheetComponent {
  protected readonly estado = inject(SibusStateService);

  private readonly mapService = inject(MapService);

  protected readonly expandido = signal(false);

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

  protected esParadaEnfocada(parada: Parada): boolean {
    return this.estado.paradaEnfocada()?.id === parada.id;
  }

  protected claseParada(parada: Parada): string {
    return this.esParadaEnfocada(parada)
      ? 'flex w-full items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-left'
      : 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100';
  }

  protected claseNumero(parada: Parada): string {
    const base =
      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold';

    return this.esParadaEnfocada(parada)
      ? `${base} border-sky-600 bg-sky-600 text-white`
      : `${base} border-slate-300 text-slate-500`;
  }
}
