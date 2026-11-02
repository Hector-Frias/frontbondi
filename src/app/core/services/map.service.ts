import { Injectable, signal } from '@angular/core';
import type { LatLngBounds, LayerGroup, Map as LeafletMap, Polyline } from 'leaflet';
import { Parada, RecorridoVisible } from '../models';

type LeafletModule = typeof import('leaflet');

export interface OpcionesMapa {
  centro: [number, number];
  zoom: number;
}

const URL_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Encapsula Leaflet: mantiene la instancia del mapa, las capas de la traza y de las
 * paradas, y expone las operaciones de dibujo y cámara.
 *
 * Leaflet se carga con `import()` dinámico porque su bundle lee `navigator` al
 * evaluarse y el proyecto renderiza en servidor (SSR): el módulo nunca debe
 * evaluarse en Node.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  readonly mapaListo = signal(false);

  private leaflet: LeafletModule | null = null;
  private mapa: LeafletMap | null = null;
  private capaRuta: LayerGroup | null = null;
  private capaParadas: LayerGroup | null = null;

  get mapaInstancia(): LeafletMap | null {
    return this.mapa;
  }

  async inicializar(elemento: HTMLElement, opciones: OpcionesMapa): Promise<void> {
    if (this.mapa) {
      this.invalidarTamano();
      return;
    }

    const modulo = (await import('leaflet')) as LeafletModule & { default?: LeafletModule };
    const L = modulo.default ?? modulo;
    this.leaflet = L;

    this.mapa = L.map(elemento, {
      center: opciones.centro,
      zoom: opciones.zoom,
    });

    L.tileLayer(URL_TILES, {
      maxZoom: 19,
      attribution: ATRIBUCION,
    }).addTo(this.mapa);

    this.capaRuta = L.layerGroup().addTo(this.mapa);
    this.capaParadas = L.layerGroup().addTo(this.mapa);

    this.mapaListo.set(true);
  }

  /**
   * Dibuja uno o varios recorridos: cada traza con su color (el secundario va
   * punteado) y cada parada con un marcador numerado.
   */
  dibujarRecorridos(visibles: RecorridoVisible[]): void {
    const L = this.leaflet;
    const mapa = this.mapa;
    if (!L || !mapa || !this.capaRuta || !this.capaParadas) return;

    this.capaRuta.clearLayers();
    this.capaParadas.clearLayers();

    let bounds: LatLngBounds | null = null;

    for (const visible of visibles) {
      const traza: Polyline = L.polyline(visible.recorrido.coordenadasRuta, {
        color: visible.colorHex,
        weight: visible.secundario ? 3 : 4,
        opacity: visible.secundario ? 0.8 : 0.95,
        dashArray: visible.secundario ? '9 7' : undefined,
      });
      traza.addTo(this.capaRuta);

      for (const parada of visible.recorrido.paradas) {
        const icono = L.divIcon({
          className: 'parada-marker-wrapper',
          html: `<span class="parada-marker${visible.secundario ? ' parada-marker--secundario' : ''}" style="--parada-color:${visible.colorHex}">${parada.orden}</span>`,
          iconSize: visible.secundario ? [20, 20] : [24, 24],
          iconAnchor: visible.secundario ? [10, 10] : [12, 12],
        });

        L.marker([parada.latitud, parada.longitud], { icon: icono, keyboard: false })
          .bindPopup(parada.nombreCalle)
          .addTo(this.capaParadas);
      }

      const limites = traza.getBounds();
      if (limites.isValid()) {
        bounds = bounds ? bounds.extend(limites) : limites;
      }
    }

    if (bounds) {
      mapa.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  enfocarParada(parada: Parada, zoom = 16): void {
    this.mapa?.flyTo([parada.latitud, parada.longitud], zoom);
  }

  centrarEn(coordenada: [number, number], zoom = 16): void {
    this.mapa?.flyTo(coordenada, zoom);
  }

  invalidarTamano(): void {
    this.mapa?.invalidateSize();
  }

  destruir(): void {
    this.capaRuta?.clearLayers();
    this.capaParadas?.clearLayers();
    this.mapa?.remove();

    this.mapa = null;
    this.capaRuta = null;
    this.capaParadas = null;
    this.leaflet = null;
    this.mapaListo.set(false);
  }
}
