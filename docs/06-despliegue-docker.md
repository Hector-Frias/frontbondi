# 06 - Despliegue con Docker

El front es una app Angular con **SSR + prerender** (Express). El build produce `dist/frontbondi/`
con dos carpetas:

- `browser/`: HTML prerenderizado, bundles JS/CSS, manifest, iconos y el chunk con el dataset mock.
- `server/`: `server.mjs` (Express + Angular SSR embebidos, **sin dependencias externas**).

Por eso la imagen final solo necesita `node` + `dist/`: no se instala `node_modules` en runtime.

## 1. Build de la imagen

```bash
npm run docker:build
```

Multi-stage en el `Dockerfile`:

| Stage | Imagen | Qué hace |
|---|---|---|
| `build` | `node:24-slim` | `npm ci` + `npm run build` (build de producción con prerender) |
| `runtime` | `node:24-alpine` | copia solo `dist/frontbondi`, corre como usuario `sibus` (sin root) |

El `Dockerfile` tiene `HEALTHCHECK` contra `GET /healthz`.

## 2. Levantar

```bash
npm run docker:up      # docker compose up -d --build
npm run docker:logs    # logs en vivo
npm run docker:down    # bajar (agregar -v para borrar volumenes)
```

Por defecto escucha en `http://localhost:4000`. Para cambiar el puerto del host:

```bash
PORT=8080 npm run docker:up
```

## 3. Verificar que está sano

```bash
docker compose ps                                  # columna STATUS: healthy
curl http://localhost:4000/healthz                 # {"status":"ok"}
curl http://localhost:4000/ | grep -c 'role="tab"'  # 21 lineas prerenderizadas
curl -I http://localhost:4000/manifest.webmanifest
curl -I http://localhost:4000/assets/icons/icon-192x192.png
```

Si `grep -c 'role="tab"'` devuelve `0`, casi seguro falta `NG_ALLOWED_HOSTS` con el host con el
que estas consultando (ver seccion 4): el server respondio con el shell de render en cliente.

## 4. Variables de entorno

| Variable | Default | Para que sirve |
|---|---|---|
| `PORT` | `4000` | Puerto del server Express (dentro y fuera del contenedor) |
| `NODE_ENV` | `production` | Modo de Node |
| `NG_ALLOWED_HOSTS` | `localhost,127.0.0.1` | **Hostnames permitidos** (ver abajo) |

### `NG_ALLOWED_HOSTS` (obligatorio en produccion)

Angular valida el header `Host` de cada request contra esta lista como proteccion anti-SSRF.
Si el host no esta en la lista, el server **responde con el shell vacio** (render en cliente) y
en una version futura seria un `400 Bad Request`.

Como el dominio por el que se accede al front no se conoce en tiempo de build, hay que pasarlo
al desplegar:

```bash
# en el servidor, antes de `docker compose up -d`
export NG_ALLOWED_HOSTS=localhost,127.0.0.1,sibus.midominio.com.ar
docker compose up -d
```

Para correr el server SSR en local:

```bash
# POSIX
NG_ALLOWED_HOSTS=localhost,127.0.0.1 npm run serve:ssr:frontbondi
# Windows (cmd)
set NG_ALLOWED_HOSTS=localhost,127.0.0.1 && npm run serve:ssr:frontbondi
```

> Nota: el `Dockerfile` ya trae `localhost,127.0.0.1` por defecto, asi que `docker run` a secas
> funciona. El compose lee `NG_ALLOWED_HOSTS` del entorno y por eso es el lugar donde conviene
> declarar el dominio real.

## 5. Cosas a tener en cuenta

- **Solo se sirve `/`**: el `app.routes.server.ts` usa `RenderMode.Prerender` y el manifest de rutas
  prerenderizadas contiene unicamente `"/"`. Cualquier otra URL (por ejemplo `/mapa`) devuelve 404.
  Para servir mas rutas hay que declararlas en `src/app/app.routes.ts` y rebuildear; para datos vivos
  del backend hay que pasar a `RenderMode.Server`.
- **Los tiles de OpenStreetMap salen a internet**: el contenedor necesita salida a
  `tile.openstreetmap.org`. Sin eso el mapa se ve pero sin fondo de mapa.
- **Los datos mock quedan horneados en la imagen** (se hornean en el prerender del build). Cuando
  exista el backend NestJS, `SibusApiService` pasa a hacer `GET /api/v1/lineas` y
  `GET /api/v1/recorridos/:lineaId/:sentido`, y conviene cambiar a `RenderMode.Server`.
- **El build necesita salida al registry de npm** para el `npm ci`. En un server con salida
  restringida hay que usar un registry espejo o un builder con cache.
- La politica de uso de tiles de OSM pide identificar la aplicacion: hoy la app no manda un
  `Referer` propio.

## 6. Actualizar el despliegue

```bash
git pull
npm run docker:up      # rebuild + recreate
```

`docker compose up -d --build` reutiliza la capa cacheable de `npm ci` mientras el lockfile no cambie.
