import { ApiError } from "../api-error";
import { mensajeDeError } from "../error-message";

describe("mensajeDeError", () => {
  // Los mensajes de validación del backend son concretos y útiles: se respetan.
  it("respeta el mensaje del backend en un error de validación", () => {
    const mensaje = mensajeDeError(
      new ApiError(400, "El correo ya está registrado")
    );

    expect(mensaje).toBe("El correo ya está registrado");
  });

  // Los de infraestructura describen el sistema, no lo que el usuario puede
  // hacer: para esos hay un texto propio.
  it.each([
    [403, "permisos"],
    [404, "No se encontró"],
    [409, "ya existe"],
    [503, "no está disponible"],
    [504, "tardó demasiado"],
  ])("traduce el estado %i a un texto propio", (estado, fragmento) => {
    const mensaje = mensajeDeError(new ApiError(estado, "Forbidden"));

    expect(mensaje).toContain(fragmento);
    expect(mensaje).not.toBe("Forbidden");
  });

  it("explica un fallo de red en lugar de mostrar 'Failed to fetch'", () => {
    const fallo = new TypeError("Failed to fetch");

    expect(mensajeDeError(fallo)).toContain("No se pudo conectar");
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
    expect(mensajeDeError(new Error(""))).toContain("inesperado");
  });
});
