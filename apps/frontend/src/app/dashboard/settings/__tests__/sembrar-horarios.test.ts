import { DAYS, sembrarHorarios, type BusinessHour } from "../schemas";

/**
 * El horario del negocio se guardaba una sola vez: el formulario se sembraba
 * con las entidades tal como llegan de la API y las reenviaba enteras, con su
 * `id`, que el validador del backend rechaza. Estas pruebas fijan que lo
 * sembrado tenga exactamente la forma que admite BusinessHourItemDto.
 */

const SABADO: BusinessHour = {
  id: "bh-1",
  dayOfWeek: 6,
  openTime: "20:00",
  closeTime: "02:00",
  active: true,
};

describe("sembrarHorarios", () => {
  it("no arrastra el id de la entidad guardada", () => {
    const sembrado = sembrarHorarios([SABADO]);
    const sabado = sembrado.find((h) => h.dayOfWeek === 6);

    expect(sabado).toEqual({
      dayOfWeek: 6,
      openTime: "20:00",
      closeTime: "02:00",
      active: true,
    });
    expect(sabado).not.toHaveProperty("id");
  });

  it("no deja pasar ningún campo fuera del DTO", () => {
    // Un tramo con los campos que trae la entidad completa: si alguno se cuela,
    // el PUT vuelve con un 400 y el horario deja de poder cambiarse.
    const conSobras = {
      ...SABADO,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-08-22T00:00:00Z",
      businessId: "biz-1",
    } as unknown as BusinessHour;

    for (const tramo of sembrarHorarios([conSobras])) {
      expect(Object.keys(tramo).sort()).toEqual([
        "active",
        "closeTime",
        "dayOfWeek",
        "openTime",
      ]);
    }
  });

  it("completa los días sin tramo guardado como cerrados", () => {
    const sembrado = sembrarHorarios([SABADO]);

    expect(sembrado).toHaveLength(DAYS.length);
    expect(sembrado.filter((h) => h.active)).toHaveLength(1);
    expect(sembrado.find((h) => h.dayOfWeek === 0)).toEqual({
      dayOfWeek: 0,
      openTime: "08:00",
      closeTime: "18:00",
      active: false,
    });
  });

  it("conserva el orden de la semana, de lunes a domingo", () => {
    expect(sembrarHorarios([]).map((h) => h.dayOfWeek)).toEqual([
      1, 2, 3, 4, 5, 6, 0,
    ]);
  });
});
