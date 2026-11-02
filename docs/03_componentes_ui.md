# 03 - Componentes de Interfaz de Usuario (UI)

## 1. Arquitectura Visual (Mobile First)

```text
+-------------------------------------------------------------+
| Header: [Logo SiBus] [Chips Corredores: 3, 5, 8]  [ GPS (o) ]|
+-------------------------------------------------------------+
| LineSelector: [ 30 ] [ 31 ] [ 32 ] [ 33 ] [ 34 ] [ 35 ] ...  |
+-------------------------------------------------------------+
| DirectionToggle:  [ (•) IDA ]     [ ( ) VUELTA ]            |
| Origen -> Destino                                           |
+-------------------------------------------------------------+
|                                                             |
|                   MAP CONTAINER (Leaflet)                   |
|                   100% Altura del viewport                  |
|                                                             |
+-------------------------------------------------------------+
| [^] BOTTOM SHEET: 28 Paradas (Deslizable hacia arriba)      |
| 1. Av. Santa Isabel 1° Secc.                                |
| 2. Armada Argentina 66                                      |
+-------------------------------------------------------------+
```

## 2. Especificación de Componentes

### Componente 1: `LineSelectorComponent`
* **Tipo:** Standalone Component.
* **UI:** Barra horizontal con desplazamiento touch (`overflow-x-auto` y `scrollbar-none`).
* **Comportamiento:**
  * Renderiza las líneas provistas por `SibusStateService.lineas()`.
  * La línea activa resalta con fondo `bg-sky-600 text-white font-bold`, las inactivas en `bg-slate-100 text-slate-700`.
  * Clic ejecuta `sibusState.seleccionarLinea(linea)`.

### Componente 2: `DirectionToggleComponent`
* **Tipo:** Standalone Component.
* **UI:** Segmented control de dos opciones con animación de transición CSS.
* **Comportamiento:**
  * Muestra el par de sentidos disponibles: `IDA` y `VUELTA`.
  * Debajo muestra el subtítulo informativo: `Desde: [Origen]  Hacia: [Destino]`.
  * Al hacer clic, invoca `sibusState.cambiarSentido(nuevoSentido)`.

### Componente 3: `MapContainerComponent`
* **Tipo:** Standalone Component.
* **Ciclo de Vida:**
  * `ngAfterViewInit`: Inicializa el mapa centrado en Córdoba (`-31.4201, -64.1888`, Zoom 13).
  * Registra un `effect()` de Angular que reacciona a cambios en `recorridoActual()`:
    1. Limpia polilíneas y marcadores existentes mediante `LayerGroup.clearLayers()`.
    2. Dibuja la polilínea con el color de la línea activa (`recorrido.linea.colorHex`, grosor: 4px).
    3. Agrega cada parada como `L.circleMarker` con borde contrastante.
    4. Ajusta el encuadre automático: `map.fitBounds(polyline.getBounds(), { padding: [40, 40] })`.

### Componente 4: `BottomSheetStopsComponent`
* **Tipo:** Standalone Component.
* **Comportamiento Móvil:**
  * **Estado Colapsado (Peek view):** Altura fija de 72px que muestra la cabecera actual, total de paradas y un indicador de deslizamiento (`handle`).
  * **Estado Expandido:** Despliegue hasta un 70% de la altura visible (`max-h-[70vh]`), mostrando la lista ordenada con buscador integrado (`input`).
  * Clic en un item de parada: dispara `sibusState.enfocarParada(parada)`, lo que hace que el mapa ejecute `map.flyTo([parada.lat, parada.lng], 16)`.