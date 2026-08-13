import {
  nivelDePuntos,
  siguienteNivel,
  NIVELES_FIDELIDAD_POR_DEFECTO,
  type NivelDeFidelidad,
} from "./index";

/** Escala corta, para comprobar que las funciones no dependen de la de por defecto. */
const ESCALA: NivelDeFidelidad[] = [
  { min: 0, label: "Inicio", color: "verde" },
  { min: 50, label: "Habitual", color: "azul" },
  { min: 200, label: "Fiel", color: "morado" },
];

describe("niveles de fidelidad", () => {
  describe("nivelDePuntos", () => {
    it("da el primer nivel a quien no tiene puntos", () => {
      expect(nivelDePuntos(0)?.label).toBe("Bronce");
    });

    it("cambia de nivel justo al alcanzar el umbral", () => {
      expect(nivelDePuntos(99)?.label).toBe("Bronce");
      expect(nivelDePuntos(100)?.label).toBe("Plata");
    });

    it("no pasa del último por muchos puntos que se acumulen", () => {
      expect(nivelDePuntos(999999)?.label).toBe("Diamante");
    });

    it("usa la escala que se le pase", () => {
      expect(nivelDePuntos(60, ESCALA)?.label).toBe("Habitual");
    });

    it("devuelve null si no hay ningún nivel", () => {
      expect(nivelDePuntos(100, [])).toBeNull();
    });
  });

  describe("siguienteNivel", () => {
    it("señala el primero que todavía no se alcanza", () => {
      expect(siguienteNivel(100)?.label).toBe("Oro");
    });

    it("devuelve null en el nivel más alto", () => {
      expect(siguienteNivel(1000)).toBeNull();
      expect(siguienteNivel(250, ESCALA)).toBeNull();
    });

    it("usa la escala que se le pase", () => {
      expect(siguienteNivel(10, ESCALA)?.label).toBe("Habitual");
    });
  });

  it("la escala por defecto arranca en cero y sube", () => {
    expect(NIVELES_FIDELIDAD_POR_DEFECTO[0].min).toBe(0);
    for (let i = 1; i < NIVELES_FIDELIDAD_POR_DEFECTO.length; i++) {
      expect(NIVELES_FIDELIDAD_POR_DEFECTO[i].min).toBeGreaterThan(
        NIVELES_FIDELIDAD_POR_DEFECTO[i - 1].min
      );
    }
  });
});
