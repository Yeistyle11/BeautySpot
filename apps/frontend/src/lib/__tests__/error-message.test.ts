import { ApiError } from "../api-error";
import { mensajeDeError } from "../error-message";

describe("mensajeDeError", () => {
  describe("errores del cliente (4xx)", () => {
    // El mensaje del backend describe el caso concreto y dice qué corregir.
    it("respeta el mensaje del backend", () => {
      expect(
        mensajeDeError(new ApiError(409, 'La categoría "Barbero" ya existe'))
      ).toBe('La categoría "Barbero" ya existe');

      expect(
        mensajeDeError(new ApiError(400, "El correo ya está registrado"))
      ).toBe("El correo ya está registrado");
    });

    // Estas frases traducen el código de estado, no lo que ha pasado.
    it.each([
      [403, "Forbidden", "permisos"],
      [404, "Not Found", "No se encontró"],
      [409, "Conflict", "ya existe"],
    ])(
      "sustituye la frase seca del protocolo en %i",
      (estado, seco, fragmento) => {
        const mensaje = mensajeDeError(new ApiError(estado, seco));

        expect(mensaje).toContain(fragmento);
        expect(mensaje).not.toBe(seco);
      }
    );

    it("ignora las mayúsculas al reconocer la frase seca", () => {
      expect(mensajeDeError(new ApiError(403, "forbidden"))).toContain(
        "permisos"
      );
    });

    it("da un texto genérico en un 4xx sin mensaje", () => {
      expect(mensajeDeError(new ApiError(418, ""))).toContain("inesperado");
    });
  });

  describe("errores del servidor (5xx)", () => {
    // El mensaje del backend nombra servicios internos: quien usa la
    // aplicación no puede actuar sobre eso.
    it("usa el texto propio aunque el backend mande el suyo", () => {
      const mensaje = mensajeDeError(
        new ApiError(503, "Servicio marketplace no disponible")
      );

      expect(mensaje).toContain("no está disponible");
      expect(mensaje).not.toContain("marketplace");
    });

    it("distingue el tiempo excedido", () => {
      expect(mensajeDeError(new ApiError(504, "timeout"))).toContain(
        "tardó demasiado"
      );
    });

    it("da un texto genérico ante un 5xx sin traducción propia", () => {
      expect(mensajeDeError(new ApiError(507, "lo que sea"))).toContain(
        "inesperado"
      );
    });
  });

  describe("errores que no vienen de la API", () => {
    it("explica un fallo de red en lugar de mostrar 'Failed to fetch'", () => {
      expect(mensajeDeError(new TypeError("Failed to fetch"))).toContain(
        "No se pudo conectar"
      );
    });

    it("usa el mensaje de un Error corriente", () => {
      expect(mensajeDeError(new Error("algo concreto"))).toBe("algo concreto");
    });

    it("da un texto genérico ante algo que no es un error", () => {
      expect(mensajeDeError("texto suelto")).toContain("inesperado");
      expect(mensajeDeError(null)).toContain("inesperado");
      expect(mensajeDeError(undefined)).toContain("inesperado");
    });

    it("da un texto genérico ante un Error sin mensaje", () => {
      expect(mensajeDeError(new Error("   "))).toContain("inesperado");
    });
  });
});
