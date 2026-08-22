import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  URL_PREFIRMADA_MAXIMO_SEGUNDOS,
  URL_PREFIRMADA_MINIMO_SEGUNDOS,
} from "@beautyspot/shared-constants";
import { PresignedUrlQueryDto } from "./index";

/** La query tal y como llega: todo texto, como en una URL de verdad. */
async function validarValidez(expiresIn?: string) {
  const dto = plainToInstance(PresignedUrlQueryDto, {
    key: "businesses/logo.png",
    ...(expiresIn === undefined ? {} : { expiresIn }),
  });
  return validate(dto);
}

describe("PresignedUrlQueryDto", () => {
  it("acepta una validez dentro del rango", async () => {
    await expect(validarValidez("3600")).resolves.toHaveLength(0);
  });

  it("no obliga a pedir validez", async () => {
    await expect(validarValidez()).resolves.toHaveLength(0);
  });

  it("rechaza pedir un enlace que dure años", async () => {
    const errores = await validarValidez(
      `${URL_PREFIRMADA_MAXIMO_SEGUNDOS + 1}`
    );

    expect(errores).toHaveLength(1);
  });

  it("rechaza una validez por debajo de lo útil", async () => {
    const errores = await validarValidez(
      `${URL_PREFIRMADA_MINIMO_SEGUNDOS - 1}`
    );

    expect(errores).toHaveLength(1);
  });

  it("rechaza lo que no es un número", async () => {
    // Antes entraba como texto y llegaba a AWS convertido en NaN.
    const errores = await validarValidez("abc");

    expect(errores).toHaveLength(1);
  });
});
