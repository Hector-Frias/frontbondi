import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchBarComponent } from './search-bar.component';
import { BusquedaService } from '../../core/services/busqueda.service';
import { SibusApiService } from '../../core/services/sibus-api.service';

const FETCH_ORIGINAL = globalThis.fetch;

describe('SearchBarComponent', () => {
  let fixture: ComponentFixture<SearchBarComponent>;
  let busqueda: BusquedaService;

  const elementos = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const input = (): HTMLInputElement =>
    elementos().querySelector<HTMLInputElement>('input[type="search"]')!;

  const escribir = (texto: string): void => {
    input().focus();
    input().value = texto;
    input().dispatchEvent(new Event('input'));
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

  it('muestra el campo de búsqueda', () => {
    expect(input()).not.toBeNull();
    expect(input().getAttribute('placeholder')).toContain('dirección');
  });

  it('propone las paradas del catálogo mientras se escribe', () => {
    escribir('fragueiro');

    expect(busqueda.consulta()).toBe('fragueiro');
    expect(busqueda.sugerenciasLocales().length).toBeGreaterThan(0);
    expect(elementos().querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
  });

  it('elige la sugerencia como destino y cierra el desplegable', () => {
    escribir('fragueiro');

    const opciones = elementos().querySelectorAll<HTMLButtonElement>('[role="option"] button');
    opciones[0].click();
    fixture.detectChanges();

    expect(busqueda.destino()).not.toBeNull();
    expect(busqueda.hayDestino()).toBe(true);
    expect(busqueda.consulta()).toBe('');
    expect(elementos().querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('limpia la búsqueda con el botón de la cruz', () => {
    escribir('fragueiro');

    const botones = elementos().querySelectorAll<HTMLButtonElement>('button');
    const limpiar = [...botones].find((boton) =>
      boton.getAttribute('aria-label')?.includes('Limpiar'),
    );

    limpiar!.click();
    fixture.detectChanges();

    expect(busqueda.consulta()).toBe('');
    expect(busqueda.sugerenciasLocales()).toEqual([]);
  });

  it('navega con el teclado y elige la sugerencia resaltada', () => {
    escribir('fragueiro');

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();

    expect(elementos().querySelector('[aria-selected="true"]')).not.toBeNull();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(busqueda.destino()).not.toBeNull();
  });

  it('cierra el desplegable con la tecla Escape', () => {
    escribir('fragueiro');

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(elementos().querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('usa la posición del pasajero como destino', async () => {
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

    const boton = elementos().querySelector<HTMLButtonElement>(
      'button[aria-label="Usar mi ubicación"]',
    );

    boton!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(busqueda.destino()?.etiqueta).toBe('Mi ubicación');
    expect(busqueda.destino()?.latitud).toBeCloseTo(-31.4201, 4);
  });
});
