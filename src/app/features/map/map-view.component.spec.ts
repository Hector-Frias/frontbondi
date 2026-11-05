import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import { BusquedaService } from '../../core/services/busqueda.service';
import { SibusApiService } from '../../core/services/sibus-api.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('MapViewComponent', () => {
  let fixture: ComponentFixture<MapViewComponent>;
  let estado: SibusStateService;
  let busqueda: BusquedaService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapViewComponent],
    }).compileComponents();

    await TestBed.inject(SibusApiService).precargar();

    estado = TestBed.inject(SibusStateService);
    busqueda = TestBed.inject(BusquedaService);
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

  const cruces = (): NodeListOf<Element> =>
    (fixture.nativeElement as HTMLElement).querySelectorAll('.destino-marker');

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

  it('mantiene la cruz del destino al cerrar el panel de resultados', async () => {
    await esperar(() => estado.recorridoActual() !== null);
    await esperar(() => marcadores().length > 0);

    busqueda.seleccionar({
      id: 'lugar-1',
      etiqueta: 'Plaza San Martín',
      latitud: -31.4186,
      longitud: -64.1833,
      origen: 'lugar',
    });

    await esperar(() => cruces().length === 1);

    // Cerrar el panel no debe borrar la cruz.
    busqueda.cerrarPanel();
    fixture.detectChanges();
    await esperar(() => cruces().length === 1);

    expect(busqueda.hayDestino()).toBe(true);

    // Recién al quitar la ubicación explícitamente desaparece.
    busqueda.limpiar();
    await esperar(() => cruces().length === 0);

    expect(busqueda.hayDestino()).toBe(false);
  });

  it('reemplaza la cruz cuando se elige otra ubicación', async () => {
    await esperar(() => estado.recorridoActual() !== null);
    await esperar(() => marcadores().length > 0);

    busqueda.seleccionar({
      id: 'lugar-1',
      etiqueta: 'Plaza San Martín',
      latitud: -31.4186,
      longitud: -64.1833,
      origen: 'lugar',
    });
    await esperar(() => cruces().length === 1);

    busqueda.seleccionar({
      id: 'lugar-2',
      etiqueta: 'Terminal de Omnibus',
      latitud: -31.4009,
      longitud: -64.1835,
      origen: 'lugar',
    });
    await esperar(() => cruces().length === 1);

    expect(busqueda.destino()?.etiqueta).toBe('Terminal de Omnibus');
  });
});
