import { renderHook, act } from "@testing-library/react";
import { useSeededForm } from "../use-seeded-form";

describe("useSeededForm", () => {
  it("no siembra mientras no hay dato", () => {
    const sembrar = jest.fn();

    renderHook(() => useSeededForm(null, sembrar));

    expect(sembrar).not.toHaveBeenCalled();
  });

  it("siembra en cuanto el dato llega", () => {
    const sembrar = jest.fn();
    const { rerender } = renderHook(
      ({ dato }: { dato: string | null }) => useSeededForm(dato, sembrar),
      { initialProps: { dato: null as string | null } }
    );

    rerender({ dato: "llego" });

    expect(sembrar).toHaveBeenCalledTimes(1);
    expect(sembrar).toHaveBeenCalledWith("llego");
  });

  it("no vuelve a sembrar cuando el dato se revalida", () => {
    const sembrar = jest.fn();
    const { rerender } = renderHook(
      ({ dato }: { dato: string | null }) => useSeededForm(dato, sembrar),
      { initialProps: { dato: "primero" as string | null } }
    );

    rerender({ dato: "segundo" });

    expect(sembrar).toHaveBeenCalledTimes(1);
    expect(sembrar).toHaveBeenCalledWith("primero");
  });

  it("no siembra de nuevo porque cambie la funcion", () => {
    const primera = jest.fn();
    const segunda = jest.fn();
    const { rerender } = renderHook(
      ({ fn }: { fn: (d: string) => void }) => useSeededForm("dato", fn),
      { initialProps: { fn: primera as (d: string) => void } }
    );

    rerender({ fn: segunda });

    expect(primera).toHaveBeenCalledTimes(1);
    expect(segunda).not.toHaveBeenCalled();
  });

  it("vuelve a sembrar despues de reiniciar", () => {
    const sembrar = jest.fn();
    const { result, rerender } = renderHook(
      ({ dato }: { dato: string | null }) => useSeededForm(dato, sembrar),
      { initialProps: { dato: "primero" as string | null } }
    );

    act(() => result.current());
    rerender({ dato: "segundo" });

    expect(sembrar).toHaveBeenCalledTimes(2);
    expect(sembrar).toHaveBeenLastCalledWith("segundo");
  });
});
