import { TestBed } from '@angular/core/testing';
import { MapService } from './map.service';
import { RecorridoDetalle } from '../models';

const RECORRIDO: RecorridoDetalle = {
  id: 1,
  lineaId: 30,
  sentido: 'IDA',
  origen: 'Universidad Católica de Córdoba',
  destino: "B° Juan B. Justo (Sabino O'Donell)",
  coordenadasRuta: [
    [-31.48634, -64.24284],
    [-31.46976, -64.23507],
    [-31.43575, -64.19511],
  ],
  paradas: [
    {
      id: 1,
      nombreCalle: 'Universidad Católica de Córdoba',
      latitud: -31.48634,
      longitud: -64.24284,
      orden: 1,
    },
    { id: 2, nombreCalle: 'Av. Curazao', latitud: -31.46976, longitud: -64.23507, orden: 2 },
    {
      id: 3,
      nombreCalle: 'Av. Vélez Sarsfield',
      latitud: -31.43575,
      longitud: -64.19511,
      orden: 3,
    },
  ],
};

describe('MapService', () => {
  let servicio: MapService;
  let contenedor: HTMLDivElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(MapService);
    contenedor = document.createElement('div');
    document.body.appendChild(contenedor);
  });

  afterEach(() => {
    servicio.destruir();
    contenedor.remove();
  });

  it('inicializa el mapa centrado en la posición indicada', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    expect(servicio.mapaListo()).toBe(true);
    expect(servicio.mapaInstancia).not.toBeNull();

    const centro = servicio.mapaInstancia?.getCenter();
    expect(centro?.lat).toBeCloseTo(-31.4201, 4);
    expect(centro?.lng).toBeCloseTo(-64.1888, 4);
    expect(servicio.mapaInstancia?.getZoom()).toBe(13);
  });

  it('dibuja la traza y ajusta el encuadre a sus límites', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    servicio.dibujarRecorridos([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }]);

    expect(servicio.mapaInstancia?.getZoom()).toBeGreaterThan(13);
  });

  it('dibuja varios recorridos a la vez con distinto color', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    const contrario: RecorridoDetalle = {
      ...RECORRIDO,
      id: 2,
      sentido: 'VUELTA',
      paradas: RECORRIDO.paradas.map((p) => ({ ...p, id: p.id + 100 })),
    };

    servicio.dibujarRecorridos([
      { recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false },
      { recorrido: contrario, colorHex: '#e11d48', secundario: true },
    ]);

    expect(servicio.mapaInstancia).not.toBeNull();
  });

  it('renderiza un marcador numerado por cada parada', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    servicio.dibujarRecorridos([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }]);

    const marcadores = contenedor.querySelectorAll('.parada-marker');
    expect(marcadores.length).toBe(RECORRIDO.paradas.length);
    expect([...marcadores].map((m) => m.textContent?.trim())).toEqual(
      RECORRIDO.paradas.map((p) => String(p.orden)),
    );
  });

  it('acepta enfocar una parada sin lanzar errores', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    expect(() => servicio.enfocarParada(RECORRIDO.paradas[0])).not.toThrow();
  });

  it('dibuja la bandera verde en la primera parada y la de cuadros en la última', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    servicio.dibujarRecorridos([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }]);
    servicio.dibujarAnotaciones([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }], []);

    expect(contenedor.querySelectorAll('.bandera-marker--salida').length).toBe(1);
    expect(contenedor.querySelectorAll('.bandera-marker--final').length).toBe(1);
  });

  it('dibuja el punto de control con el ícono elegido', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    servicio.dibujarAnotaciones([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }], [
      {
        id: 'pc-1',
        lineaId: RECORRIDO.lineaId,
        recorridoId: RECORRIDO.id,
        paradaId: RECORRIDO.paradas[1].id,
        iconoId: 'alerta',
        creadoEn: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const marcador = contenedor.querySelector('.anotacion-marker');
    expect(marcador).not.toBeNull();
    expect(marcador?.querySelector('svg')).not.toBeNull();
  });

  it('deja de dibujar el punto de control cuando se elimina', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    const visible = { recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false };
    const punto = {
      id: 'pc-1',
      lineaId: RECORRIDO.lineaId,
      recorridoId: RECORRIDO.id,
      paradaId: RECORRIDO.paradas[1].id,
      iconoId: 'alerta',
      creadoEn: '2026-01-01T00:00:00.000Z',
    };

    servicio.dibujarAnotaciones([visible], [punto]);
    expect(contenedor.querySelectorAll('.anotacion-marker').length).toBe(1);

    servicio.dibujarAnotaciones([visible], []);
    expect(contenedor.querySelectorAll('.anotacion-marker').length).toBe(0);
  });

  it('no mueve la cámara al dibujar las anotaciones', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    servicio.dibujarRecorridos([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }]);
    const zoom = servicio.mapaInstancia?.getZoom();

    servicio.dibujarAnotaciones([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }], []);

    expect(servicio.mapaInstancia?.getZoom()).toBe(zoom);
  });

  it('ofrece la acción de punto de control en el popup de la parada', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    const peticiones: Array<[number, number]> = [];
    servicio.onPeticionPuntoControl = (recorridoId, paradaId) =>
      peticiones.push([recorridoId, paradaId]);

    servicio.dibujarRecorridos([{ recorrido: RECORRIDO, colorHex: '#0284c7', secundario: false }]);

    const modulo = await import('leaflet');
    const L = modulo.default ?? modulo;

    const marcadores: InstanceType<typeof L.Marker>[] = [];
    servicio.mapaInstancia?.eachLayer((capa) => {
      if (capa instanceof L.Marker) marcadores.push(capa);
    });

    expect(marcadores.length).toBe(RECORRIDO.paradas.length);

    marcadores[0].openPopup();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const boton = contenedor.querySelector<HTMLButtonElement>(
      'button[data-accion="control-point"]',
    );
    expect(boton).not.toBeNull();

    boton!.click();

    expect(peticiones).toEqual([[RECORRIDO.id, RECORRIDO.paradas[0].id]]);
  });

  it('destruye el mapa liberando la instancia', async () => {
    await servicio.inicializar(contenedor, { centro: [-31.4201, -64.1888], zoom: 13 });

    servicio.destruir();

    expect(servicio.mapaListo()).toBe(false);
    expect(servicio.mapaInstancia).toBeNull();
  });
});
