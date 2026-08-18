import {
  ApiError,
  isApiError,
  isAuthError,
  isNotFoundError,
} from "@/lib/api-error";

describe("api-error", () => {
  it("reconoce sus propios errores", () => {
    expect(isApiError(new ApiError(500, "boom"))).toBe(true);
    expect(isApiError(new Error("boom"))).toBe(false);
  });

  it("trata 401 y 403 como fallos de sesión o permisos", () => {
    expect(isAuthError(new ApiError(401, "sin sesión"))).toBe(true);
    expect(isAuthError(new ApiError(403, "sin permiso"))).toBe(true);
    expect(isAuthError(new ApiError(404, "no existe"))).toBe(false);
  });

  // Quien recibe un 404 suele poder ofrecer crear lo que falta; el resto de
  // errores solo admiten reintentar.
  it("distingue el 404 de los demás fallos", () => {
    expect(isNotFoundError(new ApiError(404, "no existe"))).toBe(true);
    expect(isNotFoundError(new ApiError(500, "boom"))).toBe(false);
    expect(isNotFoundError(new Error("boom"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
