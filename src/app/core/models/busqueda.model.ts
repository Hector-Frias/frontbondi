import { Linea, Parada, SentidoRecorrido } from './sibus.model';

/** Origen de la sugerencia: una parada del dataset local o un resultado de Nominatim. */
export type OrigenSugerencia = 'parada' | 'lugar';

/** Sugerencia mostrada en el desplegable del buscador. */
export interface SugerenciaUbicacion {
  id: string;
  etiqueta: string;
  detalle?: string;
  latitud: number;
  longitud: number;
  origen: OrigenSugerencia;
  /** Parada del dataset cuando la sugerencia viene del catálogo local. */
  parada?: Parada;
  /** Línea a la que pertenece la parada, cuando la sugerencia es una parada. */
  linea?: Linea;
}

/** Destino elegido por el usuario. */
export interface Destino {
  id: string;
  etiqueta: string;
  latitud: number;
  longitud: number;
  origen: OrigenSugerencia;
  parada?: Parada;
  linea?: Linea;
}

/** Veredicto de una línea respecto del destino. */
export type VeredictoLinea = 'pasa' | 'cerca' | 'lejos';

/** Cómo queda la parada de subida respecto del destino. */
export type PosicionParada = 'antes' | 'despues' | 'igual';

/** Análisis de una línea frente al destino. */
export interface AnalisisLinea {
  linea: Linea;
  /** Sentido del recorrido que mejor sirve para llegar al destino. */
  sentido: SentidoRecorrido;
  /** Recorrido elegido (el más cercano de los dos sentidos). */
  recorridoId: number;
  /** Distancia del destino a la traza del recorrido, en metros. */
  distanciaTraza: number;
  /** Parada por la que conviene subirse. */
  paradaCercana: Parada;
  /** Distancia del destino a esa parada, en metros. */
  distanciaParada: number;
  /** El sentido contrario también sirve (ida y vuelta al mismo lado). */
  sentidoContrarioSirve: boolean;
  veredicto: VeredictoLinea;
  /** Si la parada de subida queda antes o después del destino en el recorrido. */
  posicionParada: PosicionParada;
  /** Minutos de caminata hasta la parada de subida. */
  minutosCaminata: number;
}

/** Resultado completo del análisis de un destino. */
export interface AnalisisDestino {
  destino: Destino;
  /** Todas las líneas ordenadas: la activa primero y después por cercanía. */
  lineas: AnalisisLinea[];
  /** Línea activa, si el destino le sirve. */
  lineaActiva: AnalisisLinea | null;
}
