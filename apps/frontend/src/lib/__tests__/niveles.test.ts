import { COLORES_DE_NIVEL } from "@beautyspot/shared-constants";
import {
  CLASE_DE_COLOR,
  NOMBRE_DE_COLOR,
  nivelSchema,
  FIDELIZACION_KEY,
} from "../niveles";

describe("niveles", () => {
  it("cada color de la paleta tiene clase y nombre", () => {
    for (const color of COLORES_DE_NIVEL) {
      expect(CLASE_DE_COLOR[color]).toMatch(/^bg-/);
      expect(NOMBRE_DE_COLOR[color]).toBeTruthy();
    }
  });

  it("el esquema acepta un nivel del backend", () => {
    expect(
      nivelSchema.parse({ min: 100, label: "Plata", color: "plata" })
    ).toEqual({ min: 100, label: "Plata", color: "plata" });
  });

  it("el esquema rechaza un color fuera de la paleta", () => {
    expect(() =>
      nivelSchema.parse({ min: 0, label: "Inicio", color: "fucsia" })
    ).toThrow();
  });

  it("la escala se pide al gateway, no directo a core", () => {
    expect(FIDELIZACION_KEY.startsWith("/core/")).toBe(true);
  });
});
