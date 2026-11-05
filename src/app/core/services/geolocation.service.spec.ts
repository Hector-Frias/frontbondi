import { TestBed } from '@angular/core/testing';
import { GeolocationService } from './geolocation.service';

/** Posición simulada en el centro de Córdoba. */
const POSICION: GeolocationPosition = {
  coords: {
    latitude: -31.4201,
    longitude: -64.1888,
    accuracy: 25,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1767225600000,
} as GeolocationPosition;

/**
 * Instala un `navigator.geolocation` falso que responde como el navegador:
 * llama al callback de éxito o al de error que le pasa el servicio.
 */
function instalarGeolocation(codigoError?: number): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        exito: PositionCallback,
        fallo?: PositionErrorCallback | null,
      ): void => {
        if (codigoError !== undefined) {
          fallo?.({
            code: codigoError,
            message: 'error simulado',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
          return;
        }

        exito(POSICION);
      },
    },
  });
}

/** Deja el navegador sin soporte de geolocalización. */
function quitarGeolocation(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  });
}

describe('GeolocationService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    quitarGeolocation();
  });

  it('expone la posición cuando el navegador responde', () => {
    instalarGeolocation();

    const servicio = TestBed.inject(GeolocationService);
    servicio.solicitar();

    expect(servicio.estado()).toBe('obtenida');
    expect(servicio.posicion()?.latitud).toBeCloseTo(-31.4201, 4);
    expect(servicio.posicion()?.longitud).toBeCloseTo(-64.1888, 4);
    expect(servicio.posicion()?.precision).toBe(25);
    expect(servicio.hayPosicion()).toBe(true);
    expect(servicio.error()).toBeNull();
  });

  it('informa el permiso denegado', () => {
    instalarGeolocation(1);

    const servicio = TestBed.inject(GeolocationService);
    servicio.solicitar();

    expect(servicio.estado()).toBe('error');
    expect(servicio.error()).toContain('Permiso');
    expect(servicio.posicion()).toBeNull();
  });

  it('informa que la posición no está disponible', () => {
    instalarGeolocation(2);

    const servicio = TestBed.inject(GeolocationService);
    servicio.solicitar();

    expect(servicio.estado()).toBe('error');
    expect(servicio.error()).toContain('posición');
  });

  it('avisa cuando el navegador no soporta la geolocalización', () => {
    quitarGeolocation();

    const servicio = TestBed.inject(GeolocationService);
    servicio.solicitar();

    expect(servicio.estado()).toBe('error');
    expect(servicio.error()).toContain('no permite');
  });

  it('olvida la posición cuando se limpia', () => {
    instalarGeolocation();

    const servicio = TestBed.inject(GeolocationService);
    servicio.solicitar();
    expect(servicio.hayPosicion()).toBe(true);

    servicio.limpiar();

    expect(servicio.hayPosicion()).toBe(false);
    expect(servicio.estado()).toBe('inactivo');
  });
});
