import { renderHook, act } from "@testing-library/react";
import { useTheme } from "../use-theme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("arranca en claro cuando el usuario no ha elegido tema", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  // El panel se usa a diario junto a otras herramientas: su aspecto no debe
  // depender de cómo tenga configurado el sistema cada equipo.
  it("sigue en claro aunque el sistema operativo prefiera oscuro", () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
  });

  it("respeta el tema oscuro que el usuario guardó", () => {
    localStorage.setItem("ui:v1:theme", "dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("guarda la elección al conmutar", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("ui:v1:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("vuelve a claro al conmutar de nuevo", () => {
    localStorage.setItem("ui:v1:theme", "dark");
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("ui:v1:theme")).toBe("light");
  });

  it("ignora un valor guardado que no reconoce", () => {
    localStorage.setItem("ui:v1:theme", "azul");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
  });
});
