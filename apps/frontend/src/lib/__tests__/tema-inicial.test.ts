import { SCRIPT_DE_TEMA, THEME_STORAGE_KEY } from "../tema-inicial";

/**
 * El script se inserta en <head> y corre antes del primer pintado. Se prueba
 * evaluandolo, que es lo unico que reproduce lo que hace el navegador: aplicar
 * la clase antes de que React monte nada.
 */
function ejecutarScript() {
  new Function(SCRIPT_DE_TEMA)();
}

describe("script de tema inicial", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("aplica el tema oscuro que el usuario guardó", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    ejecutarScript();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("deja el tema claro cuando no hay elección guardada", () => {
    ejecutarScript();

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("no rompe la página si el navegador bloquea el almacenamiento", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("acceso denegado");
      });

    expect(() => ejecutarScript()).not.toThrow();

    getItem.mockRestore();
  });
});
