# 04 - Roadmap de Fases y Tareas

## Sprint 1: Fundaciones y Mapa Base (Fase 1)
- [ ] Inicializar proyecto Angular con arquitectura Standalone y TypeScript estricto.
- [ ] Instalar y configurar Tailwind CSS (`tailwind.config.js`).
- [ ] Instalar dependencias cartográficas: `npm install leaflet @types/leaflet`.
- [ ] Cargar los estilos globales de Leaflet en `src/styles.css`.
- [ ] Definir modelos e interfaces de dominio en `src/app/core/models/`.
- [ ] Implementar `MapContainerComponent` con renderizado centrado en Córdoba Capital.
- [ ] Verificar que no existan errores de recorte de tiles ni fugas de memoria en destrucción (`map.remove()`).

## Sprint 2: Estado Reactivo y Trazado de Recorridos (Fase 2)
- [ ] Implementar `SibusApiService` con datos mockeados de la Línea 30 (IDA y VUELTA).
- [ ] Implementar `SibusStateService` usando Angular Signals.
- [ ] Crear el componente `LineSelectorComponent` con carrusel horizontal táctil.
- [ ] Crear el componente `DirectionToggleComponent` (IDA / VUELTA).
- [ ] Conectar `MapService` con el estado para pintar la polilínea GeoJSON automáticamente al seleccionar sentido.
- [ ] Dibujar paradas como `L.circleMarker` sobre la traza activa.

## Sprint 3: Panel de Paradas y Navegación Móvil (Fase 3)
- [ ] Diseñar el componente `BottomSheetStopsComponent` con soporte para gestos táctiles.
- [ ] Implementar filtro de búsqueda de paradas por texto en tiempo real (`computed()`).
- [ ] Vincular selección de parada con animación de cámara Leaflet (`flyTo`).
- [x] Implementar `GeolocationService` para capturar la posición del usuario (`navigator.geolocation`).
- [x] Crear marcador dinámico pulsante para la ubicación del pasajero en el mapa.

## Sprint 5: Buscador de Ubicaciones (Fase 3bis)
- [x] `GeocodingService` con búsqueda de direcciones en Nominatim y autocompletado de paradas locales.
- [x] `BusquedaService` con ranking de las 21 líneas por proximidad al destino (línea activa primero).
- [x] Componente `SearchBarComponent`: barra flotante sobre el mapa con sugerencias y navegación por teclado.
- [x] Componente `SearchResultsComponent`: veredicto de la línea activa, alternativas y parada de subida.
- [x] Marcadores de destino y de paradas de subida en el mapa (`MapService`).
- [ ] Mover la geocodificación al backend para evitar el límite de uso de Nominatim desde el navegador.

## Sprint 4: PWA, Optimización y Despliegue (Fase 4)
- [ ] Configurar `@angular/pwa` con `manifest.webmanifest` adaptado a pantallas móviles (Standalone mode).
- [ ] Configurar caché de mapas e interfaz en `ngsw-config.json`.
- [ ] Reemplazar el mock del `SibusApiService` por el endpoint real del backend en NestJS.
- [ ] Pruebas de rendimiento en Lighthouse Mobile (Meta: Score > 90 en Performance y PWA).