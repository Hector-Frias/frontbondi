import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('MapViewComponent', () => {
  let fixture: ComponentFixture<MapViewComponent>;
  let estado: SibusStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapViewComponent],
    }).compileComponents();

    estado = TestBed.inject(SibusStateService);
    fixture = TestBed.createComponent(MapViewComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  const esperar = async (condicion: () => boolean, timeoutMs = 5000): Promise<void> => {
    const inicio = Date.now();
    while (!condicion()) {
      fixture.detectChanges();
      if (Date.now() - inicio > timeoutMs) {
        throw new Error('Timeout esperando la condición');
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  };

  const marcadores = (): NodeListOf<Element> =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('.parada-marker');

  it('dibuja un marcador numerado por cada parada del recorrido activo', async () => {
    await esperar(() => estado.recorridoActual() !== null);
    await esperar(() => marcadores().length > 0);

    const total = estado.recorridoActual()?.paradas.length ?? 0;
    expect(marcadores().length).toBe(total);
    expect(marcadores()[0]?.textContent?.trim()).toBe('1');
  });

  it('dibuja los dos recorridos al marcar ambos sentidos', async () => {
    await esperar(() => estado.recorridoActual() !== null);
    await esperar(() => marcadores().length > 0);

    const antes = marcadores().length;

    estado.alternarAmbosSentidos();
    await esperar(() => estado.recorridoContrario() !== null);
    await esperar(() => marcadores().length > antes);

    const contrario = estado.recorridoContrario()?.paradas.length ?? 0;
    expect(marcadores().length).toBe(antes + contrario);
  });
});
