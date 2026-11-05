import { TestBed } from '@angular/core/testing';
import { BusquedaService } from './busqueda.service';
import { GeolocationService } from './geolocation.service';
import { SibusApiService } from './sibus-api.service';
import { SibusStateService } from './sibus-state.service';

/** Espera a que se cumpla una condición sobre signals. */
const esperarEstado = async (condicion: () => boolean, timeoutMs = 3000): Promise<void> => {
  const inicio = Date.now();

  while (!condicion()) {
    if (Date.now() - inicio > timeoutMs) {
      throw new Error('Timeout esperando el estado esperado');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe('BusquedaService', () => {
  let busqueda: BusquedaService;
  let estado: SibusStateService;
  let api: SibusApiService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    api = TestBed.inject(SibusApiService);
    await api.precargar();

    busqueda = TestBed.inject(BusquedaService);
    estado = TestBed.inject(SibusStateService);
    await esperarEstado(() => estado.lineaSeleccionada() !== null);
  });

  /** Elige como destino la primera parada del recorrido 1 (línea 30, IDA). */
  const destinoEnParadaDeLinea30 = (): void => {
    const recorrido = api.datosInmediatos()?.recorridos.find((item) => item.id === 1);
    const parada = recorrido?.paradas[0];

    expect(parada).toBeDefined();

    busqueda.seleccionar({
      id: `parada-${parada?.id}`,
      etiqueta: parada?.nombreCalle ?? '',
      latitud: parada?.latitud ?? 0,
      longitud: parada?.longitud ?? 0,
      origen: 'parada',
      parada,
    });
  };

  it('analiza las 21 líneas del servicio para un destino', () => {
    destinoEnParadaDeLinea30();

    const analisis = busqueda.analisis();

    expect(analisis).not.toBeNull();
    expect(analisis?.lineas.length).toBe(21);
    expect(analisis?.destino.etiqueta).toContain('Univ');
  });

  it('detecta que la línea 30 pasa por el destino', () => {
    destinoEnParadaDeLinea30();

    const linea30 = busqueda
      .analisis()
      ?.lineas.find((item) => item.linea.codigo === '30');

    expect(linea30).toBeDefined();
    expect(linea30?.veredicto).toBe('pasa');
    expect(linea30?.distanciaTraza).toBeLessThan(60);
  });

  it('señala la parada por la que conviene subirse', () => {
    destinoEnParadaDeLinea30();

    const linea30 = busqueda
      .analisis()
      ?.lineas.find((item) => item.linea.codigo === '30');

    expect(linea30?.paradaCercana.nombreCalle).toContain('Univ');
    expect(linea30?.distanciaParada).toBeLessThan(60);
    expect(linea30?.minutosCaminata).toBeGreaterThanOrEqual(0);
  });

  it('pone la línea activa al principio del ranking', async () => {
    const linea31 = estado.lineas().find((item) => item.codigo === '31');
    estado.seleccionarLinea(linea31!);

    destinoEnParadaDeLinea30();

    const analisis = busqueda.analisis();

    expect(analisis?.lineas[0].linea.codigo).toBe('31');
    expect(analisis?.lineaActiva?.linea.codigo).toBe('31');
  });

  it('ordena el resto de las líneas por cercanía al destino', () => {
    destinoEnParadaDeLinea30();

    const lineas = busqueda.analisis()?.lineas ?? [];

    for (let i = 1; i < lineas.length; i++) {
      const anterior = lineas[i - 1];
      const actual = lineas[i];

      // La línea activa puede estar fuera de orden: el resto va de más a menos cerca.
      if (anterior.linea.id === busqueda.analisis()?.lineaActiva?.linea.id) continue;

      expect(actual.distanciaTraza).toBeGreaterThanOrEqual(anterior.distanciaTraza - 1);
    }
  });

  it('aplica la línea elegida y enfoca la parada de subida', () => {
    destinoEnParadaDeLinea30();

    const linea82 = busqueda.analisis()?.lineas.find((item) => item.linea.codigo === '82');
    expect(linea82).toBeDefined();

    busqueda.elegirLinea(linea82!);

    expect(estado.lineaSeleccionada()?.codigo).toBe('82');
    expect(estado.sentidoActivo()).toBe(linea82!.sentido);
  });

  it('busca sugerencias locales mientras el usuario escribe', () => {
    busqueda.consultar('fragueiro');

    expect(busqueda.consulta()).toBe('fragueiro');
    expect(busqueda.sugerenciasLocales().length).toBeGreaterThan(0);
    expect(busqueda.sugerencias().length).toBeGreaterThan(0);
  });

  it('limpia la búsqueda y el destino', () => {
    destinoEnParadaDeLinea30();
    busqueda.consultar('fragueiro');

    busqueda.limpiar();

    expect(busqueda.destino()).toBeNull();
    expect(busqueda.consulta()).toBe('');
    expect(busqueda.sugerenciasLocales()).toEqual([]);
    expect(busqueda.hayDestino()).toBe(false);
  });

  it('usa la posición del pasajero como destino', () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) => {
          ok({
            coords: {
              latitude: -31.4201,
              longitude: -64.1888,
              accuracy: 20,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: 1767225600000,
          } as GeolocationPosition);
        },
      },
    });

    const geolocation = TestBed.inject(GeolocationService);
    geolocation.solicitar();

    busqueda.usarMiUbicacion();

    const destino = busqueda.destino();
    expect(destino?.etiqueta).toBe('Mi ubicación');
    expect(destino?.latitud).toBeCloseTo(-31.4201, 4);
    expect(busqueda.analisis()?.lineas.length).toBe(21);
  });
});
