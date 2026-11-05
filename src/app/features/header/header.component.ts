import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ControlPointsPanelComponent } from '../control-point/control-points-panel.component';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

type MenuHeader = 'corredores' | 'puntos' | null;

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ControlPointsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  protected readonly estado = inject(SibusStateService);

  private readonly puntosControl = inject(PuntosControlService);

  /** Menú desplegado desde el header (solo uno a la vez). */
  protected readonly menuAbierto = signal<MenuHeader>(null);

  protected readonly corredores = computed(() => {
    const vistos = new Set<string>();
    const resultado: string[] = [];

    for (const linea of this.estado.lineas()) {
      if (vistos.has(linea.corredor)) continue;
      vistos.add(linea.corredor);
      resultado.push(linea.corredor);
    }

    return resultado;
  });

  protected readonly corredorActivo = computed(
    () => this.estado.lineaSeleccionada()?.corredor ?? 'Corredores',
  );

  /** Cantidad de puntos de control de la línea activa. */
  protected readonly cantidadPuntos = computed(() => {
    const linea = this.estado.lineaSeleccionada();
    if (!linea) return 0;

    return this.puntosControl.puntosDeLinea(linea.id).length;
  });

  protected alternarMenu(menu: Exclude<MenuHeader, null>): void {
    this.menuAbierto.update((actual) => (actual === menu ? null : menu));
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(null);
  }

  protected esCorredorActivo(corredor: string): boolean {
    return this.estado.lineaSeleccionada()?.corredor === corredor;
  }

  protected claseCorredor(corredor: string): string {
    return this.esCorredorActivo(corredor)
      ? 'flex w-full items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-left text-sm font-bold text-sky-700'
      : 'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100';
  }

  protected seleccionarCorredor(corredor: string): void {
    const linea = this.estado.lineas().find((item) => item.corredor === corredor && item.activo);
    if (linea) {
      this.estado.seleccionarLinea(linea);
    }
    this.cerrarMenu();
  }
}
