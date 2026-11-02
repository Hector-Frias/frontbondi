import { varianteColor } from './color';

describe('varianteColor', () => {
  it('devuelve un color hexadecimal distinto del original', () => {
    const variante = varianteColor('#0284c7');

    expect(variante).toMatch(/^#[0-9a-f]{6}$/);
    expect(variante).not.toBe('#0284c7');
  });

  it('genera variantes distintas para lineas distintas', () => {
    expect(varianteColor('#0284c7')).not.toBe(varianteColor('#16a34a'));
  });

  it('admite el formato corto de tres digitos', () => {
    expect(varianteColor('#fff')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
