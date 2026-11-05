import { TestBed } from '@angular/core/testing';
import { GeocodingService } from './geocoding.service';
import { SibusApiService } from './sibus-api.service';

const FETCH_ORIGINAL = globalThis.fetch;

describe('GeocodingService', () => {
  let servicio: GeocodingService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    await TestBed.inject(SibusApiService).precargar();
    servicio = TestBed.inject(GeocodingService);
  });

  afterEach(() => {
    globalThis.fetch = FETCH_ORIGINAL;
  });

  describe('búsqueda local', () => {
    it('encuentra paradas por nombre sin distinguir mayúsculas ni acentos', () => {
      const resultados = servicio.buscarLocal('fragueiro');

      expect(resultados.length).toBeGreaterThan(0);
      expect(
        resultados.every((item) =>
          item.etiqueta.toLowerCase().includes('fragueiro'),
        ),
      ).toBe(true);
    });

    it('encuentra la parada aunque se escriba con acentos distintos', () => {
      const conAcento = servicio.buscarLocal('Vélez Sarsfield');
      const sinAcento = servicio.buscarLocal('Velez Sarsfield');

      expect(conAcento.length).toBeGreaterThan(0);
      expect(sinAcento.length).toBeGreaterThan(0);
      expect(sinAcento[0].etiqueta).toBe(conAcento[0].etiqueta);
    });

    it('devuelve las paradas con su línea y su código', () => {
      const resultados = servicio.buscarLocal('Univ. Católica');

      expect(resultados.length).toBeGreaterThan(0);
      expect(resultados[0].origen).toBe('parada');
      expect(resultados[0].parada).toBeDefined();
      expect(resultados[0].detalle).toContain('Línea');
    });

    it('busca por código de parada', () => {
      const datos = TestBed.inject(SibusApiService).datosInmediatos();
      const codigo = datos?.recorridos[0].paradas.find((p) => p.codigoParada)?.codigoParada;

      expect(codigo).toBeTruthy();

      const resultados = servicio.buscarLocal(codigo ?? '');

      expect(resultados.length).toBeGreaterThan(0);
      expect(resultados[0].etiqueta).toBeTruthy();
    });

    it('no devuelve nada para un texto sin coincidencias', () => {
      expect(servicio.buscarLocal('zzzzzqqqq')).toEqual([]);
    });

    it('no devuelve nada para una consulta vacía', () => {
      expect(servicio.buscarLocal('   ')).toEqual([]);
    });
  });

  describe('búsqueda remota', () => {
    it('consulta Nominatim con los parámetros esperados', async () => {
      let urlConsultada = '';

      globalThis.fetch = (async (url: string | URL | Request) => {
        urlConsultada = String(url);
        return { ok: true, json: async () => [] } as Response;
      }) as unknown as typeof fetch;

      await servicio.buscarRemoto('Plaza San Martin');

      expect(urlConsultada).toContain('nominatim.openstreetmap.org/search');
      expect(urlConsultada).toContain('format=jsonv2');
      expect(urlConsultada).toContain('countrycodes=ar');
      expect(urlConsultada).toContain('q=Plaza+San+Martin');
    });

    it('traduce la respuesta de Nominatim en sugerencias', async () => {
      globalThis.fetch = (async () =>
        ({
          ok: true,
          json: async () => [
            {
              place_id: 999,
              lat: '-31.4201',
              lon: '-64.1888',
              name: 'Plaza San Martín',
              display_name: 'Plaza San Martín, Centro, Córdoba, Argentina',
              address: {
                road: 'Plaza San Martín',
                neighbourhood: 'Centro',
                city: 'Córdoba',
              },
            },
          ],
        }) as Response) as unknown as typeof fetch;

      const resultados = await servicio.buscarRemoto('Plaza San Martin');

      expect(resultados.length).toBe(1);
      expect(resultados[0].etiqueta).toBe('Plaza San Martín');
      expect(resultados[0].detalle).toContain('Centro');
      expect(resultados[0].origen).toBe('lugar');
      expect(resultados[0].latitud).toBeCloseTo(-31.4201, 4);
    });

    it('no consulta Nominatim con menos de tres caracteres', async () => {
      let consultada = false;

      globalThis.fetch = (async () => {
        consultada = true;
        return { ok: true, json: async () => [] } as Response;
      }) as unknown as typeof fetch;

      const resultados = await servicio.buscarRemoto('av');

      expect(resultados).toEqual([]);
      expect(consultada).toBe(false);
    });

    it('devuelve una lista vacía si la red falla', async () => {
      globalThis.fetch = (async () => {
        throw new Error('sin red');
      }) as unknown as typeof fetch;

      const resultados = await servicio.buscarRemoto('Plaza San Martin');

      expect(resultados).toEqual([]);
    });
  });
});
