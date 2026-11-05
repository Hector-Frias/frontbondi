import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchBarComponent } from './search-bar.component';
import { BusquedaService } from '../../core/services/busqueda.service';
import { SibusApiService } from '../../core/services/sibus-api.service';

const FETCH_ORIGINAL = globalThis.fetch;

describe('SearchBarComponent', () => {
  let fixture: ComponentFixture<SearchBarComponent>;
  let busqueda: BusquedaService;

  const elementos = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const input = (): HTMLInputElement | null =>
    elementos().querySelector<HTMLInputElement>('input[type="search"]');

  const boton = (ariaLabel: string): HTMLButtonElement | null =>
    elementos().querySelector<HTMLButtonElement>(`button[aria-label="${ariaLabel}"]`);

  /** Despliega el buscador como lo haría el usuario. */
  const abrir = async (): Promise<void> => {
    boton('Buscar una ubicación')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const escribir = (texto: string): void => {
    input()!.value = texto;
    input()!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    // La búsqueda remota no debe salir a la red durante los tests.
    globalThis.fetch = (async () =>
      ({ ok: true, json: async () => [] }) as Response) as unknown as typeof fetch;

    await TestBed.configureTestingModule({
      imports: [SearchBarComponent],
    }).compileComponents();

    await TestBed.inject(SibusApiService).precargar();
    busqueda = TestBed.inject(BusquedaService);

    fixture = TestBed.createComponent(SearchBarComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    globalThis.fetch = FETCH_ORIGINAL;
  });

  it('arranca plegado, sin el input en pantalla', () => {
    expect(input()).toBeNull();
    expect(boton('Buscar una ubicación')).not.toBeNull();
    expect(boton('Usar mi ubicación')).not.toBeNull();
  });

  it('abre el input al tocar el ícono de la lupa', async () => {
    await abrir();

    expect(input()).not.toBeNull();
    expect(input()?.getAttribute('placeholder')).toContain('dirección');
  });

  it('propone las paradas del catálogo mientras se escribe', async () => {
    await abrir();
    escribir('fragueiro');

    expect(busqueda.consulta()).toBe('fragueiro');
    expect(busqueda.sugerenciasLocales().length).toBeGreaterThan(0);
    expect(elementos().querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
  });

  it('elige la sugerencia como destino y vuelve a plegarse', async () => {
    await abrir();
    escribir('fragueiro');

    const opciones = elementos().querySelectorAll<HTMLButtonElement>('[role="option"] button');
    opciones[0].click();
    fixture.detectChanges();

    expect(busqueda.destino()).not.toBeNull();
    expect(busqueda.hayDestino()).toBe(true);
    expect(busqueda.consulta()).toBe('');
    expect(input()).toBeNull();
  });

  it('se repliega al perder el foco', async () => {
    await abrir();
    escribir('fragueiro');

    input()!.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(input()).toBeNull();
    expect(busqueda.consulta()).toBe('');
  });

  it('se repliega con la tecla Escape', async () => {
    await abrir();
    escribir('fragueiro');

    input()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(input()).toBeNull();
  });

  it('se repliega con el botón de cerrar', async () => {
    await abrir();

    boton('Cerrar el buscador')!.click();
    fixture.detectChanges();

    expect(input()).toBeNull();
  });

  it('limpia la búsqueda con el botón de la cruz', async () => {
    await abrir();
    escribir('fragueiro');

    boton('Limpiar la búsqueda')!.click();
    fixture.detectChanges();

    expect(busqueda.consulta()).toBe('');
    expect(busqueda.sugerenciasLocales()).toEqual([]);
    expect(input()).not.toBeNull();
  });

  it('la X del buscador limpia el texto sin quitar la ubicación del mapa', async () => {
    await abrir();
    escribir('fragueiro');

    const opciones = elementos().querySelectorAll<HTMLButtonElement>('[role="option"] button');
    opciones[0].click();
    fixture.detectChanges();

    expect(busqueda.hayDestino()).toBe(true);

    await abrir();
    escribir('fragueiro');

    boton('Limpiar la búsqueda')!.click();
    fixture.detectChanges();

    expect(busqueda.consulta()).toBe('');
    expect(busqueda.hayDestino()).toBe(true);
    expect(busqueda.destino()).not.toBeNull();
  });

  it('navega con el teclado y elige la sugerencia resaltada', async () => {
    await abrir();
    escribir('fragueiro');

    input()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();

    expect(elementos().querySelector('[aria-selected="true"]')).not.toBeNull();

    input()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(busqueda.destino()).not.toBeNull();
    expect(input()).toBeNull();
  });

  it('usa la posición del pasajero como destino desde el ícono plegado', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (exito: PositionCallback) => {
          exito({
            coords: {
              latitude: -31.4201,
              longitude: -64.1888,
              accuracy: 20,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: 1767225600000,
          } as GeolocationPosition);
        },
      },
    });

    boton('Usar mi ubicación')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(busqueda.destino()?.etiqueta).toBe('Mi ubicación');
    expect(busqueda.destino()?.latitud).toBeCloseTo(-31.4201, 4);
    expect(input()).toBeNull();
  });
});
