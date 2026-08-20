import { z } from "zod";
import { ApiError } from "../api-error";
import { mensajeDeError } from "../error-message";

describe("mensajeDeError", () => {
  describe("desajustes de schema", () => {
    it("no filtra el volcado de Zod a la pantalla", () => {
      const error = z
        .object({ totalAmount: z.number() })
        .safeParse({ totalAmount: "30000" }).error!;

      const mensaje = mensajeDeError(error);

      expect(mensaje).not.toContain("totalAmount");
      expect(mensaje).not.toContain("invalid_type");
      expect(mensaje).toContain("formato esperado");
    });
  });

  describe("errores del cliente (4xx)", () => {
    it("respeta el mensaje del backend", () => {
      expect(
        mensajeDeError(new ApiError(409, 'La categoría "Barbero" ya existe'))
      ).toBe('La categoría "Barbero" ya existe');

      expect(
        mensajeDeError(new ApiError(400, "El correo ya está registrado"))
      ).toBe("El correo ya está registrado");
    });
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

  // "Error de validación" solo repite el código de estado; lo que el usuario
  // necesita para corregir el formulario son los motivos que enumera la API.
  describe("errores de validación con detalle", () => {
    it("muestra el motivo en lugar del mensaje genérico", () => {
      const error = new ApiError(400, "Error de validación", [
        "La contraseña debe tener al menos 8 caracteres",
      ]);

      expect(mensajeDeError(error)).toBe(
        "La contraseña debe tener al menos 8 caracteres"
      );
    });

    it("enumera todos los motivos cuando falla más de un campo", () => {
      const error = new ApiError(400, "Error de validación", [
        "El nombre es obligatorio",
        "El precio no puede ser negativo",
      ]);

      const mensaje = mensajeDeError(error);

      expect(mensaje).toContain("El nombre es obligatorio");
      expect(mensaje).toContain("El precio no puede ser negativo");
    });

    it("cae al mensaje del backend si no hay detalle", () => {
      expect(mensajeDeError(new ApiError(400, "El correo ya existe", []))).toBe(
        "El correo ya existe"
      );
    });

    it("no antepone el detalle a un error de servidor", () => {
      const error = new ApiError(500, "Error de validación", ["da igual"]);

      expect(mensajeDeError(error)).toContain("Algo falló en el servidor");
    });
  });

  describe("errores del servidor (5xx)", () => {
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

  describe("respaldo con contexto de la pantalla", () => {
    // "No se pudo crear la cuenta" orienta mas que "ocurrio un error": la
    // pantalla sabe que se estaba intentando y el texto generico no.
    it("usa el respaldo de quien llama cuando no hay nada que contar", () => {
      expect(mensajeDeError(null, "No se pudo crear la cuenta")).toBe(
        "No se pudo crear la cuenta"
      );
    });

    it("usa el respaldo ante un 4xx sin mensaje util", () => {
      expect(
        mensajeDeError(new ApiError(400, "Bad Request"), "No se pudo guardar")
      ).toBe("No se pudo guardar");
    });

    // El respaldo es el ultimo recurso, no un sustituto: los textos que si
    // explican la causa mandan sobre el.
    it("no pisa el motivo cuando el backend lo explica", () => {
      expect(
        mensajeDeError(
          new ApiError(400, "El correo ya está registrado"),
          "No se pudo crear la cuenta"
        )
      ).toBe("El correo ya está registrado");
    });

    it("no pisa la explicación de un fallo de red", () => {
      expect(
        mensajeDeError(new TypeError("Failed to fetch"), "No se pudo guardar")
      ).toContain("Revisa tu conexión");
    });

    it("no pisa el texto de un 503", () => {
      expect(
        mensajeDeError(
          new ApiError(503, "Service Unavailable"),
          "No se pudo guardar"
        )
      ).toContain("no está disponible");
    });
  });
});
