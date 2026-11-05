import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

/** Posición del pasajero. */
export interface Posicion {
  latitud: number;
  longitud: number;
  /** Precisión reportada por el navegador, en metros. */
  precision: number;
  /** Momento de la lectura (epoch en ms). */
  timestamp: number;
}

/** Estado del permiso y de la lectura de la posición. */
export type EstadoUbicacion = 'inactivo' | 'solicitando' | 'obtenida' | 'error';

const TIEMPO_LIMITE_MS = 10000;
const MAXIMA_ANTIGUEDAD_MS = 30000;

/**
 * Ubicación del pasajero (`navigator.geolocation`).
 *
 * El permiso se pide recién cuando el usuario toca el botón "Mi ubicación": así
 * el navegador no interrumpe al abrir la app y el usuario entiende por qué se
 * pide. La lectura es puntual (no seguimiento continuo) porque el caso de uso es
 * decidir qué línea tomar desde donde está parado.
 *
 * La API exige contexto seguro (HTTPS o localhost): en producción el proxy tiene
 * que terminar TLS.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly estadoInterno = signal<EstadoUbicacion>('inactivo');
  private readonly posicionInterna = signal<Posicion | null>(null);
  private readonly errorInterno = signal<string | null>(null);

  readonly estado = this.estadoInterno.asReadonly();
  readonly posicion = this.posicionInterna.asReadonly();
  readonly error = this.errorInterno.asReadonly();

  /** Hay una posición conocida: se puede usar como origen de la búsqueda. */
  readonly hayPosicion = computed(() => this.posicionInterna() !== null);

  /** La app puede pedir permisos de ubicación (no estamos en SSR). */
  readonly disponible = computed(() => isPlatformBrowser(this.platformId) && this.soportado());

  /**
   * Pide la posición al navegador. No hace nada si ya se conoce una posición
   * muy reciente o si el permiso ya fue denegado en esta sesión.
   */
  solicitar(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.soportado()) {
      this.estadoInterno.set('error');
      this.errorInterno.set('Este navegador no permite compartir la ubicación.');
      return;
    }

    const actual = this.posicionInterna();
    if (actual && Date.now() - actual.timestamp < MAXIMA_ANTIGUEDAD_MS) {
      return;
    }

    this.estadoInterno.set('solicitando');
    this.errorInterno.set(null);

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        this.posicionInterna.set({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precision: posicion.coords.accuracy,
          timestamp: posicion.timestamp,
        });
        this.estadoInterno.set('obtenida');
      },
      (fallo) => {
        this.estadoInterno.set('error');
        this.errorInterno.set(this.mensajeDeError(fallo));
      },
      {
        enableHighAccuracy: true,
        timeout: TIEMPO_LIMITE_MS,
        maximumAge: MAXIMA_ANTIGUEDAD_MS,
      },
    );
  }

  /** Olvida la posición conocida (el mapa deja de mostrar el marcador). */
  limpiar(): void {
    this.posicionInterna.set(null);
    this.estadoInterno.set('inactivo');
    this.errorInterno.set(null);
  }

  private soportado(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.geolocation === 'object' &&
      navigator.geolocation !== null
    );
  }

  private mensajeDeError(fallo: GeolocationPositionError): string {
    switch (fallo.code) {
      case 1:
        return 'Permiso de ubicación denegado. Habilitalo en el navegador para usar esta función.';
      case 2:
        return 'No se pudo determinar tu posición. Probá de nuevo en un lugar con señal.';
      case 3:
        return 'La ubicación tardó demasiado. Probá de nuevo.';
      default:
        return 'No se pudo obtener tu ubicación.';
    }
  }
}
