import { act, renderHook } from "@testing-library/react";
import { useEsEscritorio } from "../use-punto-de-ruptura";

/** Simula matchMedia y devuelve el disparador del cambio de ancho. */
function simularAncho(inicial: boolean) {
  const oyentes = new Set<() => void>();
  const consulta = {
    get matches() {
      return actual;
    },
    addEventListener: (_: string, o: () => void) => void oyentes.add(o),
    removeEventListener: (_: string, o: () => void) => void oyentes.delete(o),
  };
  let actual = inicial;

  window.matchMedia = (() => consulta) as unknown as typeof window.matchMedia;

  return (nuevo: boolean) => {
    actual = nuevo;
    oyentes.forEach((o) => o());
  };
}

describe("useEsEscritorio", () => {
  it("responde que sí cuando la pantalla llega a lg", () => {
    simularAncho(true);
    const { result } = renderHook(() => useEsEscritorio());
    expect(result.current).toBe(true);
  });

  it("responde que no en una pantalla estrecha", () => {
    simularAncho(false);
    const { result } = renderHook(() => useEsEscritorio());
    expect(result.current).toBe(false);
  });

  it("se entera de que la ventana cambia de tamaño", () => {
    const cambiarAncho = simularAncho(false);
    const { result } = renderHook(() => useEsEscritorio());

    act(() => cambiarAncho(true));

    expect(result.current).toBe(true);
  });
});
