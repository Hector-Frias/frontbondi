import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Observable, delay, from, map } from 'rxjs';
import { Linea, RecorridoDetalle, SentidoRecorrido } from '../models';

interface DatosMock {
  lineas: Linea[];
  recorridos: RecorridoDetalle[];
}

/**
 * Mock transitorio con las 21 líneas de SiBus de Córdoba Capital.
 *
 * Los datos provienen de las relaciones de ruta de OpenStreetMap (operator=SIbus):
 * traza real sobre el callejero, paradas con nombre y código oficial del operador.
 *
 * El dataset vive en `data/sibus-mock.json` y se carga como chunk diferido para no
 * penalizar el bundle inicial. Cuando exista el backend (NestJS), este servicio pasa
 * a hacer `GET /api/v1/lineas` y `GET /api/v1/recorridos` con el mismo contrato.
 */
@Injectable({ providedIn: 'root' })
export class SibusApiService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly latenciaMs = 250;
  private readonly datos = signal<DatosMock | null>(null);

  /** Descarga (y cachea) el dataset mock. Se usa como app initializer para el SSR. */
  async precargar(): Promise<DatosMock> {
    const cacheado = this.datos();
    if (cacheado) return cacheado;

    const modulo = await import('../data/sibus-mock.json');
    const datos = modulo.default as unknown as DatosMock;
    this.datos.set(datos);
    return datos;
  }

  obtenerLineas(): Observable<Linea[]> {
    return this.conDatos((datos) => datos.lineas.map((linea) => ({ ...linea })));
  }

  obtenerRecorrido(lineaId: number, sentido: SentidoRecorrido): Observable<RecorridoDetalle> {
    return this.conDatos((datos) => {
      const recorrido = datos.recorridos.find(
        (item) => item.lineaId === lineaId && item.sentido === sentido,
      );

      if (!recorrido) {
        throw new Error(`No hay recorrido para la línea ${lineaId} en sentido ${sentido}`);
      }

      return recorrido;
    });
  }

  private conDatos<T>(selector: (datos: DatosMock) => T): Observable<T> {
    const base = from(this.precargar().then((datos) => selector(datos)));
    return isPlatformServer(this.platformId) ? base : base.pipe(delay(this.latenciaMs));
  }
}
