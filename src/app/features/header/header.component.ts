import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SibusStateService } from '../../core/services/sibus-state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  protected readonly estado = inject(SibusStateService);

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

  protected esCorredorActivo(corredor: string): boolean {
    return this.estado.lineaSeleccionada()?.corredor === corredor;
  }

  protected claseCorredor(corredor: string): string {
    return this.esCorredorActivo(corredor)
      ? 'shrink-0 rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white transition-colors'
      : 'shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors';
  }

  protected seleccionarCorredor(corredor: string): void {
    const linea = this.estado.lineas().find((item) => item.corredor === corredor && item.activo);
    if (linea) {
      this.estado.seleccionarLinea(linea);
    }
  }
}
