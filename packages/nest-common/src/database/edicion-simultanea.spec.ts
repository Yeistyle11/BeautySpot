import { ConflictException } from "@nestjs/common";
import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";
import { rechazarSiOtroGuardoAntes } from "./edicion-simultanea";

const CARGADA = new Date("2026-01-15T10:00:00Z");

describe("rechazarSiOtroGuardoAntes", () => {
  it("deja pasar la escritura cuando la fila no ha cambiado", () => {
    expect(() =>
      rechazarSiOtroGuardoAntes(CARGADA, new Date(CARGADA))
    ).not.toThrow();
  });

  // Las rutas de un solo editor no mandan version: no hay nada que cotejar.
  it("deja pasar la escritura cuando no se dice desde qué versión se edita", () => {
    expect(() => rechazarSiOtroGuardoAntes(CARGADA)).not.toThrow();
  });

  it("rechaza cuando otra persona guardó entremedias", () => {
    expect(() =>
      rechazarSiOtroGuardoAntes(new Date("2026-01-15T10:00:01Z"), CARGADA)
    ).toThrow(ConflictException);
  });

  // El cliente distingue este choque por su código, no por el texto.
  it("lleva el código que el cliente reconoce", () => {
    try {
      rechazarSiOtroGuardoAntes(new Date("2026-01-15T11:00:00Z"), CARGADA);
      fail("debía rechazar");
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        error: { code: CODIGO_EDICION_SIMULTANEA },
      });
    }
  });
});
