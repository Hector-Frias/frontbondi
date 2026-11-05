import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchResultsComponent } from './search-results.component';
import { BusquedaService } from '../../core/services/busqueda.service';
import { SibusApiService } from '../../core/services/sibus-api.service';
import { SibusStateService } from '../../core/services/sibus-state.service';

describe('SearchResultsComponent', () => {
  let fixture: ComponentFixture<SearchResultsComponent>;
  let busqueda: BusquedaService;
  let estado: SibusStateService;
  let api: SibusApiService;

  const elementos = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const esperarCarga = async (): Promise<void> => {
    const inicio = Date.now();
    while (!estado.lineaSeleccionada()) {
      if (Date.now() - inicio > 3000) throw new Error('Timeout esperando la línea activa');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  /** Elige como destino la primera parada del recorrido 1 (línea 30, IDA). */
  const elegirDestino = (): void => {
    const recorrido = api.datosInmediatos()?.recorridos.find((item) => item.id === 1);
    const parada = recorrido!.paradas[0];

    busqueda.seleccionar({
      id: `parada-${parada.id}`,
      etiqueta: parada.nombreCalle,
      latitud: parada.latitud,
      longitud: parada.longitud,
      origen: 'parada',
      parada,
    });

    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchResultsComponent],
    }).compileComponents();

    await TestBed.inject(SibusApiService).precargar();

    busqueda = TestBed.inject(BusquedaService);
    estado = TestBed.inject(SibusStateService);
    api = TestBed.inject(SibusApiService);

    fixture = TestBed.createComponent(SearchResultsComponent);
    fixture.detectChanges();
  });

  it('no muestra nada sin un destino elegido', () => {
    expect(elementos().querySelector('section')).toBeNull();
  });

  it('muestra el destino y el veredicto de la línea activa', async () => {
    await esperarCarga();
    elegirDestino();

    expect(elementos().textContent).toContain('Univ');
    expect(elementos().textContent).toContain('Tu línea activa');
    expect(elementos().textContent).toContain('Pasa a');
  });

  it('lista las líneas alternativas', async () => {
    await esperarCarga();
    elegirDestino();

    const alternativas = elementos().querySelectorAll('ul li button');

    expect(alternativas.length).toBeGreaterThan(0);
    expect(elementos().textContent).toContain('Alternativas');
  });

  it('aplica la línea elegida y la enfoca en el mapa', async () => {
    await esperarCarga();
    elegirDestino();

    const item = busqueda.analisis()!.lineas.find((linea) => linea.linea.codigo === '82')!;

    busqueda.elegirLinea(item);
    fixture.detectChanges();

    expect(estado.lineaSeleccionada()?.codigo).toBe('82');
    expect(estado.sentidoActivo()).toBe(item.sentido);
  });

  it('cierra los resultados al tocar la cruz y deja la ubicación en el mapa', async () => {
    await esperarCarga();
    elegirDestino();

    const cerrar = elementos().querySelector<HTMLButtonElement>(
      'button[aria-label="Cerrar resultados"]',
    );

    cerrar!.click();
    fixture.detectChanges();

    // El panel se cierra, pero el destino sigue marcado en el mapa.
    expect(elementos().querySelector('section')).toBeNull();
    expect(busqueda.panelAbierto()).toBe(false);
    expect(busqueda.destino()).not.toBeNull();
    expect(busqueda.hayDestino()).toBe(true);
  });

  it('quita la ubicación del mapa con el botón del panel', async () => {
    await esperarCarga();
    elegirDestino();

    const quitar = elementos().querySelector<HTMLButtonElement>(
      'button[aria-label="Quitar la ubicación del mapa"]',
    );

    quitar!.click();
    fixture.detectChanges();

    expect(busqueda.destino()).toBeNull();
    expect(busqueda.hayDestino()).toBe(false);
    expect(elementos().querySelector('section')).toBeNull();
  });
});
