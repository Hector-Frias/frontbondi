# 01 - Arquitectura y Stack Tecnológico

## 1. Visión General
Aplicación Web Progresiva (PWA) Mobile-First inspirada en TuBondi, destinada a la visualización de recorridos y paradas de la empresa SiBus en Córdoba Capital.

## 2. Decisiones Técnicas y Versiones

| Tecnología | Rol | Justificación |
|---|---|---|
| **Angular 21+** | Core Framework | Soporte nativo de Standalone Components y Signals para reactividad de alto rendimiento. |
| **TypeScript** | Lenguaje | Modo estricto (`strict: true`), tipado integral sin uso de `any`. |
| **Leaflet (`leaflet`)** | Motor de Mapas | Motor ultraliviano (~40KB gzip), sin consumo de cuotas pagas ni tokens obligatorios de API. |
| **OpenStreetMap Tiles** | Capa Base Cartográfica | Renderizado estándar rápido y libre de costos (`tile.openstreetmap.org`). |
| **Tailwind CSS** | Sistema de Diseño | Clases utilitarias directas, sin CSS custom disperso, optimizado para interfaces táctiles. |
| **Angular CDK** | Utilidades UI | Primitivas para paneles deslizables (`bottom-sheet`) y accesibilidad táctil. |

## 3. Estructura de Directorios

```text
src/
└── app/
    ├── core/
    │   ├── models/
    │   │   ├── linea.model.ts
    │   │   ├── parada.model.ts
    │   │   └── recorrido.model.ts
    │   └── services/
    │       ├── sibus-api.service.ts
    │       ├── sibus-state.service.ts
    │       ├── map.service.ts
    │       └── geolocation.service.ts
    ├── shared/
    │   ├── components/
    │   │   ├── header/
    │   │   └── icon-button/
    │   └── pipes/
    │       └── filter-paradas.pipe.ts
    ├── features/
    │   └── map-viewer/
    │       ├── components/
    │       │   ├── map-container/
    │       │   ├── line-selector/
    │       │   ├── direction-toggle/
    │       │   └── bottom-sheet-stops/
    │       └── map-viewer.component.ts
    ├── app.component.ts
    ├── app.config.ts
    └── app.routes.ts
```

## 4. Reglas Estrictas de Código
1. **100% Standalone:** Queda prohibido el uso de `NgModule`. Todos los componentes, directivas y pipes deben declarar `standalone: true`.
2. **Signals para Estado:** Utilizar `signal()`, `computed()` y `effect()`. RxJS queda acotado exclusivamente a llamadas HTTP vía `HttpClient` y transformaciones mediante `toSignal()`.
3. **Control Flow Nativo:** Emplear la sintaxis `@if`, `@else`, `@for (item of list; track item.id)` y `@empty` en lugar de `*ngIf` y `*ngFor`.