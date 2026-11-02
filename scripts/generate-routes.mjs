import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'src/app/core/data/sibus-mock.json');
const CACHE = resolve(RAIZ, 'scripts/.overpass-cache.json');
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const BBOX = '-31.50,-64.27,-31.36,-64.13';
const TOLERANCIA_METROS = 2;
const LATITUD_REFERENCIA = -31.42;
const factorLongitud = Math.cos((LATITUD_REFERENCIA * Math.PI) / 180) * 111320;
const factorLatitud = 110540;

/** Paleta por linea para poder distinguirlas en el carrusel (el color oficial de SAT es uno solo por corredor). */
const COLORES = [
  '#0284c7',
  '#dc2626',
  '#16a34a',
  '#7c3aed',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#059669',
  '#c026d3',
  '#65a30d',
  '#9333ea',
  '#0f766e',
  '#b45309',
  '#a21caf',
  '#1d4ed8',
  '#15803d',
  '#be123c',
  '#a16207',
  '#334155',
];

async function consultar(consulta) {
  for (let intento = 1; intento <= 6; intento++) {
    try {
      const control = new AbortController();
      const timer = setTimeout(() => control.abort(), 180000);
      const r = await fetch(`${OVERPASS}?data=${encodeURIComponent(consulta)}`, {
        signal: control.signal,
        headers: { 'User-Agent': 'frontbondi-dev/0.1 (mock route generation)' },
      });
      clearTimeout(timer);
      const texto = await r.text();

      if (texto.trim().startsWith('{')) return JSON.parse(texto);

      console.log(`    intento ${intento}: ${texto.slice(0, 40).trim().split('\n')[0]}`);
    } catch (error) {
      console.log(`    intento ${intento}: ${error.message}`);
    }

    await new Promise((res) => setTimeout(res, 6000 * intento));
  }

  throw new Error('Overpass no respondio');
}

function aMetros([lon, lat]) {
  return [lon * factorLongitud, lat * factorLatitud];
}

function distanciaSegmento(p, a, b) {
  const [px, py] = aMetros(p);
  const [ax, ay] = aMetros(a);
  const [bx, by] = aMetros(b);
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function simplify(puntos, tolerancia) {
  if (puntos.length < 3) return puntos;

  let maxDistancia = 0;
  let indice = 0;
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  for (let i = 1; i < puntos.length - 1; i++) {
    const distancia = distanciaSegmento(puntos[i], primero, ultimo);
    if (distancia > maxDistancia) {
      maxDistancia = distancia;
      indice = i;
    }
  }

  if (maxDistancia <= tolerancia) return [primero, ultimo];

  const izquierda = simplify(puntos.slice(0, indice + 1), tolerancia);
  const derecha = simplify(puntos.slice(indice), tolerancia);
  return [...izquierda.slice(0, -1), ...derecha];
}

function iguales(a, b) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

/** Concatena las geometrias de los ways respetando el sentido de recorrido de la relacion. */
function construirTraza(ways) {
  const traza = [];
  let discontinuidades = 0;

  for (const way of ways) {
    const puntos = (way.geometry ?? []).map((p) => [p.lon, p.lat]);
    if (puntos.length === 0) continue;

    if (traza.length > 0) {
      const finActual = traza[traza.length - 1];
      const inicioWay = puntos[0];
      const finWay = puntos[puntos.length - 1];

      if (iguales(finActual, finWay)) {
        puntos.reverse();
      } else if (!iguales(finActual, inicioWay)) {
        discontinuidades++;
      }
    }

    traza.push(...puntos);
  }

  return { traza, discontinuidades };
}

function corredorDe(codigo) {
  const digitos = codigo.match(/\d+/);
  if (!digitos) return 'Barrial';
  const numero = Number(digitos[0]);
  return `Corredor ${Math.floor(numero / 10)}`;
}

let cache = {};
try {
  cache = JSON.parse(readFileSync(CACHE, 'utf8'));
} catch {
  cache = {};
}

function guardarCache() {
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));
}

// 1. Descubrir todas las relaciones de SiBus
const consultaRelaciones = `[out:json][timeout:150];rel["type"="route"]["route"="bus"]["operator"="SIbus"](${BBOX});out tags;`;

let relaciones = cache['relaciones-todas'];
if (!relaciones) {
  console.log('Consultando relaciones de SiBus...');
  const j = await consultar(consultaRelaciones);
  relaciones = (j.elements ?? []).map((e) => ({ id: e.id, tags: e.tags ?? {} }));
  cache['relaciones-todas'] = relaciones;
  guardarCache();
}

// 2. Quedarse con una relacion por (codigo, sentido)
const elegidas = new Map();
for (const relacion of relaciones) {
  const codigo = relacion.tags.ref;
  const nombre = relacion.tags.name ?? '';
  if (!codigo) continue;

  const sentido = /Vuelta\s*$/.test(nombre) ? 'VUELTA' : 'IDA';
  const clave = `${codigo}|${sentido}`;

  if (!elegidas.has(clave)) {
    elegidas.set(clave, { ...relacion, sentido });
  }
}

const orden = [...elegidas.values()].sort(
  (a, b) =>
    String(a.tags.ref).localeCompare(String(b.tags.ref), 'es', { numeric: true }) ||
    a.sentido.localeCompare(b.sentido),
);

console.log(
  `Lineas de SiBus: ${new Set(orden.map((r) => r.tags.ref)).size} | recorridos: ${orden.length}`,
);

// 3. Traer geometria y paradas de cada relacion
const recorridos = [];

for (const relacion of orden) {
  const clave = `rel-${relacion.id}`;
  const clavePlat = `plat-${relacion.id}`;
  const codigo = relacion.tags.ref;
  const nombre = relacion.tags.name ?? '';

  if (!cache[clave]) {
    console.log(`  ${nombre} (rel ${relacion.id}):Consultando Overpass...`);
    const rel = await consultar(`[out:json][timeout:180];rel(${relacion.id});out geom;`);
    cache[clave] = rel.elements?.[0]?.members ?? [];
    guardarCache();
    await new Promise((res) => setTimeout(res, 1200));
  }

  const miembros = cache[clave];
  const idsParadas = miembros
    .filter((m) => m.type === 'node' && m.role && m.role.startsWith('platform'))
    .map((m) => m.ref)
    .filter(Boolean);

  if (!cache[clavePlat]) {
    const plataformas = await consultar(
      `[out:json][timeout:120];node(id:${idsParadas.join(',')});out tags;`,
    );
    cache[clavePlat] = plataformas.elements ?? [];
    guardarCache();
    await new Promise((res) => setTimeout(res, 800));
  }

  const tagsPorId = new Map(cache[clavePlat].map((p) => [p.id, p.tags ?? {}]));
  const ways = miembros.filter((m) => m.type === 'way');
  const nodos = miembros.filter(
    (m) => m.type === 'node' && m.role && m.role.startsWith('platform'),
  );

  const { traza, discontinuidades } = construirTraza(ways);
  const geometria = simplify(traza, TOLERANCIA_METROS).map(([lon, lat]) => [
    Number(lat.toFixed(6)),
    Number(lon.toFixed(6)),
  ]);

  const paradas = nodos.map((nodo, indice) => {
    const tags = tagsPorId.get(nodo.ref) ?? {};
    const codigos = (tags.ref_code ?? '')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean);

    return {
      codigoParada: codigos[0],
      nombreCalle: tags.name ?? `Parada ${indice + 1}`,
      latitud: nodo.lat,
      longitud: nodo.lon,
      orden: indice + 1,
    };
  });

  recorridos.push({
    codigo,
    sentido: relacion.sentido,
    origen: relacion.tags.from ?? '',
    destino: relacion.tags.to ?? '',
    colorOficial: relacion.tags.colour ?? '',
    geometria,
    paradas,
    discontinuidades,
  });

  console.log(
    `    ${geometria.length} puntos | ${paradas.length} paradas | discontinuidades: ${discontinuidades}`,
  );
}

// 4. Armar lineas y recorridos con ids numericos
const codigos = [...new Set(recorridos.map((r) => r.codigo))].sort((a, b) =>
  a.localeCompare(b, 'es', { numeric: true }),
);

const lineas = codigos.map((codigo, indice) => ({
  id: indice + 1,
  codigo,
  nombre: `Línea ${codigo}`,
  corredor: corredorDe(codigo),
  colorHex: COLORES[indice % COLORES.length],
  activo: true,
}));

const idDeLinea = new Map(codigos.map((codigo, indice) => [codigo, indice + 1]));

const salida = {
  lineas,
  recorridos: recorridos.map((recorrido, indice) => ({
    id: indice + 1,
    lineaId: idDeLinea.get(recorrido.codigo) ?? 0,
    sentido: recorrido.sentido,
    origen: recorrido.origen,
    destino: recorrido.destino,
    coordenadasRuta: recorrido.geometria,
    paradas: recorrido.paradas.map((parada, i) => ({
      id: (indice + 1) * 1000 + i + 1,
      ...parada,
    })),
  })),
};

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, `${JSON.stringify(salida, null, 0)}\n`);

const totalPuntos = salida.recorridos.reduce((s, r) => s + r.coordenadasRuta.length, 0);
const totalParadas = salida.recorridos.reduce((s, r) => s + r.paradas.length, 0);
console.log(
  `\nOK  ${lineas.length} lineas | ${salida.recorridos.length} recorridos | ${totalPuntos} puntos | ${totalParadas} paradas`,
);
