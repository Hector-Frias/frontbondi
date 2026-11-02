import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'public/assets/icons');

const FONDO = [0x02, 0x84, 0xc7, 255];
const BLANCO = [0xff, 0xff, 0xff, 255];
const OSCURO = [0x0f, 0x17, 0x2a, 255];
const TRANSPARENTE = [0, 0, 0, 0];

const CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function encodePng(ancho, alto, rgba) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * ancho * 4, ancho * 4).copy(filas, y * (ancho * 4 + 1) + 1);
  }
  return Buffer.concat([
    firma,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function dentroRectRedondeado(x, y, x0, y0, x1, y1, radio) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + radio), x1 - radio);
  const cy = Math.min(Math.max(y, y0 + radio), y1 - radio);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radio * radio;
}

function dentroCirculo(x, y, cx, cy, radio) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radio * radio;
}

function colorIcono(x, y, { maskable, opaco }) {
  if (!maskable && !dentroRectRedondeado(x, y, 0, 0, 1, 1, 0.22)) return TRANSPARENTE;

  const escala = maskable ? 0.62 : 0.92;
  const gx = (x - 0.5) / escala + 0.5;
  const gy = (y - 0.5) / escala + 0.5;

  let color = FONDO;
  if (dentroRectRedondeado(gx, gy, 0.18, 0.28, 0.82, 0.64, 0.1)) color = BLANCO;
  if (dentroRectRedondeado(gx, gy, 0.25, 0.34, 0.75, 0.46, 0.04)) color = FONDO;
  if (dentroRectRedondeado(gx, gy, 0.25, 0.5, 0.75, 0.55, 0.02)) color = FONDO;
  if (dentroCirculo(gx, gy, 0.33, 0.66, 0.085)) color = OSCURO;
  if (dentroCirculo(gx, gy, 0.67, 0.66, 0.085)) color = OSCURO;

  if (opaco && color[3] === 0) color = FONDO;
  return color;
}

function renderizar(tamano, opciones) {
  const muestras = 4;
  const rgba = new Uint8Array(tamano * tamano * 4);

  for (let py = 0; py < tamano; py++) {
    for (let px = 0; px < tamano; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < muestras; sy++) {
        for (let sx = 0; sx < muestras; sx++) {
          const x = (px + (sx + 0.5) / muestras) / tamano;
          const y = (py + (sy + 0.5) / muestras) / tamano;
          const c = colorIcono(x, y, opciones);
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }

      const total = muestras * muestras;
      const indice = (py * tamano + px) * 4;
      if (a === 0) {
        rgba[indice] = 0;
        rgba[indice + 1] = 0;
        rgba[indice + 2] = 0;
        rgba[indice + 3] = 0;
      } else {
        rgba[indice] = Math.round(r / a);
        rgba[indice + 1] = Math.round(g / a);
        rgba[indice + 2] = Math.round(b / a);
        rgba[indice + 3] = Math.round(a / total);
      }
    }
  }

  return encodePng(tamano, tamano, rgba);
}

mkdirSync(DESTINO, { recursive: true });

const iconos = [
  { archivo: 'icon-192x192.png', tamano: 192, opciones: {} },
  { archivo: 'icon-512x512.png', tamano: 512, opciones: {} },
  { archivo: 'icon-512x512-maskable.png', tamano: 512, opciones: { maskable: true } },
  { archivo: 'apple-touch-icon.png', tamano: 180, opciones: { opaco: true } },
];

for (const icono of iconos) {
  const ruta = resolve(DESTINO, icono.archivo);
  writeFileSync(ruta, renderizar(icono.tamano, icono.opciones));
  console.log(`OK  ${icono.archivo}  (${icono.tamano}x${icono.tamano})`);
}
