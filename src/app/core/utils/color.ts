/**
 * Utilidades de color para diferenciar visualmente los recorridos en el mapa.
 */

function hexAHsl(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const valor = parseInt(
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio,
    16,
  );

  const r = ((valor >> 16) & 255) / 255;
  const g = ((valor >> 8) & 255) / 255;
  const b = (valor & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const luminosidad = (max + min) / 2;

  if (delta === 0) return [0, 0, luminosidad * 100];

  const saturacion = delta / (1 - Math.abs(2 * luminosidad - 1));
  let matiz: number;

  if (max === r) matiz = ((g - b) / delta) % 6;
  else if (max === g) matiz = (b - r) / delta + 2;
  else matiz = (r - g) / delta + 4;

  matiz *= 60;
  if (matiz < 0) matiz += 360;

  return [matiz, saturacion * 100, luminosidad * 100];
}

function hslAHex(matiz: number, saturacion: number, luminosidad: number): string {
  const s = saturacion / 100;
  const l = luminosidad / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((matiz / 60) % 2) - 1));
  const m = l - c / 2;

  let rgb: [number, number, number];
  if (matiz < 60) rgb = [c, x, 0];
  else if (matiz < 120) rgb = [x, c, 0];
  else if (matiz < 180) rgb = [0, c, x];
  else if (matiz < 240) rgb = [0, x, c];
  else if (matiz < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  const hex = rgb
    .map((valor) =>
      Math.round((valor + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

  return `#${hex}`;
}

/**
 * Genera un color claramente distinto al original, girando su matiz.
 * Se usa para el segundo recorrido (VUELTA) cuando se muestran ambos a la vez.
 */
export function varianteColor(hex: string, giroGrados = 150): string {
  const [matiz, , luminosidad] = hexAHsl(hex);
  const saturacion = Math.max(70, Math.min(95, luminosidad > 55 ? 70 : 88));
  const nuevaLuminosidad = Math.max(38, Math.min(52, luminosidad));

  return hslAHex((matiz + giroGrados + 360) % 360, saturacion, nuevaLuminosidad);
}
