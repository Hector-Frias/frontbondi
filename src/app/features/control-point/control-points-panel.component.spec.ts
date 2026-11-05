import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlPointsPanelComponent } from './control-points-panel.component';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('ControlPointsPanelComponent', () => {
  let fixture: ComponentFixture<ControlPointsPanelComponent>;
  let estado: SibusStateService;
  let puntos: PuntosControlService;

  const esperarCarga = async (): Promise<void> => {
    const inicio = Date.now();
    while (!estado.recorridoActual()) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando el recorrido');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const esperarRecorridos = async (): Promise<void> => {
    const inicio = Date.now();
    while (estado.recorridosLinea().length === 0) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando los recorridos');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const elementos = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ControlPointsPanelComponent],
    }).compileComponents();

    estado = TestBed.inject(SibusStateService);
    puntos = TestBed.inject(PuntosControlService);
    fixture = TestBed.createComponent(ControlPointsPanelComponent);
    fixture.detectChanges();
  });

  it('avisa que la línea activa no tiene puntos de control', async () => {
    await esperarCarga();
    await esperarRecorridos();
    fixture.detectChanges();

    expect(elementos().textContent).toContain('Todavía no tenés puntos de control');
  });

  it('lista los puntos de control de la línea activa', async () => {
    await esperarCarga();
    await esperarRecorridos();

    const linea = estado.lineaSeleccionada()!;
    const recorrido = estado.recorridoActual()!;
    const parada = recorrido.paradas[0];

    puntos.guardar(linea.id, recorrido.id, parada.id, 'alerta');
    fixture.detectChanges();

    expect(elementos().textContent).toContain(parada.nombreCalle);
    expect(elementos().textContent).toContain('IDA');
    expect(elementos().querySelectorAll('li').length).toBe(1);
  });

  it('enfoca la parada en el mapa al tocar el punto de control', async () => {
    await esperarCarga();
    await esperarRecorridos();

    const linea = estado.lineaSeleccionada()!;
    const recorrido = estado.recorridoActual()!;
    const parada = recorrido.paradas[0];

    puntos.guardar(linea.id, recorrido.id, parada.id, 'alerta');
    fixture.detectChanges();

    elementos().querySelector<HTMLButtonElement>('li button')!.click();
    fixture.detectChanges();

    expect(estado.paradaEnfocada()?.id).toBe(parada.id);
  });

  it('quita el punto de control sin tocar la parada del recorrido', async () => {
    await esperarCarga();
    await esperarRecorridos();

    const linea = estado.lineaSeleccionada()!;
    const recorrido = estado.recorridoActual()!;
    const parada = recorrido.paradas[0];
    const totalParadas = recorrido.paradas.length;

    puntos.guardar(linea.id, recorrido.id, parada.id, 'alerta');
    fixture.detectChanges();

    const quitar = elementos().querySelector<HTMLButtonElement>(
      'li button[aria-label^="Quitar punto de control"]',
    );
    expect(quitar).not.toBeNull();

    quitar!.click();
    fixture.detectChanges();

    expect(puntos.puntoDe(recorrido.id, parada.id)).toBeUndefined();
    expect(estado.recorridoActual()?.paradas.length).toBe(totalParadas);
  });
});
