import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BottomSheetComponent } from './bottom-sheet.component';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('BottomSheetComponent', () => {
  let fixture: ComponentFixture<BottomSheetComponent>;
  let estado: SibusStateService;

  const esperarCarga = async (): Promise<void> => {
    const inicio = Date.now();
    while (!estado.recorridoActual()) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando el recorrido');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const elementos = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomSheetComponent],
    }).compileComponents();

    estado = TestBed.inject(SibusStateService);
    fixture = TestBed.createComponent(BottomSheetComponent);
    fixture.detectChanges();
  });

  it('muestra el total de paradas del recorrido activo', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const total = estado.recorridoActual()?.paradas.length ?? 0;
    expect(elementos().textContent).toContain(`${total} paradas`);
  });

  it('oculta la lista mientras está colapsado y la muestra al expandir', async () => {
    await esperarCarga();
    fixture.detectChanges();

    expect(elementos().querySelector('ul')).toBeNull();

    (elementos().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(elementos().querySelector('ul')).not.toBeNull();
    expect(elementos().querySelector('input[type="search"]')).not.toBeNull();
  });

  it('enfoca la parada al hacer click en un item de la lista', async () => {
    await esperarCarga();
    fixture.detectChanges();

    (elementos().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const items = elementos().querySelectorAll<HTMLButtonElement>('ul li button');
    expect(items.length).toBeGreaterThan(0);

    const esperada = estado.recorridoActual()?.paradas[0];
    items[0].click();

    expect(estado.paradaEnfocada()).toBe(esperada);
  });

  it('filtra la lista con el buscador', async () => {
    await esperarCarga();
    fixture.detectChanges();

    (elementos().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const buscador = elementos().querySelector<HTMLInputElement>('input[type="search"]');
    expect(buscador).not.toBeNull();

    buscador!.value = 'fragueiro';
    buscador!.dispatchEvent(new Event('input'));

    expect(estado.filtroTexto()).toBe('fragueiro');
    expect(estado.paradasFiltradas().length).toBeGreaterThan(0);
    expect(estado.paradasFiltradas().length).toBeLessThan(
      estado.recorridoActual()?.paradas.length ?? 0,
    );
  });

  it('abre el editor de punto de control desde la fila de la parada', async () => {
    await esperarCarga();
    fixture.detectChanges();

    (elementos().querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const primera = estado.recorridoActual()?.paradas[0];
    const botones = elementos().querySelectorAll<HTMLButtonElement>('ul li button');

    // Cada fila tiene el botón de foco y el de punto de control.
    expect(botones.length).toBeGreaterThan(1);

    botones[1].click();
    fixture.detectChanges();

    expect(estado.paradaEnEdicion()).toEqual({
      lineaId: estado.lineaSeleccionada()?.id,
      recorridoId: estado.recorridoActual()?.id,
      paradaId: primera?.id,
    });
  });
});
