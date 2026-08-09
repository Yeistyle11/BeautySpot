import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { RegisterDto } from "./register.dto";
import { LONGITUD_MINIMA_CONTRASENA } from "@beautyspot/shared-constants";

/** Errores de la contraseña del DTO montado con `password`. */
async function erroresDeContrasena(password: string): Promise<string[]> {
  const dto = plainToInstance(RegisterDto, {
    email: "nuevo@example.com",
    name: "Nuevo",
    password,
  });
  const errores = await validate(dto);
  const contrasena = errores.find((e) => e.property === "password");
  return Object.values(contrasena?.constraints ?? {});
}

describe("EsContrasenaValida", () => {
  it("acepta una contraseña larga con mayúsculas, minúsculas y números", async () => {
    expect(await erroresDeContrasena("ClaveSegura9")).toEqual([]);
  });

  it("rechaza la que se queda corta", async () => {
    expect(await erroresDeContrasena("Corta9")).toEqual(
      expect.arrayContaining([
        expect.stringContaining(String(LONGITUD_MINIMA_CONTRASENA)),
      ])
    );
  });

  it("rechaza la que no combina mayúsculas, minúsculas y números", async () => {
    expect(await erroresDeContrasena("todominusculas")).toEqual(
      expect.arrayContaining([expect.stringContaining("mayúsculas")])
    );
  });

  it("rechaza las comunes sin importar cómo se escriban", async () => {
    expect(await erroresDeContrasena("PassWord12")).toEqual(
      expect.arrayContaining([expect.stringContaining("común")])
    );
  });
});
