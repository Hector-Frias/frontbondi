import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Linea, SentidoRecorrido } from '../../core/models';
import { SibusStateService } from '../../core/services/sibus-state.service';

@Component({
  selector: 'app-line-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-selector.component.html',
})
export class LineSelectorComponent {
  protected readonly estado = inject(SibusStateService);

  protected readonly sentidos: SentidoRecorrido[] = ['IDA', 'VUELTA'];

  protected esLineaActiva(linea: Linea): boolean {
    return this.estado.lineaSeleccionada()?.id === linea.id;
  }

  protected claseLinea(linea: Linea): string {
    return this.esLineaActiva(linea)
      ? 'shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-bold text-white transition-colors'
      : 'shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 transition-colors';
  }

  protected esSentidoActivo(sentido: SentidoRecorrido): boolean {
    return this.estado.sentidoActivo() === sentido && !this.estado.mostrarAmbosSentidos();
  }

  protected claseSentido(sentido: SentidoRecorrido): string {
    return this.esSentidoActivo(sentido)
      ? 'flex-1 rounded-md bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm transition-all'
      : 'flex-1 rounded-md px-3 py-1 text-xs font-semibold text-slate-500 transition-all';
  }

  protected claseAmbos(): string {
    return this.estado.mostrarAmbosSentidos()
      ? 'flex-1 rounded-md bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm transition-all'
      : 'flex-1 rounded-md px-3 py-1 text-xs font-semibold text-slate-500 transition-all';
  }
}
