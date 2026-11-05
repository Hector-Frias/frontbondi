/**
 * Anotación del usuario sobre una parada: la convierte en "punto de control"
 * con un ícono propio. No reemplaza ni modifica la parada, se agrega encima.
 */
export interface PuntoControl {
  id: string;
  /** Línea (colectivo) a la que pertenece el punto de control. */
  lineaId: number;
  /** Recorrido (línea + sentido) al que pertenece la parada anotada. */
  recorridoId: number;
  paradaId: number;
  /** Clave de la paleta de íconos (ver `data/iconos-control.ts`). */
  iconoId: string;
  creadoEn: string;
}

/** Ícono de la paleta disponible para los puntos de control. */
export interface IconoControl {
  id: string;
  nombre: string;
  /** SVG inline (24x24). El color lo define el `color` del ícono. */
  svg: string;
  color: string;
}
