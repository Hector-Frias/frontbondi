/**
 * Utilidades geodésicas para calcular distancias y proximidad.
 *
 * La escala de trabajo es urbana (Córdoba Capital, recorridos de ~10 km), así que
 * alcanza con una proyección plana local: se proyectan latitud y longitud a metros
 * alrededor del punto de referencia. El error es de pocos centímetros a escala de
 * barrio, que es lo que necesita el usuario para decidir qué línea tomar.
 */

/** Coordenada geodésica en grados. */
export interface Punto {
  latitud: number;
  longitud: number;
}

/** Radio terrestre medio en metros. */
const RADIO_TERRESTRE = 6371008.8;

/** Grados a radianes. */
const GRADOS_A_RADIANES = Math.PI / 180;

/**
 * Metros por grado de latitud en el modelo esférico usado por Haversine.
 * Se usa el mismo modelo en la proyección local para que las dos formas de
 * medir no difieran entre sí.
 */
const METROS_POR_GRADO = (2 * Math.PI * RADIO_TERRESTRE) / 360;

/** Velocidad de caminata promedio en m/s (4,5 km/h). */
const VELOCIDAD_CAMINATA = 1.25;

/**
 * Distancia entre dos puntos en metros (fórmula de Haversine).
 */
export function distanciaHaversine(a: Punto, b: Punto): number {
  const lat1 = a.latitud * GRADOS_A_RADIANES;
  const lat2 = b.latitud * GRADOS_A_RADIANES;
  const deltaLat = (b.latitud - a.latitud) * GRADOS_A_RADIANES;
  const deltaLng = (b.longitud - a.longitud) * GRADOS_A_RADIANES;

  const senoLat = Math.sin(deltaLat / 2);
  const senoLng = Math.sin(deltaLng / 2);

  const h = senoLat * senoLat + Math.cos(lat1) * Math.cos(lat2) * senoLng * senoLng;

  return 2 * RADIO_TERRESTRE * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Proyecta un punto a un plano local en metros, con el origen en la referencia.
 * La longitud se corrige con el coseno de la latitud para no deformar las distancias.
 */
function proyectar(punto: Punto, referencia: Punto): [number, number] {
  const metrosPorGradoLng = METROS_POR_GRADO * Math.cos(referencia.latitud * GRADOS_A_RADIANES);

  return [
    (punto.longitud - referencia.longitud) * metrosPorGradoLng,
    (punto.latitud - referencia.latitud) * METROS_POR_GRADO,
  ];
}

/**
 * Distancia de un punto a un segmento en metros, con la proyección local.
 */
export function distanciaPuntoSegmento(punto: Punto, a: Punto, b: Punto): number {
  const [px, py] = proyectar(punto, punto);
  const [ax, ay] = proyectar(a, punto);
  const [bx, by] = proyectar(b, punto);

  const dx = bx - ax;
  const dy = by - ay;

  const largoCuadrado = dx * dx + dy * dy;

  // Segmento degenerado: la distancia es al propio extremo.
  if (largoCuadrado === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  // Proyección del punto sobre el segmento, acotada a [0, 1].
  let t = ((px - ax) * dx + (py - ay) * dy) / largoCuadrado;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Índice del vértice de la polilínea más cercano al punto.
 *
 * Sirve para saber si una parada de subida queda antes o después del destino en el
 * recorrido: si el índice de la parada es menor que el del destino, el colectivo
 * sigue de largo y deja al pasajero más adelante (y viceversa).
 */
export function indiceVerticeMasCercano(punto: Punto, coordenadas: [number, number][]): number {
  let mejorDistancia = Number.POSITIVE_INFINITY;
  let mejorIndice = -1;

  for (let i = 0; i < coordenadas.length; i++) {
    const distancia = distanciaHaversine(punto, {
      latitud: coordenadas[i][0],
      longitud: coordenadas[i][1],
    });

    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejorIndice = i;
    }
  }

  return mejorIndice;
}

/**
 * Distancia mínima de un punto a una polilínea y el índice del vértice más cercano.
 */
export function distanciaMinimaARecorrido(
  punto: Punto,
  coordenadas: [number, number][],
): { distancia: number; indice: number } {
  if (coordenadas.length === 0) {
    return { distancia: Number.POSITIVE_INFINITY, indice: -1 };
  }

  let mejorDistancia = Number.POSITIVE_INFINITY;

  for (let i = 1; i < coordenadas.length; i++) {
    const distancia = distanciaPuntoSegmento(
      punto,
      { latitud: coordenadas[i - 1][0], longitud: coordenadas[i - 1][1] },
      { latitud: coordenadas[i][0], longitud: coordenadas[i][1] },
    );

    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
    }
  }

  return {
    distancia: mejorDistancia,
    indice: indiceVerticeMasCercano(punto, coordenadas),
  };
}

/**
 * Formatea una distancia en metros para la interfaz.
 * Menos de un kilómetro va en metros; a partir de ahí, en kilómetros con un decimal.
 */
export function formatearDistancia(metros: number): string {
  if (!Number.isFinite(metros)) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Tiempo estimado de caminata en minutos (4,5 km/h).
 */
export function tiempoCaminata(metros: number): number {
  if (!Number.isFinite(metros) || metros <= 0) return 0;
  return Math.max(1, Math.round(metros / VELOCIDAD_CAMINATA / 60));
}

/**
 * Formatea el tiempo de caminata como texto ("4 min", "1 h 10 min").
 */
export function formatearTiempoCaminata(metros: number): string {
  const minutos = tiempoCaminata(metros);
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
