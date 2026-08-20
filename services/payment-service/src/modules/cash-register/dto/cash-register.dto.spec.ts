import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CashMovementType } from "@beautyspot/shared-types";
import {
  OpenSessionDto,
  CloseSessionDto,
  RegisterMovementDto,
} from "./cash-register.dto";

/** Mensajes de error del campo indicado al validar ese objeto. */
async function erroresDe<T extends object>(
  Dto: new () => T,
  valores: Record<string, unknown>,
  campo: string
): Promise<string[]> {
  const errores = await validate(plainToInstance(Dto, valores));
  const propio = errores.find((e) => e.property === campo);
  return Object.values(propio?.constraints ?? {});
}

describe("OpenSessionDto", () => {
  // El fondo entra en el total esperado del dia: un signo de mas desvia el
  // arqueo entero, y el descuadre resultante es ruido que tapa los de verdad.
  it("rechaza un fondo negativo", async () => {
    expect(
      await erroresDe(
        OpenSessionDto,
        { openingAmount: -50000 },
        "openingAmount"
      )
    ).toEqual(["El monto inicial no puede ser negativo"]);
  });

  it("acepta abrir sin fondo y con fondo cero", async () => {
    expect(await erroresDe(OpenSessionDto, {}, "openingAmount")).toEqual([]);
    expect(
      await erroresDe(OpenSessionDto, { openingAmount: 0 }, "openingAmount")
    ).toEqual([]);
  });
});

describe("CloseSessionDto", () => {
  it("rechaza un conteo negativo", async () => {
    expect(
      await erroresDe(CloseSessionDto, { closingAmount: -1 }, "closingAmount")
    ).toEqual(["El monto contado no puede ser negativo"]);
  });

  // Cerrar con el cajon vacio es un cierre legitimo, no un error.
  it("acepta cerrar con cero", async () => {
    expect(
      await erroresDe(CloseSessionDto, { closingAmount: 0 }, "closingAmount")
    ).toEqual([]);
  });
});

describe("RegisterMovementDto", () => {
  // Una salida se declara con `type`, no escribiendo el importe en negativo:
  // admitirlo dejaria dos formas de decir lo mismo y una de ellas suma al reves.
  it("rechaza un importe negativo", async () => {
    expect(
      await erroresDe(
        RegisterMovementDto,
        { type: CashMovementType.OUT, amount: -1000, concept: "Compra" },
        "amount"
      )
    ).toEqual(["El monto del movimiento no puede ser negativo"]);
  });
});
