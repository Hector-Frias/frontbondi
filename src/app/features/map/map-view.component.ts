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
import { BusquedaService } from '../../core/services/busqueda.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { MapService } from '../../core/services/map.service';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

const CENTRO_CORDOBA: [number, number] = [-31.4201, -64.1888];
const ZOOM_INICIAL = 13;
const ZOOM_DESTINO = 15;

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
  private readonly geolocation = inject(GeolocationService);
  private readonly busqueda = inject(BusquedaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');

  constructor() {
    afterNextRender(() => this.inicializarMapa());

    this.destroyRef.onDestroy(() => this.mapService.destruir());

    effect(() => {
      const listo = this.mapService.mapaListo();
      const visibles = this.estado.recorridosVisibles();
      const hayDestino = this.busqueda.hayDestino();

      if (!listo) return;

      // Con un destino elegido la cámara la manejan el destino y la parada de
      // subida: la traza no debe robarle el encuadre.
      this.mapService.dibujarRecorridos(visibles, !hayDestino);
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

    effect(() => {
      const listo = this.mapService.mapaListo();
      const posicion = this.geolocation.posicion();

      if (!listo) return;

      this.mapService.dibujarUbicacion(posicion);

      if (posicion) {
        this.mapService.centrarEn([posicion.latitud, posicion.longitud]);
      }
    });

    effect(() => {
      const listo = this.mapService.mapaListo();
      const destino = this.busqueda.destino();

      if (!listo) return;

      this.mapService.dibujarDestino(
        destino ? [destino.latitud, destino.longitud] : null,
      );

      if (destino) {
        this.mapService.centrarEn([destino.latitud, destino.longitud], ZOOM_DESTINO);
      }
    });

    effect(() => {
      const listo = this.mapService.mapaListo();
      const paradas = this.busqueda.paradasDeSubida();

      if (!listo) return;

      this.mapService.dibujarParadasDestacadas(paradas);
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
