import {
  ahoraEnLaZona,
  diaSiguiente,
  esFechaPasadaEn,
  esHoraDeCierreValida,
  esHoraValida,
  esInstantePasadoEn,
  fechaDeHoyEn,
  instanteDe,
} from "./zona-horaria";

const BOGOTA = "America/Bogota";
/** Zona con horario de verano, para comprobar el salto. */
const MADRID = "Europe/Madrid";

describe("ahoraEnLaZona", () => {
  it("lee el reloj de pared de la zona, no el del proceso", () => {
    // 2026-08-10T02:30:00Z son las 21:30 del día 9 en Bogotá.
    const instante = new Date("2026-08-10T02:30:00Z");

    expect(ahoraEnLaZona(BOGOTA, instante)).toEqual({
      fecha: "2026-08-09",
      hora: "21:30",
    });
  });

  it("usa medianoche como 00, no como 24", () => {
    const instante = new Date("2026-08-10T05:00:00Z");

    expect(ahoraEnLaZona(BOGOTA, instante).hora).toBe("00:00");
  });
});

describe("fechaDeHoyEn", () => {
  // Es la franja de más facturación del día, y en un contenedor UTC ya cae en
  // la fecha siguiente.
  it("sigue siendo el mismo día pasadas las 19:00 en Colombia", () => {
    const instante = new Date("2026-08-09T23:30:00Z"); // 18:30 en Bogotá
    expect(fechaDeHoyEn(BOGOTA, instante)).toBe("2026-08-09");

    const masTarde = new Date("2026-08-10T02:00:00Z"); // 21:00 en Bogotá
    expect(fechaDeHoyEn(BOGOTA, masTarde)).toBe("2026-08-09");
  });

  it("cambia de día a la medianoche local", () => {
    const antes = new Date("2026-08-10T04:59:00Z");
    const despues = new Date("2026-08-10T05:01:00Z");

    expect(fechaDeHoyEn(BOGOTA, antes)).toBe("2026-08-09");
    expect(fechaDeHoyEn(BOGOTA, despues)).toBe("2026-08-10");
  });
});

describe("esFechaPasadaEn / esInstantePasadoEn", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 15:00 en Bogotá.
    jest.setSystemTime(new Date("2026-08-09T20:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reconoce el día de ayer como pasado y el de hoy como no", () => {
    expect(esFechaPasadaEn(BOGOTA, "2026-08-08")).toBe(true);
    expect(esFechaPasadaEn(BOGOTA, "2026-08-09")).toBe(false);
    expect(esFechaPasadaEn(BOGOTA, "2026-08-10")).toBe(false);
  });

  it("compara la hora contra el reloj del negocio", () => {
    expect(esInstantePasadoEn(BOGOTA, "2026-08-09", "14:59")).toBe(true);
    expect(esInstantePasadoEn(BOGOTA, "2026-08-09", "15:01")).toBe(false);
  });

  it("da respuestas distintas para dos negocios en zonas distintas", () => {
    // A la misma hora son las 15:00 en Bogotá y las 22:00 en Madrid, así que
    // una franja de las 20:00 ya pasó allí pero no aquí.
    expect(esInstantePasadoEn(BOGOTA, "2026-08-09", "20:00")).toBe(false);
    expect(esInstantePasadoEn(MADRID, "2026-08-09", "20:00")).toBe(true);
  });
});

describe("instanteDe", () => {
  it("traduce la medianoche local al instante que le corresponde", () => {
    // Bogotá va cinco horas por detrás de UTC todo el año.
    expect(instanteDe(BOGOTA, "2026-08-09", "00:00").toISOString()).toBe(
      "2026-08-09T05:00:00.000Z"
    );
  });

  it("resuelve una zona con horario de verano a cada lado del salto", () => {
    // Madrid: UTC+2 en agosto, UTC+1 en enero.
    expect(instanteDe(MADRID, "2026-08-09", "00:00").toISOString()).toBe(
      "2026-08-08T22:00:00.000Z"
    );
    expect(instanteDe(MADRID, "2026-01-09", "00:00").toISOString()).toBe(
      "2026-01-08T23:00:00.000Z"
    );
  });

  it("acierta en el mismo día del cambio de hora", () => {
    // El 29 de marzo de 2026 Madrid adelanta el reloj a las 02:00, así que la
    // medianoche de ese día todavía es UTC+1 y el mediodía ya es UTC+2.
    expect(instanteDe(MADRID, "2026-03-29", "00:00").toISOString()).toBe(
      "2026-03-28T23:00:00.000Z"
    );
    expect(instanteDe(MADRID, "2026-03-29", "12:00").toISOString()).toBe(
      "2026-03-29T10:00:00.000Z"
    );
  });

  it("rechaza una fecha que no existe", () => {
    expect(() => instanteDe(BOGOTA, "no-es-fecha", "10:00")).toThrow(
      RangeError
    );
  });
});

describe("diaSiguiente", () => {
  it("avanza un día", () => {
    expect(diaSiguiente("2026-08-09")).toBe("2026-08-10");
  });

  it("cruza el fin de mes y el de año", () => {
    expect(diaSiguiente("2026-08-31")).toBe("2026-09-01");
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });

  it("cuenta el 29 de febrero de un año bisiesto", () => {
    expect(diaSiguiente("2028-02-28")).toBe("2028-02-29");
  });
});

describe("esHoraValida", () => {
  it.each(["00:00", "09:30", "23:59"])("acepta %s", (hora) => {
    expect(esHoraValida(hora)).toBe(true);
  });

  // Una hora mal formada da NaN al pasarla a minutos, y las comparaciones de
  // horario salen falsas sin avisar.
  it.each(["9:0", "24:00", "23:60", "abc", "", "10:00:00"])(
    "rechaza %s",
    (hora) => {
      expect(esHoraValida(hora)).toBe(false);
    }
  );
});

describe("esHoraDeCierreValida", () => {
  // La madrugada se cuenta desde la medianoche del día que abrió: cerrar a las
  // 2 de la mañana es cerrar a las 26:00.
  it.each(["00:00", "18:00", "23:59", "24:00", "26:00", "31:59"])(
    "acepta %s",
    (hora) => {
      expect(esHoraDeCierreValida(hora)).toBe(true);
    }
  );

  it.each(["32:00", "40:00", "9:0", "23:60", "abc", "", "26:00:00"])(
    "rechaza %s",
    (hora) => {
      expect(esHoraDeCierreValida(hora)).toBe(false);
    }
  );
});
