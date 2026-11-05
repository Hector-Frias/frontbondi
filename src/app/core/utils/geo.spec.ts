import {
  distanciaHaversine,
  distanciaMinimaARecorrido,
  distanciaPuntoSegmento,
  formatearDistancia,
  formatearTiempoCaminata,
  indiceVerticeMasCercano,
  tiempoCaminata,
} from './geo';

const CORDOBA: [number, number] = [-31.4201, -64.1888];

describe('utilidades geodésicas', () => {
  describe('distanciaHaversine', () => {
    it('devuelve cero para el mismo punto', () => {
      expect(distanciaHaversine({ latitud: CORDOBA[0], longitud: CORDOBA[1] }, {
        latitud: CORDOBA[0],
        longitud: CORDOBA[1],
      })).toBeCloseTo(0, 6);
    });

    it('calcula la distancia de una milla aproximadamente', () => {
      // Un grado de latitud a la altura de Córdoba son unos 111 km.
      const distancia = distanciaHaversine(
        { latitud: -31.4201, longitud: -64.1888 },
        { latitud: -30.4201, longitud: -64.1888 },
      );

      expect(distancia).toBeGreaterThan(110000);
      expect(distancia).toBeLessThan(112000);
    });

    it('es simétrica', () => {
      const a = { latitud: -31.4201, longitud: -64.1888 };
      const b = { latitud: -31.4357, longitud: -64.1951 };

      expect(distanciaHaversine(a, b)).toBeCloseTo(distanciaHaversine(b, a), 6);
    });
  });

  describe('distanciaPuntoSegmento', () => {
    it('mide la distancia perpendicular al segmento', () => {
      // Segmento de este a oeste y punto desplazado al norte del medio.
      const a = { latitud: -31.42, longitud: -64.19 };
      const b = { latitud: -31.42, longitud: -64.18 };
      const punto = { latitud: -31.4191, longitud: -64.185 };

      const distancia = distanciaPuntoSegmento(punto, a, b);

      // 0,0009 grados de latitud, unos 100 m.
      expect(distancia).toBeGreaterThan(95);
      expect(distancia).toBeLessThan(105);
    });

    it('acota la proyección a los extremos del segmento', () => {
      const a = { latitud: -31.42, longitud: -64.19 };
      const b = { latitud: -31.43, longitud: -64.19 };
      const punto = { latitud: -31.44, longitud: -64.19 };

      const distancia = distanciaPuntoSegmento(punto, a, b);

      // El punto quedó más allá del extremo B: la distancia es la de ese extremo.
      expect(distancia).toBeCloseTo(distanciaHaversine(punto, b), 0);
    });

    it('no falla con un segmento degenerado', () => {
      const a = { latitud: -31.42, longitud: -64.19 };
      const punto = { latitud: -31.43, longitud: -64.19 };

      const distancia = distanciaPuntoSegmento(punto, a, a);

      expect(distancia).toBeCloseTo(distanciaHaversine(punto, a), 0);
      expect(distancia).toBeGreaterThan(1100);
      expect(distancia).toBeLessThan(1120);
    });
  });

  describe('distanciaMinimaARecorrido', () => {
    it('encuentra la distancia al vértice más cercano y su índice', () => {
      const ruta: [number, number][] = [
        [-31.42, -64.19],
        [-31.43, -64.19],
        [-31.44, -64.19],
      ];

      const resultado = distanciaMinimaARecorrido({ latitud: -31.428, longitud: -64.19 }, ruta);

      expect(resultado.distancia).toBeLessThan(60);
      expect(resultado.indice).toBe(1);
    });

    it('devuelve infinito con una polilínea vacía', () => {
      const resultado = distanciaMinimaARecorrido({ latitud: -31.42, longitud: -64.19 }, []);

      expect(resultado.distancia).toBe(Number.POSITIVE_INFINITY);
      expect(resultado.indice).toBe(-1);
    });
  });

  describe('indiceVerticeMasCercano', () => {
    it('devuelve el índice del vértice más próximo', () => {
      const ruta: [number, number][] = [
        [-31.42, -64.19],
        [-31.43, -64.19],
        [-31.44, -64.19],
      ];

      expect(indiceVerticeMasCercano({ latitud: -31.439, longitud: -64.19 }, ruta)).toBe(2);
      expect(indiceVerticeMasCercano({ latitud: -31.421, longitud: -64.19 }, ruta)).toBe(0);
    });
  });

  describe('formato', () => {
    it('muestra los metros por debajo del kilómetro', () => {
      expect(formatearDistancia(0)).toBe('0 m');
      expect(formatearDistancia(120)).toBe('120 m');
      expect(formatearDistancia(999)).toBe('999 m');
    });

    it('muestra los kilómetros con un decimal', () => {
      expect(formatearDistancia(1000)).toBe('1,0 km');
      expect(formatearDistancia(1460)).toBe('1,5 km');
    });

    it('devuelve un guion para distancias inválidas', () => {
      expect(formatearDistancia(Number.POSITIVE_INFINITY)).toBe('—');
    });

    it('estima el tiempo de caminata', () => {
      expect(tiempoCaminata(120)).toBe(2);
      expect(tiempoCaminata(600)).toBe(8);
      expect(tiempoCaminata(0)).toBe(0);
      expect(formatearTiempoCaminata(600)).toBe('8 min');
      expect(formatearTiempoCaminata(4000)).toBe('53 min');
    });
  });
});
