import {
  mensajeDeValidacion,
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

describe("mensajeDeValidacion", () => {
  it("traduce el mensaje que emite el validador y nombra el campo en castellano", () => {
    expect(
      mensajeDeValidacion("isUuid", "businessId", "businessId must be a UUID")
    ).toBe("Revisa el negocio: el formato no es válido");
    expect(
      mensajeDeValidacion(
        "isNotEmpty",
        "serviceIds",
        "serviceIds should not be empty"
      )
    ).toBe("Falta indicar los servicios");
    expect(
      mensajeDeValidacion(
        "isUuid",
        "serviceIds",
        "each value in serviceIds must be a UUID"
      )
    ).toBe("Revisa los servicios: el formato no es válido");
  });

  it("respeta el mensaje que ya redactó el DTO", () => {
    expect(
      mensajeDeValidacion(
        "isNotEmpty",
        "guestName",
        "Escribe tu nombre para reservar"
      )
    ).toBe("Escribe tu nombre para reservar");
  });

  it("no nombra el campo interno cuando no lo tiene traducido", () => {
    const mensaje = mensajeDeValidacion(
      "isString",
      "sectionConfig",
      "sectionConfig must be a string"
    );
    expect(mensaje).toBe("Revisa este dato: el formato no es válido");
    expect(mensaje).not.toContain("sectionConfig");
  });

  it("usa la frase de la regla cuando la conoce", () => {
    expect(
      mensajeDeValidacion("maxLength", "name", "name must be shorter than")
    ).toBe("Revisa el nombre: es más largo de lo permitido");
  });

  it.each([
    ["arrayMaxSize", "supera el máximo permitido"],
    ["arrayMinSize", "no llega al mínimo permitido"],
    ["arrayNotEmpty", "Falta indicar"],
    ["isEmail", "El correo no tiene un formato válido"],
    ["isNotEmpty", "Falta indicar"],
    ["isPositive", "mayor que cero"],
    ["isUrl", "dirección web"],
    ["max", "supera el máximo permitido"],
    ["maxLength", "más largo de lo permitido"],
    ["min", "no llega al mínimo permitido"],
    ["minLength", "más corto de lo permitido"],
    ["isString", "el formato no es válido"],
  ])("la regla %s se cuenta en castellano", (regla, esperado) => {
    const mensaje = mensajeDeValidacion(regla, "email", "email must be valid");

    expect(mensaje).toContain(esperado);
  });
});
