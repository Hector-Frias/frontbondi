# 05 - PWA y Optimización Mobile

## 1. Configuración de PWA

Comando de instalación:
```bash
ng add @angular/pwa
```

### `src/manifest.webmanifest`
Configuración requerida para comportamiento como aplicación nativa (sin barras de navegador visibles):

```json
{
  "name": "SiBus Córdoba - Recorridos y Paradas",
  "short_name": "SiBus CBA",
  "theme_color": "#0284c7",
  "background_color": "#0f172a",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-512x512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

## 2. Estrategia de Caché Offline (`ngsw-config.json`)

Los tiles de OpenStreetMap y las definiciones de recorridos estáticos deben persistirse para posibilitar la consulta en zonas con mala cobertura celular:

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.html",
          "/manifest.webmanifest",
          "/*.css",
          "/*.js"
        ]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "sibus-recorridos-api",
      "urls": ["/api/v1/lineas/**"],
      "cacheConfig": {
        "maxSize": 100,
        "maxAge": "7d",
        "strategy": "performance"
      }
    },
    {
      "name": "osm-tiles",
      "urls": ["https://*.tile.openstreetmap.org/**"],
      "cacheConfig": {
        "maxSize": 500,
        "maxAge": "3d",
        "strategy": "performance"
      }
    }
  ]
}
```

## 3. Optimizaciones Críticas para Celulares

1. **Prevención de Scroll Elástico:**
   Configurar en `styles.css` para evitar el rebote de página en navegadores Safari/Chrome móvil:
   ```css
   html, body {
     height: 100%;
     width: 100%;
     margin: 0;
     padding: 0;
     overflow: hidden;
     touch-action: manipulation;
     -webkit-tap-highlight-color: transparent;
   }
   ```

2. **Detección de Safe Area (Notch / Barra inferior de iOS):**
   Asegurar que los controles flotantes y el Bottom Sheet respeten los márgenes seguros:
   ```css
   .safe-bottom {
     padding-bottom: env(safe-area-inset-bottom, 16px);
   }
   ```

3. **Invalidación de Tamaño en Leaflet:**
   Al cambiar de orientación vertical/horizontal o al expandir el panel inferior de paradas, invocar siempre:
   ```typescript
   setTimeout(() => this.map.invalidateSize(), 200);
   ```