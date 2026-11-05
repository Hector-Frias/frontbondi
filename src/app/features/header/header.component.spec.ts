import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { GeolocationService } from '../../core/services/geolocation.service';
import { PuntosControlService } from '../../core/services/puntos-control.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
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
      imports: [HeaderComponent],
    }).compileComponents();

    estado = TestBed.inject(SibusStateService);
    puntos = TestBed.inject(PuntosControlService);
    fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
  });

  it('muestra el corredor de la línea activa en el botón', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const boton = elementos().querySelector<HTMLButtonElement>('button[aria-label="Ver corredores"]');
    expect(boton).not.toBeNull();
    expect(boton?.textContent).toContain(estado.lineaSeleccionada()?.corredor);
  });

  it('despliega la lista de corredores al tocar el botón', async () => {
    await esperarCarga();
    fixture.detectChanges();

    expect(elementos().querySelector('[role="menu"]')).toBeNull();

    elementos()
      .querySelector<HTMLButtonElement>('button[aria-label="Ver corredores"]')!
      .click();
    fixture.detectChanges();

    const menu = elementos().querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.querySelectorAll('[role="menuitem"]').length).toBe(3);
  });

  it('selecciona la línea del corredor elegido y cierra el menú', async () => {
    await esperarCarga();
    fixture.detectChanges();

    elementos()
      .querySelector<HTMLButtonElement>('button[aria-label="Ver corredores"]')!
      .click();
    fixture.detectChanges();

    const items = elementos().querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    const otro = [...items].find((item) => item.textContent?.trim() !== estado.lineaSeleccionada()?.corredor);
    const corredor = otro?.textContent?.trim() ?? '';

    otro!.click();
    fixture.detectChanges();

    expect(estado.lineaSeleccionada()?.corredor).toBe(corredor);
    expect(elementos().querySelector('[role="menu"]')).toBeNull();
  });

  it('muestra la cantidad de puntos de control de la línea activa', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const linea = estado.lineaSeleccionada()!;
    const recorrido = estado.recorridoActual()!;
    puntos.guardar(linea.id, recorrido.id, recorrido.paradas[0].id, 'alerta');
    fixture.detectChanges();

    const boton = elementos().querySelector<HTMLButtonElement>(
      'button[aria-label="Mis puntos de control"]',
    );
    expect(boton?.textContent?.trim()).toBe('1');
  });

  it('abre el panel de puntos de control con el botón del header', async () => {
    await esperarCarga();
    fixture.detectChanges();

    elementos()
      .querySelector<HTMLButtonElement>('button[aria-label="Mis puntos de control"]')!
      .click();
    fixture.detectChanges();

    expect(elementos().querySelector('app-control-points-panel')).not.toBeNull();
  });

  it('pide la ubicación con el botón del header', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const boton = elementos().querySelector<HTMLButtonElement>('button[aria-label="Mi ubicación"]');

    expect(boton).not.toBeNull();
    expect(boton?.disabled).toBe(false);

    const geolocation = TestBed.inject(GeolocationService);
    const solicitado = vi.spyOn(geolocation, 'solicitar');

    boton!.click();

    expect(solicitado).toHaveBeenCalled();
  });
});
