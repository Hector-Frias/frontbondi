import { TestBed } from '@angular/core/testing';
import { SibusStateService } from './sibus-state.service';

describe('SibusStateService', () => {
  let state: SibusStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    state = TestBed.inject(SibusStateService);
  });

  const esperarEstado = async (condicion: () => boolean, timeoutMs = 3000): Promise<void> => {
    const inicio = Date.now();
    while (!condicion()) {
      if (Date.now() - inicio > timeoutMs) {
        throw new Error('Timeout esperando el estado esperado');
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  const esperarRecorrido = (): Promise<void> =>
    esperarEstado(() => state.recorridoActual() !== null && !state.cargando());

  it('carga las líneas del mock y selecciona la primera activa', async () => {
    await esperarRecorrido();

    expect(state.lineas().length).toBe(21);
    expect(state.lineas()[0].codigo).toBe('30');
    expect(state.lineaSeleccionada()?.codigo).toBe('30');
    expect(state.sentidoActivo()).toBe('IDA');
    expect(state.recorridoActual()?.lineaId).toBe(state.lineas()[0].id);
    expect(state.cargando()).toBe(false);
  });

  it('expone las cabeceras con origen y destino del recorrido activo', async () => {
    await esperarRecorrido();

    expect(state.cabeceras().origen).toMatch(/Univ\. Católica/);
    expect(state.cabeceras().destino).toMatch(/Juan B\. Justo/);
  });

  it('filtra las paradas por texto y por código de parada', async () => {
    await esperarRecorrido();
    const total = state.recorridoActual()?.paradas.length ?? 0;

    expect(state.paradasFiltradas().length).toBe(total);

    state.filtroTexto.set('fragueiro');
    const porNombre = state.paradasFiltradas();
    expect(porNombre.length).toBeGreaterThan(0);
    expect(porNombre.length).toBeLessThan(total);
    expect(porNombre.every((p) => p.nombreCalle.toLowerCase().includes('fragueiro'))).toBe(true);

    const codigo = state.recorridoActual()?.paradas[0].codigoParada;
    expect(codigo).toBeTruthy();
    state.filtroTexto.set(codigo ?? '');
    expect(state.paradasFiltradas().length).toBe(1);
  });

  it('cambia el sentido y recarga el recorrido', async () => {
    await esperarRecorrido();
    const ida = state.recorridoActual();

    state.cambiarSentido('VUELTA');
    await esperarEstado(() => state.recorridoActual()?.sentido === 'VUELTA');

    expect(state.sentidoActivo()).toBe('VUELTA');
    expect(state.recorridoActual()?.id).not.toBe(ida?.id);
  });

  it('no vuelve a cargar el recorrido si el sentido no cambia', async () => {
    await esperarRecorrido();
    const recorrido = state.recorridoActual();

    state.cambiarSentido('IDA');

    expect(state.recorridoActual()).toBe(recorrido);
  });

  it('enfoca y desenfoca una parada', async () => {
    await esperarRecorrido();
    const parada = state.recorridoActual()?.paradas[0];

    state.enfocarParada(parada ?? null);
    expect(state.paradaEnfocada()).toBe(parada ?? null);

    state.enfocarParada(null);
    expect(state.paradaEnfocada()).toBeNull();
  });

  it('marca ambos sentidos y dibuja los dos recorridos con distinto color', async () => {
    await esperarRecorrido();
    expect(state.recorridosVisibles().length).toBe(1);

    state.alternarAmbosSentidos();
    await esperarEstado(() => state.recorridoContrario() !== null);

    const visibles = state.recorridosVisibles();
    expect(visibles.length).toBe(2);
    expect(visibles[0].secundario).toBe(false);
    expect(visibles[1].secundario).toBe(true);
    expect(visibles[0].recorrido.sentido).toBe('IDA');
    expect(visibles[1].recorrido.sentido).toBe('VUELTA');
    expect(visibles[0].colorHex).not.toBe(visibles[1].colorHex);
  });

  it('desmarca ambos sentidos y deja un solo recorrido visible', async () => {
    await esperarRecorrido();

    state.alternarAmbosSentidos();
    await esperarEstado(() => state.recorridoContrario() !== null);

    state.alternarAmbosSentidos();

    expect(state.mostrarAmbosSentidos()).toBe(false);
    expect(state.recorridoContrario()).toBeNull();
    expect(state.recorridosVisibles().length).toBe(1);
  });

  it('al elegir un sentido puntual sale del modo ambos', async () => {
    await esperarRecorrido();

    state.alternarAmbosSentidos();
    await esperarEstado(() => state.recorridoContrario() !== null);

    state.cambiarSentido('VUELTA');

    expect(state.mostrarAmbosSentidos()).toBe(false);
    expect(state.sentidoActivo()).toBe('VUELTA');
  });
});
