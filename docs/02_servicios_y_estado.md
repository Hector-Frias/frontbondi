# 02 - Servicios y Gestión de Estado

## 1. Modelos Tipados (`src/app/core/models/`)

```typescript
// linea.model.ts
export interface Linea {
  id: number;
  codigo: string;          // ej: "30", "82", "A1"
  nombre: string;          // ej: "Línea 30"
  corredor: string;        // ej: "Corredor 3"
  colorHex: string;        // ej: "#0284c7"
  activo: boolean;
}

// parada.model.ts
export interface Parada {
  id: number;
  codigoParada?: string;
  nombreCalle: string;
  latitud: number;
  longitud: number;
  orden: number;
}

// recorrido.model.ts
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
```

## 2. SibusStateService (Single Source of Truth)

Ubicación: `src/app/core/services/sibus-state.service.ts`

```typescript
import { Injectable, computed, signal, inject } from '@angular/core';
import { SibusApiService } from './sibus-api.service';
import { Linea, Parada, RecorridoDetalle, SentidoRecorrido } from '../models';

@Injectable({ providedIn: 'root' })
export class SibusStateService {
  private api = inject(SibusApiService);

  // Signals de Estado Primario
  readonly lineas = signal<Linea[]>([]);
  readonly lineaSeleccionada = signal<Linea | null>(null);
  readonly sentidoActivo = signal<SentidoRecorrido>('IDA');
  readonly recorridoActual = signal<RecorridoDetalle | null>(null);
  readonly paradaEnfocada = signal<Parada | null>(null);
  readonly cargando = signal<boolean>(false);
  readonly filtroTexto = signal<string>('');

  // Signals Computados
  readonly paradasFiltradas = computed(() => {
    const recorrido = this.recorridoActual();
    const query = this.filtroTexto().trim().toLowerCase();
    if (!recorrido) return [];
    if (!query) return recorrido.paradas;
    return recorrido.paradas.filter(p => 
      p.nombreCalle.toLowerCase().includes(query) || 
      (p.codigoParada && p.codigoParada.toLowerCase().includes(query))
    );
  });

  readonly cabeceras = computed(() => {
    const rec = this.recorridoActual();
    if (!rec) return { origen: '', destino: '' };
    return { origen: rec.origen, destino: rec.destino };
  });

  // Métodos de Mutación de Estado
  seleccionarLinea(linea: Linea): void {
    this.lineaSeleccionada.set(linea);
    this.cargarRecorrido();
  }

  cambiarSentido(sentido: SentidoRecorrido): void {
    if (this.sentidoActivo() === sentido) return;
    this.sentidoActivo.set(sentido);
    this.cargarRecorrido();
  }

  enfocarParada(parada: Parada | null): void {
    this.paradaEnfocada.set(parada);
  }

  private cargarRecorrido(): void {
    const linea = this.lineaSeleccionada();
    const sentido = this.sentidoActivo();
    if (!linea) return;

    this.cargando.set(true);
    this.api.obtenerRecorrido(linea.id, sentido).subscribe({
      next: (rec) => {
        this.recorridoActual.set(rec);
        this.paradaEnfocada.set(null);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }
}
```

## 3. MapService (Abstracción de Leaflet)

Ubicación: `src/app/core/services/map.service.ts`

* **Responsabilidades:**
  * Mantener la instancia privada de `L.Map`.
  * Instanciar y limpiar capas de forma reactiva (`L.Polyline` para la ruta, `L.CircleMarker` / `L.Marker` para las paradas).
  * Ejecutar transiciones de cámara suaves (`map.flyTo([lat, lng], zoom)`) al enfocar paradas o la ubicación del usuario.
  * Disparar `map.invalidateSize()` tras cambios de orientación o apertura de paneles táctiles.