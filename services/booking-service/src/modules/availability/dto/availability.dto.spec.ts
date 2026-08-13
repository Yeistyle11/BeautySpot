import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SlotDto } from "./availability.dto";

/** Errores del campo indicado al montar el tramo con esas horas. */
async function erroresDe(
  campo: "startTime" | "endTime",
  startTime: string,
  endTime: string
): Promise<string[]> {
  const dto = plainToInstance(SlotDto, { dayOfWeek: 1, startTime, endTime });
  const errores = await validate(dto);
  const propio = errores.find((e) => e.property === campo);
  return Object.values(propio?.constraints ?? {});
}

describe("SlotDto", () => {
  it("acepta una jornada dentro del día", async () => {
    expect(await erroresDe("endTime", "09:00", "18:00")).toEqual([]);
  });

  // La salida se escribe con la hora del reloj; que sea del día siguiente lo
  // decide la comparación con la entrada, no la propia hora.
  it("acepta salir de madrugada", async () => {
    expect(await erroresDe("endTime", "20:00", "02:00")).toEqual([]);
  });

  // Sin esto, la jornada que acaba al filo de la medianoche no se puede guardar
  // aunque el servicio la acepte: el DTO la corta antes.
  it("acepta las 24:00 como salida", async () => {
    expect(await erroresDe("endTime", "09:00", "24:00")).toEqual([]);
  });

  it("rechaza una salida por encima de las 24:00", async () => {
    expect(await erroresDe("endTime", "20:00", "26:00")).not.toEqual([]);
    expect(await erroresDe("endTime", "20:00", "24:30")).not.toEqual([]);
  });

  // La entrada sí es siempre una hora del día: nadie empieza a trabajar a las
  // 24:00 de ayer.
  it("no admite las 24:00 como entrada", async () => {
    expect(await erroresDe("startTime", "24:00", "02:00")).not.toEqual([]);
  });

  it.each(["9:0", "abc", "10:60", ""])(
    "rechaza la hora mal formada %p",
    async (hora) => {
      expect(await erroresDe("endTime", "09:00", hora)).not.toEqual([]);
    }
  );
});
