export interface Linea {
  id: number;
  codigo: string; // ej: "30", "82", "A1"
  nombre: string; // ej: "Línea 30"
  corredor: string; // ej: "Corredor 3"
  colorHex: string; // ej: "#0284c7"
  activo: boolean;
}

export interface Parada {
  id: number;
  codigoParada?: string;
  nombreCalle: string;
  latitud: number;
  longitud: number;
  orden: number;
}

export type SentidoRecorrido = 'IDA' | 'VUELTA';

export interface RecorridoDetalle {
  id: number;
  lineaId: number;
  sentido: SentidoRecorrido;
  origen: string;
  destino: string;
  coordenadasRuta: [number, number][]; // Array ordenado de [lat, lng]
  paradas: Parada[];
}

/** Recorrido que se dibuja en el mapa, con el color que lo representa. */
export interface RecorridoVisible {
  recorrido: RecorridoDetalle;
  colorHex: string;
  secundario: boolean;
}
