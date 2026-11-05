import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlPointSheetComponent } from './control-point-sheet.component';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('ControlPointSheetComponent', () => {
  let fixture: ComponentFixture<ControlPointSheetComponent>;
  let estado: SibusStateService;
  let puntos: PuntosControlService;

  const esperarCarga = async (): Promise<void> => {
    const inicio = Date.now();
    while (!estado.recorridoActual()) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando el recorrido');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const elementos = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ControlPointSheetComponent],
    }).compileComponents();

    estado = TestBed.inject(SibusStateService);
    puntos = TestBed.inject(PuntosControlService);
    fixture = TestBed.createComponent(ControlPointSheetComponent);
    fixture.detectChanges();
  });

  it('no muestra nada si no hay una parada en edición', () => {
    expect(elementos().querySelector('[role="dialog"]')).toBeNull();
  });

  it('muestra la paleta de íconos para la parada en edición', async () => {
    await esperarCarga();

    const recorrido = estado.recorridoActual()!;
    estado.abrirEditorPuntoControl(recorrido.id, recorrido.paradas[0].id);
    fixture.detectChanges();

    const dialogo = elementos().querySelector('[role="dialog"]');
    expect(dialogo).not.toBeNull();
    expect(dialogo?.querySelectorAll('button[aria-label]').length).toBe(12);
  });

  it('conserva el SVG del ícono elegido en la paleta', async () => {
    await esperarCarga();

    const recorrido = estado.recorridoActual()!;
    estado.abrirEditorPuntoControl(recorrido.id, recorrido.paradas[0].id);
    fixture.detectChanges();

    const boton = elementos().querySelector<HTMLButtonElement>('button[aria-label="Alerta"]');
    expect(boton?.querySelector('svg')).not.toBeNull();
    expect(boton?.querySelector('path')).not.toBeNull();
  });

  it('guarda el ícono elegido y cierra el editor', async () => {
    await esperarCarga();

    const recorrido = estado.recorridoActual()!;
    const parada = recorrido.paradas[0];

    estado.abrirEditorPuntoControl(recorrido.id, parada.id);
    fixture.detectChanges();

    elementos().querySelector<HTMLButtonElement>('button[aria-label="Alerta"]')!.click();
    fixture.detectChanges();

    expect(puntos.puntoDe(recorrido.id, parada.id)?.iconoId).toBe('alerta');
    expect(estado.paradaEnEdicion()).toBeNull();
    expect(elementos().querySelector('[role="dialog"]')).toBeNull();
  });

  it('quita el punto de control sin quitar la parada del recorrido', async () => {
    await esperarCarga();

    const recorrido = estado.recorridoActual()!;
    const parada = recorrido.paradas[0];
    const totalParadas = recorrido.paradas.length;

    puntos.guardar(recorrido.lineaId, recorrido.id, parada.id, 'alerta');

    estado.abrirEditorPuntoControl(recorrido.id, parada.id);
    fixture.detectChanges();

    const quitar = [...elementos().querySelectorAll<HTMLButtonElement>('button')].find(
      (boton) => boton.textContent?.includes('Quitar'),
    );
    expect(quitar).toBeDefined();

    quitar!.click();
    fixture.detectChanges();

    expect(puntos.puntoDe(recorrido.id, parada.id)).toBeUndefined();
    expect(estado.recorridoActual()?.paradas.length).toBe(totalParadas);
    expect(estado.buscarParada(recorrido.id, parada.id)).not.toBeNull();
  });

  it('marca el ícono actual como seleccionado', async () => {
    await esperarCarga();

    const recorrido = estado.recorridoActual()!;
    const parada = recorrido.paradas[0];

    puntos.guardar(recorrido.lineaId, recorrido.id, parada.id, 'estrella');

    estado.abrirEditorPuntoControl(recorrido.id, parada.id);
    fixture.detectChanges();

    const actual = elementos().querySelector<HTMLButtonElement>(
      'button[aria-label="Estrella"]',
    );
    expect(actual?.getAttribute('aria-pressed')).toBe('true');
  });
});
