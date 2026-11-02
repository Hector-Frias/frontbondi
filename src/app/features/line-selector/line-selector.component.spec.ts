import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LineSelectorComponent } from './line-selector.component';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('LineSelectorComponent', () => {
  let fixture: ComponentFixture<LineSelectorComponent>;
  let estado: SibusStateService;

  const esperarCarga = async (): Promise<void> => {
    const inicio = Date.now();
    while (!estado.recorridoActual()) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando el recorrido');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineSelectorComponent],
    }).compileComponents();

    estado = TestBed.inject(SibusStateService);
    fixture = TestBed.createComponent(LineSelectorComponent);
    fixture.detectChanges();
  });

  it('renderiza una pestaña por cada linea disponible', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(estado.lineas().length);
    expect(tabs[0].textContent?.trim()).toBe('30');
  });

  it('cambia de linea al hacer click en una pestana', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
    tabs[1].click();

    expect(estado.lineaSeleccionada()?.codigo).toBe('31');
  });

  it('alterna el sentido del recorrido entre IDA y VUELTA', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[aria-pressed]',
    );
    expect(estado.sentidoActivo()).toBe('IDA');

    botones[1].click();
    expect(estado.sentidoActivo()).toBe('VUELTA');

    botones[0].click();
    expect(estado.sentidoActivo()).toBe('IDA');
  });

  it('muestra el origen y el destino del recorrido activo', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toMatch(/Univ\. Católica/);
    expect(texto).toMatch(/Juan B\. Justo/);
  });

  it('marca ambos sentidos con el boton AMBOS', async () => {
    await esperarCarga();
    fixture.detectChanges();

    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[aria-pressed]',
    );
    expect(botones.length).toBe(3);

    botones[2].click();
    expect(estado.mostrarAmbosSentidos()).toBe(true);

    const inicio = Date.now();
    while (estado.recorridoContrario() === null) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando el sentido contrario');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(estado.recorridosVisibles().length).toBe(2);
    const [ida, vuelta] = estado.recorridosVisibles();
    expect(ida?.recorrido.sentido).toBe('IDA');
    expect(vuelta?.recorrido.sentido).toBe('VUELTA');
    expect(ida?.colorHex).not.toBe(vuelta?.colorHex);
  });
});
