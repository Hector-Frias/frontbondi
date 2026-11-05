import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { MapService } from '../../core/services/map.service';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

const CENTRO_CORDOBA: [number, number] = [-31.4201, -64.1888];
const ZOOM_INICIAL = 13;

@Component({
  selector: 'app-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent {
  protected readonly estado = inject(SibusStateService);

  private readonly mapService = inject(MapService);
  private readonly puntosControl = inject(PuntosControlService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');

  constructor() {
    afterNextRender(() => this.inicializarMapa());

    this.destroyRef.onDestroy(() => this.mapService.destruir());

    effect(() => {
      const listo = this.mapService.mapaListo();
      const visibles = this.estado.recorridosVisibles();

      if (!listo) return;

      this.mapService.dibujarRecorridos(visibles);
    });

    effect(() => {
      const listo = this.mapService.mapaListo();
      const visibles = this.estado.recorridosVisibles();
      const puntos = this.puntosControl.puntos();

      if (!listo) return;

      this.mapService.dibujarAnotaciones(visibles, puntos);
    });

    effect(() => {
      const listo = this.mapService.mapaListo();
      const parada = this.estado.paradaEnfocada();

      if (!listo || !parada) return;

      this.mapService.enfocarParada(parada);
    });

    this.mapService.onPeticionPuntoControl = (recorridoId, paradaId) => {
      this.estado.abrirEditorPuntoControl(recorridoId, paradaId);
    };
  }

  private inicializarMapa(): void {
    const elemento = this.contenedor().nativeElement;
    void this.mapService.inicializar(elemento, { centro: CENTRO_CORDOBA, zoom: ZOOM_INICIAL });

    const alRedimensionar = (): void => this.mapService.invalidarTamano();
    window.addEventListener('resize', alRedimensionar);
    window.addEventListener('orientationchange', alRedimensionar);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('orientationchange', alRedimensionar);
    });
  }
}
