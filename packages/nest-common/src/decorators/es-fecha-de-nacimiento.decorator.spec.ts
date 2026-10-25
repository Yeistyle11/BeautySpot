import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  EDAD_MAXIMA,
  EsFechaDeNacimiento,
} from "./es-fecha-de-nacimiento.decorator";

class ConNacimiento {
  @EsFechaDeNacimiento()
  birthDate?: string | null;
}

/** Errores del campo con ese valor, después de transformar como el pipe. */
async function errores(birthDate: unknown): Promise<string[]> {
  const dto = plainToInstance(ConNacimiento, { birthDate });
  const [error] = await validate(dto);
  return Object.values(error?.constraints ?? {});
}

/** Fecha (`YYYY-MM-DD`) desplazada esos días desde hoy. */
function dentroDe(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}

describe("EsFechaDeNacimiento", () => {
  it("acepta una fecha posible", async () => {
    expect(await errores("1990-05-17")).toEqual([]);
  });

  it("deja no darla o quitarla", async () => {
    expect(await errores(undefined)).toEqual([]);
    expect(await errores(null)).toEqual([]);
    expect(await errores("")).toEqual([]);
    expect(plainToInstance(ConNacimiento, { birthDate: "" }).birthDate).toBe(
      null
    );
  });

  it("pide el formato AAAA-MM-DD", async () => {
    expect(await errores("17/05/1990")).toEqual(
      expect.arrayContaining([expect.stringContaining("AAAA-MM-DD")])
    );
  });

  it("rechaza un día que no existe", async () => {
    expect(await errores("1990-02-30")).toEqual([
      "Revisa la fecha de nacimiento: ese día no es posible",
    ]);
  });

  it("rechaza una fecha futura", async () => {
    expect(await errores(dentroDe(5))).not.toEqual([]);
  });

  it("rechaza una edad imposible", async () => {
    const anio = new Date().getUTCFullYear() - EDAD_MAXIMA - 1;
    expect(await errores(`${anio}-01-01`)).not.toEqual([]);
  });
});
