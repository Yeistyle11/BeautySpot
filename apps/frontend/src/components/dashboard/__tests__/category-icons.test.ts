import { Scissors, Crown, Tag } from "lucide-react";
import { CATEGORY_ICON_OPTIONS, resolveCategoryIcon } from "../category-icons";

describe("resolveCategoryIcon", () => {
  it("devuelve el icono guardado en la categoría", () => {
    expect(resolveCategoryIcon("Scissors", Tag)).toBe(Scissors);
    expect(resolveCategoryIcon("Crown", Tag)).toBe(Crown);
  });

  it("usa el icono de reserva cuando la categoría no tiene ninguno", () => {
    expect(resolveCategoryIcon(null, Tag)).toBe(Tag);
    expect(resolveCategoryIcon(undefined, Tag)).toBe(Tag);
    expect(resolveCategoryIcon("", Tag)).toBe(Tag);
  });

  // Una categoría puede conservar el nombre de un icono retirado de la lista.
  it("usa el icono de reserva ante un nombre desconocido", () => {
    expect(resolveCategoryIcon("NoExiste", Tag)).toBe(Tag);
  });

  it("distingue mayúsculas: el nombre debe coincidir con el guardado", () => {
    expect(resolveCategoryIcon("scissors", Tag)).toBe(Tag);
  });
});

describe("CATEGORY_ICON_OPTIONS", () => {
  // Ofrecer un icono y saber dibujarlo salen de la misma lista; este test lo
  // fija para que añadir una opción sin su componente falle aquí.
  it("cada opción ofrecida se resuelve a un icono propio", () => {
    for (const { value } of CATEGORY_ICON_OPTIONS) {
      expect(resolveCategoryIcon(value, Tag)).not.toBe(Tag);
    }
  });

  it("no tiene valores repetidos", () => {
    const valores = CATEGORY_ICON_OPTIONS.map((o) => o.value);
    expect(new Set(valores).size).toBe(valores.length);
  });

  it("expone una etiqueta legible por opción", () => {
    for (const { label } of CATEGORY_ICON_OPTIONS) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
