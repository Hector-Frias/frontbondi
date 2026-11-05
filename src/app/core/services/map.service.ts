import { Injectable, signal } from '@angular/core';
import type { Circle, LatLngBounds, LayerGroup, Map as LeafletMap, Polyline } from 'leaflet';
import { Parada, PuntoControl, RecorridoVisible } from '../models';
import {
  SVG_BANDERA_FINAL,
  SVG_BANDERA_SALIDA,
  buscarIconoControl,
} from '../data/iconos-control';
import type { Posicion } from './geolocation.service';

type LeafletModule = typeof import('leaflet');

export interface OpcionesMapa {
  centro: [number, number];
  zoom: number;
}

const URL_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Lado del badge del punto de control. */
const LADO_ANOTACION = 22;
/** Lado de las banderas (SVG 24x24 escalado). */
const LADO_BANDERA = 26;
/** Lado del punto de ubicación del pasajero. */
const LADO_UBICACION = 20;
/** Lado de la parada de subida destacada. */
const LADO_PARADA_DESTACADA = 30;

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

  /**
   * Se dispara cuando el usuario pide asignar un punto de control desde el
   * popup de una parada del mapa.
   */
  onPeticionPuntoControl: ((recorridoId: number, paradaId: number) => void) | null = null;

  private leaflet: LeafletModule | null = null;
  private mapa: LeafletMap | null = null;
  private capaRuta: LayerGroup | null = null;
  private capaParadas: LayerGroup | null = null;
  private capaBanderas: LayerGroup | null = null;
  private capaPuntosControl: LayerGroup | null = null;
  private capaUbicacion: LayerGroup | null = null;
  private capaDestino: LayerGroup | null = null;
  private capaParadasDestacadas: LayerGroup | null = null;

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
    this.capaBanderas = L.layerGroup().addTo(this.mapa);
    this.capaPuntosControl = L.layerGroup().addTo(this.mapa);
    this.capaUbicacion = L.layerGroup().addTo(this.mapa);
    this.capaDestino = L.layerGroup().addTo(this.mapa);
    this.capaParadasDestacadas = L.layerGroup().addTo(this.mapa);

    this.escucharAccionesPopup();

    this.mapaListo.set(true);
  }

  /**
   * Dibuja uno o varios recorridos: cada traza con su color (el secundario va
   * punteado) y cada parada con un marcador numerado.
   *
   * `ajustarEncuadre` permite que el caller decida si el mapa se reencuadra con
   * la traza: cuando hay un destino elegido en el buscador no debe hacerlo,
   * porque la cámara la maneja el destino y la parada de subida.
   */
  dibujarRecorridos(visibles: RecorridoVisible[], ajustarEncuadre = true): void {
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
          .bindPopup(this.crearPopupParada(parada, visible.recorrido.id))
          .addTo(this.capaParadas);
      }

      const limites = traza.getBounds();
      if (limites.isValid()) {
        bounds = bounds ? bounds.extend(limites) : limites;
      }
    }

    if (bounds && ajustarEncuadre) {
      mapa.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  /**
   * Dibuja la posición del pasajero: punto pulsante y círculo de precisión.
   * Con `posicion` en `null` borra el marcador.
   */
  dibujarUbicacion(posicion: Posicion | null): void {
    const L = this.leaflet;
    if (!L || !this.capaUbicacion) return;

    this.capaUbicacion.clearLayers();
    if (!posicion) return;

    const centro: [number, number] = [posicion.latitud, posicion.longitud];

    if (Number.isFinite(posicion.precision) && posicion.precision > 0) {
      const precision: Circle = L.circle(centro, {
        radius: posicion.precision,
        color: '#0284c7',
        weight: 1,
        opacity: 0.4,
        fillColor: '#0284c7',
        fillOpacity: 0.12,
      });
      precision.addTo(this.capaUbicacion);
    }

    const icono = L.divIcon({
      className: 'ubicacion-marker-wrapper',
      html: '<span class="ubicacion-marker"></span>',
      iconSize: [LADO_UBICACION, LADO_UBICACION],
      iconAnchor: [LADO_UBICACION / 2, LADO_UBICACION / 2],
    });

    L.marker(centro, { icon: icono, keyboard: false, interactive: false }).addTo(
      this.capaUbicacion,
    );
  }

  /** Dibuja el destino elegido. Con `coordenada` en `null` borra el pin. */
  dibujarDestino(coordenada: [number, number] | null): void {
    const L = this.leaflet;
    if (!L || !this.capaDestino) return;

    this.capaDestino.clearLayers();
    if (!coordenada) return;

    const icono = L.divIcon({
      className: 'destino-marker-wrapper',
      html: '<span class="destino-marker"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 34],
    });

    L.marker(coordenada, { icon: icono, keyboard: false }).addTo(this.capaDestino);
  }

  /** Resalta las paradas por las que conviene subirse para llegar al destino. */
  dibujarParadasDestacadas(paradas: Parada[]): void {
    const L = this.leaflet;
    if (!L || !this.capaParadasDestacadas) return;

    this.capaParadasDestacadas.clearLayers();

    for (const parada of paradas) {
      const icono = L.divIcon({
        className: 'parada-destacada-wrapper',
        html: `<span class="parada-destacada">${parada.orden}</span>`,
        iconSize: [LADO_PARADA_DESTACADA, LADO_PARADA_DESTACADA],
        iconAnchor: [LADO_PARADA_DESTACADA / 2, LADO_PARADA_DESTACADA / 2],
      });

      L.marker([parada.latitud, parada.longitud], { icon: icono, keyboard: false })
        .bindPopup(this.crearPopupParada(parada, 0, false))
        .addTo(this.capaParadasDestacadas);
    }
  }

  /**
   * Dibuja las anotaciones sobre las paradas: bandera verde en la primera
   * parada del recorrido, bandera a cuadros en la última y el ícono del punto
   * de control en las paradas anotadas.
   *
   * No reencuadra la cámara: agregar o quitar una anotación no debe mover el
   * mapa que el usuario está mirando.
   */
  dibujarAnotaciones(visibles: RecorridoVisible[], puntos: PuntoControl[]): void {
    const L = this.leaflet;
    if (!L || !this.capaBanderas || !this.capaPuntosControl) return;

    this.capaBanderas.clearLayers();
    this.capaPuntosControl.clearLayers();

    const paradasPorRecorrido = new Map<number, Map<number, Parada>>();

    for (const visible of visibles) {
      const recorrido = visible.recorrido;
      const paradas = new Map<number, Parada>();
      for (const parada of recorrido.paradas) {
        paradas.set(parada.id, parada);
      }
      paradasPorRecorrido.set(recorrido.id, paradas);

      const ordenadas = [...recorrido.paradas].sort((a, b) => a.orden - b.orden);
      const primera = ordenadas[0];
      const ultima = ordenadas[ordenadas.length - 1];

      if (primera) {
        this.agregarBandera(L, primera, recorrido.id, 'salida', visible.secundario);
      }

      if (ultima) {
        this.agregarBandera(L, ultima, recorrido.id, 'final', visible.secundario);
      }
    }

    for (const punto of puntos) {
      const parada = paradasPorRecorrido.get(punto.recorridoId)?.get(punto.paradaId);
      if (!parada) continue;

      const icono = buscarIconoControl(punto.iconoId);
      if (!icono) continue;

      const marcador = L.divIcon({
        className: 'anotacion-marker-wrapper',
        html: `<span class="anotacion-marker" style="--anotacion-color:${icono.color}">${icono.svg}</span>`,
        iconSize: [LADO_ANOTACION, LADO_ANOTACION],
        iconAnchor: [-LADO_ANOTACION / 2, -LADO_ANOTACION / 2],
      });

      L.marker([parada.latitud, parada.longitud], { icon: marcador, keyboard: false })
        .bindPopup(this.crearPopupPuntoControl(parada, punto.recorridoId, punto.iconoId))
        .addTo(this.capaPuntosControl);
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

  /** Agrega la bandera verde (salida) o a cuadros (final) sobre una parada. */
  private agregarBandera(
    L: LeafletModule,
    parada: Parada,
    recorridoId: number,
    tipo: 'salida' | 'final',
    secundario: boolean,
  ): void {
    if (!this.capaBanderas) return;

    const svg = tipo === 'salida' ? SVG_BANDERA_SALIDA : SVG_BANDERA_FINAL;

    const icono = L.divIcon({
      className: 'bandera-marker-wrapper',
      html: `<span class="bandera-marker bandera-marker--${tipo}${secundario ? ' bandera-marker--secundario' : ''}">${svg}</span>`,
      iconSize: [LADO_BANDERA, LADO_BANDERA],
      // El mástil se planta sobre el borde derecho de la parada: la bandera
      // queda al costado del número sin taparlo.
      iconAnchor: [-9, 23],
    });

    L.marker([parada.latitud, parada.longitud], { icon: icono, keyboard: false })
      .bindPopup(this.crearPopupParada(parada, recorridoId))
      .addTo(this.capaBanderas);
  }

  /**
   * Popup de la parada. Se arma con DOM (`textContent`) en vez de HTML para no
   * interpolar los nombres de calle que vienen del proveedor de datos.
   */
  private crearPopupParada(
    parada: Parada,
    recorridoId: number,
    conAccion = true,
  ): HTMLElement {
    const raiz = document.createElement('div');
    raiz.className = 'popup-parada';

    const nombre = document.createElement('strong');
    nombre.className = 'popup-parada__nombre';
    nombre.textContent = parada.nombreCalle;
    raiz.appendChild(nombre);

    if (parada.codigoParada) {
      const codigo = document.createElement('span');
      codigo.className = 'popup-parada__codigo';
      codigo.textContent = parada.codigoParada;
      raiz.appendChild(codigo);
    }

    if (conAccion) {
      raiz.appendChild(this.crearBotonAccion('Punto de control', recorridoId, parada.id));
    }

    return raiz;
  }

  /** Popup del punto de control: nombre de la parada, ícono asignado y acceso al editor. */
  private crearPopupPuntoControl(
    parada: Parada,
    recorridoId: number,
    iconoId: string,
  ): HTMLElement {
    const raiz = document.createElement('div');
    raiz.className = 'popup-parada';

    const nombre = document.createElement('strong');
    nombre.className = 'popup-parada__nombre';
    nombre.textContent = parada.nombreCalle;
    raiz.appendChild(nombre);

    const etiqueta = document.createElement('span');
    etiqueta.className = 'popup-parada__codigo';
    etiqueta.textContent = buscarIconoControl(iconoId)?.nombre ?? 'Punto de control';
    raiz.appendChild(etiqueta);

    raiz.appendChild(this.crearBotonAccion('Editar punto de control', recorridoId, parada.id));

    return raiz;
  }

  private crearBotonAccion(
    texto: string,
    recorridoId: number,
    paradaId: number,
  ): HTMLButtonElement {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'popup-parada__accion';
    boton.dataset['accion'] = 'control-point';
    boton.dataset['recorridoId'] = String(recorridoId);
    boton.dataset['paradaId'] = String(paradaId);
    boton.textContent = texto;
    return boton;
  }

  /** Delega el click del botón del popup al consumidor del mapa. */
  private escucharAccionesPopup(): void {
    this.mapa?.on('popupopen', (event) => {
      const elemento = event.popup.getElement();
      if (!elemento) return;

      const boton = elemento.querySelector<HTMLButtonElement>(
        'button[data-accion="control-point"]',
      );
      if (!boton || boton.dataset['escuchado'] === '1') return;

      boton.dataset['escuchado'] = '1';
      boton.addEventListener('click', () => {
        const recorridoId = Number(boton.dataset['recorridoId']);
        const paradaId = Number(boton.dataset['paradaId']);

        if (!Number.isFinite(recorridoId) || !Number.isFinite(paradaId)) return;

        this.onPeticionPuntoControl?.(recorridoId, paradaId);
      });
    });
  }

  destruir(): void {
    this.capaRuta?.clearLayers();
    this.capaParadas?.clearLayers();
    this.capaBanderas?.clearLayers();
    this.capaPuntosControl?.clearLayers();
    this.capaUbicacion?.clearLayers();
    this.capaDestino?.clearLayers();
    this.capaParadasDestacadas?.clearLayers();
    this.mapa?.remove();

    this.mapa = null;
    this.capaRuta = null;
    this.capaParadas = null;
    this.capaBanderas = null;
    this.capaPuntosControl = null;
    this.capaUbicacion = null;
    this.capaDestino = null;
    this.capaParadasDestacadas = null;
    this.leaflet = null;
    this.mapaListo.set(false);
  }
}
