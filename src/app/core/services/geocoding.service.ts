import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Linea, Parada, SugerenciaUbicacion } from '../models';
import { SibusApiService } from './sibus-api.service';

/** Endpoint de búsqueda de OpenStreetMap (Nominatim). */
const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/** Parámetros de la consulta: formato, idioma, alcance y límite de resultados. */
const PARAMETROS_NOMINATIM = {
  format: 'jsonv2',
  limit: '8',
  addressdetails: '1',
  'accept-language': 'es',
  countrycodes: 'ar',
  viewbox: '-64.30,-31.52,-64.08,-31.30',
};

/** Caracteres mínimos para pegarse a Nominatim (evita consultas demasiado amplias). */
const CARACTERES_MINIMOS = 3;

/** Máximo de sugerencias locales devueltas por una búsqueda. */
const MAXIMO_SUGERENCIAS_LOCALES = 6;

/** Máximo de sugerencias remotas devueltas por una búsqueda. */
const MAXIMO_SUGERENCIAS_REMOTAS = 8;

/** Parada única del catálogo, con las líneas que la sirven. */
interface ParadaIndexada {
  parada: Parada;
  lineas: Linea[];
  nombreNormalizado: string;
  codigoNormalizado: string;
}

interface RespuestaNominatim {
  place_id?: number;
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

/**
 * Geocodificación de direcciones y lugares.
 *
 * Dos fuentes complementarias:
 *
 * - **Local**: las paradas del dataset ya descargado. Responde al instante y
 *   funciona sin conexión, aunque solo encuentra direcciones que son paradas.
 * - **Remoto**: Nominatim (OpenStreetMap), que resuelve direcciones y lugares
 *   arbitrarios. Su política de uso limita a una consulta por segundo, así que
 *   el servicio aborta la consulta anterior cuando llega una nueva y cachea los
 *   resultados ya resueltos.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(SibusApiService);

  /** Índice de paradas únicas del catálogo, armado una sola vez. */
  private indice: ParadaIndexada[] | null = null;

  /** Cache de consultas remotas ya resueltas. */
  private readonly cache = new Map<string, SugerenciaUbicacion[]>();

  /**
   * Busca paradas del catálogo local que coincidan con la consulta.
   * Es sincrónico: el dataset ya está descargado por el inicializador de la app.
   */
  buscarLocal(consulta: string, limite = MAXIMO_SUGERENCIAS_LOCALES): SugerenciaUbicacion[] {
    const indice = this.indiceParadas();
    const texto = normalizar(consulta);

    if (!texto || indice.length === 0) return [];

    const coincidencias: { sugerencia: SugerenciaUbicacion; rango: number }[] = [];

    for (const item of indice) {
      let rango = -1;

      if (item.codigoNormalizado && item.codigoNormalizado === texto) {
        rango = 0;
      } else if (item.nombreNormalizado.startsWith(texto)) {
        rango = 1;
      } else if (empiezaConPalabra(item.nombreNormalizado, texto)) {
        rango = 2;
      } else if (item.nombreNormalizado.includes(texto)) {
        rango = 3;
      } else if (item.codigoNormalizado.includes(texto)) {
        rango = 4;
      }

      if (rango < 0) continue;

      coincidencias.push({ sugerencia: this.aSugerencia(item), rango });
    }

    coincidencias.sort(
      (a, b) =>
        a.rango - b.rango ||
        a.sugerencia.etiqueta.length - b.sugerencia.etiqueta.length ||
        a.sugerencia.id.localeCompare(b.sugerencia.id),
    );

    return coincidencias.slice(0, limite).map((item) => item.sugerencia);
  }

  /**
   * Consulta Nominatim. Devuelve una lista vacía si el texto es demasiado corto,
   * si la app corre en el servidor o si la consulta falla.
   */
  async buscarRemoto(consulta: string, signal?: AbortSignal): Promise<SugerenciaUbicacion[]> {
    if (!isPlatformBrowser(this.platformId)) return [];

    const texto = consulta.trim();
    if (texto.length < CARACTERES_MINIMOS) return [];

    const clave = normalizar(texto);
    const enCache = this.cache.get(clave);
    if (enCache) return enCache;

    const parametros = new URLSearchParams({ ...PARAMETROS_NOMINATIM, q: texto });
    const url = `${URL_NOMINATIM}?${parametros.toString()}`;

    try {
      const respuesta = await fetch(url, {
        signal: signal ?? null,
        headers: { Accept: 'application/json' },
      });

      if (!respuesta.ok) return [];

      const datos = (await respuesta.json()) as RespuestaNominatim[];
      if (!Array.isArray(datos)) return [];

      const sugerencias = datos
        .map((item) => this.aSugerenciaRemota(item))
        .filter((item): item is SugerenciaUbicacion => item !== null)
        .slice(0, MAXIMO_SUGERENCIAS_REMOTAS);

      this.cache.set(clave, sugerencias);

      return sugerencias;
    } catch {
      // Consulta cancelada o red caída: el buscador sigue con las paradas locales.
      return [];
    }
  }

  private aSugerencia(item: ParadaIndexada): SugerenciaUbicacion {
    const codigos = item.lineas.map((linea) => linea.codigo);

    return {
      id: `parada-${item.parada.id}`,
      etiqueta: item.parada.nombreCalle,
      detalle: codigos.length > 0 ? `Parada · Línea ${codigos.join(', ')}` : 'Parada',
      latitud: item.parada.latitud,
      longitud: item.parada.longitud,
      origen: 'parada',
      parada: item.parada,
      linea: item.lineas[0],
    };
  }

  private aSugerenciaRemota(item: RespuestaNominatim): SugerenciaUbicacion | null {
    const latitud = Number(item.lat);
    const longitud = Number(item.lon);

    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;

    const etiqueta = item.name?.trim() || item.display_name?.split(',')[0]?.trim() || 'Ubicación';
    const detalle = this.detalleDeDireccion(item);

    return {
      id: `lugar-${item.place_id ?? `${latitud},${longitud}`}`,
      etiqueta,
      detalle,
      latitud,
      longitud,
      origen: 'lugar',
    };
  }

  /** Arma el detalle de una dirección con los partes disponibles, en orden de jerarquía. */
  private detalleDeDireccion(item: RespuestaNominatim): string {
    const direccion = item.address ?? {};

    const partes = [
      direccion['house_number']
        ? `${direccion['road'] ?? ''} ${direccion['house_number']}`.trim()
        : direccion['road'],
      direccion['neighbourhood'],
      direccion['suburb'],
      direccion['city'],
    ].filter((parte): parte is string => !!parte && parte.trim().length > 0);

    const unico = [...new Set(partes.map((parte) => parte.trim()))];

    if (unico.length > 0) return unico.join(' · ');

    return item.display_name ?? '';
  }

  /** Construye (una sola vez) el índice de paradas únicas del catálogo. */
  private indiceParadas(): ParadaIndexada[] {
    if (this.indice) return this.indice;

    const datos = this.api.datosInmediatos();
    if (!datos) return [];

    const lineasPorId = new Map<number, Linea>();
    for (const linea of datos.lineas) {
      lineasPorId.set(linea.id, linea);
    }

    // La misma parada física aparece con id distinto en cada sentido, así que se
    // deduplica por nombre y posición.
    const porClave = new Map<string, ParadaIndexada>();

    for (const recorrido of datos.recorridos) {
      const linea = lineasPorId.get(recorrido.lineaId);
      if (!linea) continue;

      for (const parada of recorrido.paradas) {
        const clave = `${normalizar(parada.nombreCalle)}|${parada.latitud.toFixed(4)}|${parada.longitud.toFixed(4)}`;
        const existente = porClave.get(clave);

        if (existente) {
          if (!existente.lineas.some((item) => item.id === linea.id)) {
            existente.lineas.push(linea);
          }
          continue;
        }

        porClave.set(clave, {
          parada,
          lineas: [linea],
          nombreNormalizado: normalizar(parada.nombreCalle),
          codigoNormalizado: normalizar(parada.codigoParada ?? ''),
        });
      }
    }

    this.indice = [...porClave.values()];

    return this.indice;
  }
}

/**
 * Normaliza texto para comparar: minúsculas y sin acentos.
 * "Fragueiro", "fragueiro" y "FRAGUEIRO" terminan siendo la misma búsqueda.
 */
export function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Indica si alguna palabra del texto empieza con la consulta. */
function empiezaConPalabra(texto: string, consulta: string): boolean {
  return texto.split(' ').some((palabra) => palabra.startsWith(consulta));
}
