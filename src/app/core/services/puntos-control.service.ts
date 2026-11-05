import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { PuntoControl } from '../models';

const CLAVE_ALMACEN = 'bondimati.puntos-control.v1';
const VERSION_ALMACEN = 1;

interface AlmacenPuntosControl {
  version: number;
  puntos: PuntoControl[];
}

const clavePunto = (recorridoId: number, paradaId: number): string =>
  `${recorridoId}:${paradaId}`;

/**
 * Puntos de control: anotaciones del usuario sobre las paradas (no las modifica).
 *
 * La persistencia es local al dispositivo (`localStorage`). Cuando exista el
 * backend NestJS, este servicio pasa a hablar con `GET/POST/DELETE
 * /api/v1/puntos-de-control` manteniendo la misma interfaz.
 */
@Injectable({ providedIn: 'root' })
export class PuntosControlService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly estado = signal<PuntoControl[]>([]);

  readonly puntos = this.estado.asReadonly();

  /** Índice `recorridoId:paradaId` → punto de control. */
  readonly porParada = computed(() => {
    const indice = new Map<string, PuntoControl>();
    for (const punto of this.estado()) {
      indice.set(clavePunto(punto.recorridoId, punto.paradaId), punto);
    }
    return indice;
  });

  /** Índice `lineaId` → puntos de control de esa línea. */
  readonly porLinea = computed(() => {
    const indice = new Map<number, PuntoControl[]>();
    for (const punto of this.estado()) {
      const lista = indice.get(punto.lineaId) ?? [];
      lista.push(punto);
      indice.set(punto.lineaId, lista);
    }
    return indice;
  });

  constructor() {
    this.cargar();
  }

  puntoDe(recorridoId: number, paradaId: number): PuntoControl | undefined {
    return this.porParada().get(clavePunto(recorridoId, paradaId));
  }

  puntosDeLinea(lineaId: number): PuntoControl[] {
    return this.porLinea().get(lineaId) ?? [];
  }

  tienePuntoControl(recorridoId: number, paradaId: number): boolean {
    return this.puntoDe(recorridoId, paradaId) !== undefined;
  }

  /** Crea el punto de control o, si la parada ya tenía uno, le cambia el ícono. */
  guardar(
    lineaId: number,
    recorridoId: number,
    paradaId: number,
    iconoId: string,
  ): PuntoControl {
    const existente = this.puntoDe(recorridoId, paradaId);

    if (existente) {
      const actualizado: PuntoControl = { ...existente, lineaId, iconoId };
      this.estado.update((puntos) =>
        puntos.map((punto) => (punto.id === existente.id ? actualizado : punto)),
      );
      this.persistir();
      return actualizado;
    }

    const punto: PuntoControl = {
      id: generarId(),
      lineaId,
      recorridoId,
      paradaId,
      iconoId,
      creadoEn: new Date().toISOString(),
    };

    this.estado.update((puntos) => [...puntos, punto]);
    this.persistir();
    return punto;
  }

  cambiarIcono(id: string, iconoId: string): void {
    this.estado.update((puntos) =>
      puntos.map((punto) => (punto.id === id ? { ...punto, iconoId } : punto)),
    );
    this.persistir();
  }

  /** Borra solo la anotación: la parada del recorrido queda intacta. */
  eliminar(id: string): void {
    this.estado.update((puntos) => puntos.filter((punto) => punto.id !== id));
    this.persistir();
  }

  eliminarDeParada(recorridoId: number, paradaId: number): void {
    this.estado.update((puntos) =>
      puntos.filter(
        (punto) => !(punto.recorridoId === recorridoId && punto.paradaId === paradaId),
      ),
    );
    this.persistir();
  }

  private cargar(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const crudo = localStorage.getItem(CLAVE_ALMACEN);
      if (!crudo) return;

      const almacen = JSON.parse(crudo) as Partial<AlmacenPuntosControl>;
      if (almacen?.version !== VERSION_ALMACEN || !Array.isArray(almacen.puntos)) return;

      this.estado.set(
        almacen.puntos.filter(
          (punto): punto is PuntoControl =>
            !!punto &&
            typeof punto.id === 'string' &&
            typeof punto.lineaId === 'number' &&
            typeof punto.recorridoId === 'number' &&
            typeof punto.paradaId === 'number' &&
            typeof punto.iconoId === 'string',
        ),
      );
    } catch {
      // Almacen corrupto o no legible: se sigue sin puntos de control.
    }
  }

  private persistir(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const almacen: AlmacenPuntosControl = {
      version: VERSION_ALMACEN,
      puntos: this.estado(),
    };

    try {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(almacen));
    } catch {
      // Sin espacio o almacenamiento bloqueado: los puntos siguen en memoria.
    }
  }
}

function generarId(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
