import { TestBed } from '@angular/core/testing';
import { PuntosControlService } from './puntos-control.service';

const CLAVE_ALMACEN = 'bondimati.puntos-control.v1';

describe('PuntosControlService', () => {
  beforeEach(() => {
    localStorage.removeItem(CLAVE_ALMACEN);
    TestBed.configureTestingModule({});
  });

  it('guarda un punto de control y lo expone por recorrido y parada', () => {
    const servicio = TestBed.inject(PuntosControlService);

    const punto = servicio.guardar(30, 1, 1001, 'alerta');

    expect(servicio.puntos().length).toBe(1);
    expect(servicio.puntoDe(1, 1001)?.id).toBe(punto.id);
    expect(servicio.puntoDe(1, 1001)?.iconoId).toBe('alerta');
    expect(servicio.puntoDe(1, 1001)?.lineaId).toBe(30);
    expect(servicio.tienePuntoControl(1, 1001)).toBe(true);
    expect(servicio.tienePuntoControl(2, 1001)).toBe(false);
  });

  it('lista los puntos de control de una línea', () => {
    const servicio = TestBed.inject(PuntosControlService);

    servicio.guardar(30, 1, 1001, 'alerta');
    servicio.guardar(30, 2, 2001, 'estrella');
    servicio.guardar(31, 3, 3001, 'hospital');

    expect(servicio.puntosDeLinea(30).length).toBe(2);
    expect(servicio.puntosDeLinea(31).length).toBe(1);
    expect(servicio.puntosDeLinea(99).length).toBe(0);
  });

  it('no duplica el punto si la parada ya tiene uno y le cambia el ícono', () => {
    const servicio = TestBed.inject(PuntosControlService);

    servicio.guardar(30, 1, 1001, 'alerta');
    servicio.guardar(30, 1, 1001, 'estrella');

    expect(servicio.puntos().length).toBe(1);
    expect(servicio.puntoDe(1, 1001)?.iconoId).toBe('estrella');
  });

  it('elimina el punto de control por id', () => {
    const servicio = TestBed.inject(PuntosControlService);
    const punto = servicio.guardar(30, 1, 1001, 'alerta');

    servicio.eliminar(punto.id);

    expect(servicio.puntos().length).toBe(0);
    expect(servicio.puntoDe(1, 1001)).toBeUndefined();
  });

  it('elimina el punto de control por recorrido y parada', () => {
    const servicio = TestBed.inject(PuntosControlService);
    servicio.guardar(30, 1, 1001, 'alerta');
    servicio.guardar(31, 2, 2001, 'estrella');

    servicio.eliminarDeParada(1, 1001);

    expect(servicio.puntos().length).toBe(1);
    expect(servicio.puntoDe(1, 1001)).toBeUndefined();
    expect(servicio.puntoDe(2, 2001)).toBeDefined();
  });

  it('persiste los puntos en localStorage', () => {
    const servicio = TestBed.inject(PuntosControlService);

    servicio.guardar(30, 1, 1001, 'alerta');

    const almacen = JSON.parse(localStorage.getItem(CLAVE_ALMACEN) ?? '{}');
    expect(almacen.version).toBe(1);
    expect(almacen.puntos.length).toBe(1);
    expect(almacen.puntos[0].iconoId).toBe('alerta');
    expect(almacen.puntos[0].lineaId).toBe(30);
  });

  it('hidrata los puntos guardados en localStorage', () => {
    localStorage.setItem(
      CLAVE_ALMACEN,
      JSON.stringify({
        version: 1,
        puntos: [
          {
            id: 'pc-1',
            lineaId: 30,
            recorridoId: 1,
            paradaId: 1001,
            iconoId: 'estrella',
            creadoEn: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    const servicio = TestBed.inject(PuntosControlService);

    expect(servicio.puntos().length).toBe(1);
    expect(servicio.puntoDe(1, 1001)?.iconoId).toBe('estrella');
    expect(servicio.puntosDeLinea(30).length).toBe(1);
  });

  it('ignora un almacen corrupto', () => {
    localStorage.setItem(CLAVE_ALMACEN, '{no-json');

    const servicio = TestBed.inject(PuntosControlService);

    expect(servicio.puntos().length).toBe(0);
  });

  it('descarta los puntos con formato inválido', () => {
    localStorage.setItem(
      CLAVE_ALMACEN,
      JSON.stringify({
        version: 1,
        puntos: [{ id: 'pc-1', recorridoId: 'uno', paradaId: 1001 }],
      }),
    );

    const servicio = TestBed.inject(PuntosControlService);

    expect(servicio.puntos().length).toBe(0);
  });
});
