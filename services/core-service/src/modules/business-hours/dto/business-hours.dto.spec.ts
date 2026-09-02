import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import {
  BatchUpsertDto,
  BusinessHourItemDto,
  UpdateBusinessHoursDto,
} from "./business-hours.dto";

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

const TRAMO = { dayOfWeek: 1, openTime: "09:00", closeTime: "20:00" };

describe("BusinessHourItemDto", () => {
  it("acepta una hora bien formada, y el cierre a las 24:00 del dia completo", async () => {
    expect(await erroresDe(BusinessHourItemDto, TRAMO, "openTime")).toEqual([]);
    expect(
      await erroresDe(
        BusinessHourItemDto,
        { ...TRAMO, openTime: "00:00", closeTime: "24:00" },
        "closeTime"
      )
    ).toEqual([]);
  });

  // Cinco caracteres cualesquiera pasaban el @MaxLength(5) y llegaban al
  // servicio como si fueran una hora.
  it.each(["9:00a", "manan", "09-00", "0900"])(
    "rechaza %p, que no tiene forma de hora",
    async (openTime) => {
      expect(
        await erroresDe(BusinessHourItemDto, { ...TRAMO, openTime }, "openTime")
      ).toEqual(["Se espera una hora con formato HH:MM"]);
    }
  );
});

describe("UpdateBusinessHoursDto", () => {
  it("no exige las horas, pero las comprueba cuando vienen", async () => {
    expect(await erroresDe(UpdateBusinessHoursDto, {}, "closeTime")).toEqual(
      []
    );
    expect(
      await erroresDe(
        UpdateBusinessHoursDto,
        { closeTime: "tarde" },
        "closeTime"
      )
    ).toEqual(["Se espera una hora con formato HH:MM"]);
  });
});

describe("BatchUpsertDto", () => {
  it("acepta la lista de tramos", async () => {
    expect(
      await erroresDe(BatchUpsertDto, { hours: [TRAMO] }, "hours")
    ).toEqual([]);
  });

  // Sin @IsArray, un objeto suelto se colaba: @ValidateNested({ each: true })
  // no encuentra elementos que recorrer y da el campo por bueno.
  it("rechaza un hours que no sea una lista", async () => {
    expect(
      await erroresDe(BatchUpsertDto, { hours: TRAMO }, "hours")
    ).toContain("El horario se envia como una lista de tramos");
  });

  it("rechaza un reemplazo desmedido", async () => {
    const muchos = Array.from({ length: 501 }, () => TRAMO);
    expect(await erroresDe(BatchUpsertDto, { hours: muchos }, "hours")).toEqual(
      ["El horario no admite mas de 500 tramos"]
    );
  });
});
