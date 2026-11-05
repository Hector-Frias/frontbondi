import { IconoControl } from '../models';

/**
 * Paleta de íconos para los puntos de control.
 *
 * Son SVG inline de 24x24 con `stroke="currentColor"`: el color real lo aplica
 * el contenedor (`--anotacion-color` en el mapa, `color` en la paleta de la app),
 * así el mismo ícono sirve para el marcador del mapa y para la grilla del selector.
 */
const svg = (contenido: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenido}</svg>`;

export const ICONOS_CONTROL: readonly IconoControl[] = [
  {
    id: 'alerta',
    nombre: 'Alerta',
    color: '#f59e0b',
    svg: svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  },
  {
    id: 'info',
    nombre: 'Información',
    color: '#0ea5e9',
    svg: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  },
  {
    id: 'estrella',
    nombre: 'Estrella',
    color: '#eab308',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.5 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.06 1.11-6.46-4.7-4.58 6.49-.94z"/></svg>`,
  },
  {
    id: 'verificado',
    nombre: 'Verificado',
    color: '#14b8a6',
    svg: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  },
  {
    id: 'hospital',
    nombre: 'Hospital',
    color: '#ef4444',
    svg: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8"/><path d="M8 12h8"/>'),
  },
  {
    id: 'escuela',
    nombre: 'Escuela',
    color: '#3b82f6',
    svg: svg('<path d="m12 3 10 5-10 5L2 8z"/><path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5"/>'),
  },
  {
    id: 'mercado',
    nombre: 'Mercado',
    color: '#8b5cf6',
    svg: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  },
  {
    id: 'banco',
    nombre: 'Banco',
    color: '#64748b',
    svg: svg('<path d="M3 21h18"/><path d="M4 10v8"/><path d="M9 10v8"/><path d="M15 10v8"/><path d="M20 10v8"/><path d="M2 10 12 3l10 7z"/>'),
  },
  {
    id: 'reloj',
    nombre: 'Horario',
    color: '#6366f1',
    svg: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  },
  {
    id: 'colectivo',
    nombre: 'Colectivo',
    color: '#0284c7',
    svg: svg('<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 20v-4"/><path d="M17 20v-4"/><path d="M7 16h.01"/><path d="M17 16h.01"/>'),
  },
  {
    id: 'prohibido',
    nombre: 'Prohibido',
    color: '#dc2626',
    svg: svg('<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>'),
  },
  {
    id: 'favorito',
    nombre: 'Favorito',
    color: '#ec4899',
    svg: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  },
];

/** Bandera verde: marca la primera parada del recorrido (sale el colectivo). */
export const SVG_BANDERA_SALIDA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/><path d="M5 4h12.5l-2.75 4.5L17.5 13H5z" fill="#22c55e" stroke="#15803d" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

/** Bandera a cuadros: marca la última parada del recorrido (finaliza el trayecto). */
export const SVG_BANDERA_FINAL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/><rect x="7" y="3" width="12" height="12" fill="#111827"/><g fill="#ffffff"><rect x="10" y="3" width="3" height="3"/><rect x="7" y="6" width="3" height="3"/><rect x="13" y="6" width="3" height="3"/><rect x="16" y="3" width="3" height="3"/><rect x="10" y="9" width="3" height="3"/><rect x="7" y="12" width="3" height="3"/><rect x="16" y="9" width="3" height="3"/><rect x="13" y="12" width="3" height="3"/></g></svg>`;

/** Bandera neutra: botón para agregar un punto de control cuando todavía no hay. */
export const SVG_BANDERA_NEUTRA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 5h12l-2.5 4L17 13H5z"/></svg>`;

const ICONOS_POR_ID = new Map(ICONOS_CONTROL.map((icono) => [icono.id, icono]));

export function buscarIconoControl(iconoId: string): IconoControl | undefined {
  return ICONOS_POR_ID.get(iconoId);
}
