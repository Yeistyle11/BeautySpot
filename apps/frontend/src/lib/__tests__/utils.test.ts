import {
  cn,
  formatCurrency,
  formatDate,
  formatTime,
  toLocalDateKey,
  formatDateTime,
  formatDateTimeStamp,
  formatTimeStamp,
  getErrorMessage,
} from "../utils";

describe("cn", () => {
  it("combina clases y resuelve conflictos de Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignora valores falsy", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  it("formatea montos como pesos colombianos sin decimales", () => {
    expect(formatCurrency(15000)).toContain("15.000");
  });

  it("formatea cero correctamente", () => {
    expect(formatCurrency(0)).toContain("0");
  });
});

describe("formatDate", () => {
  it("formatea una fecha ISO (YYYY-MM-DD) en formato legible es-CO", () => {
    const result = formatDate("2026-03-15");
    expect(result).toContain("2026");
    expect(result.toLowerCase()).toContain("mar");
  });
});

describe("formatDate con timestamp ISO completo", () => {
  it("no rompe cuando recibe un ISO con hora y timezone", () => {
    const result = formatDate("2026-03-15T23:00:00.000Z");
    expect(result).toContain("2026");
  });
});

describe("formatTime", () => {
  it("convierte horas de la manana a formato 12h", () => {
    expect(formatTime("09:30")).toBe("9:30 am");
  });

  it("convierte horas de la tarde a formato 12h", () => {
    expect(formatTime("14:00")).toBe("2:00 pm");
  });

  it("maneja mediodia como 12pm", () => {
    expect(formatTime("12:00")).toBe("12:00 pm");
  });

  it("maneja medianoche como 12am", () => {
    expect(formatTime("00:00")).toBe("12:00 am");
  });
});

describe("formatDateTime", () => {
  it("combina fecha y hora formateadas", () => {
    const result = formatDateTime("2026-03-15", "14:00");
    expect(result).toBe(`${formatDate("2026-03-15")} ${formatTime("14:00")}`);
  });
});

describe("formatDateTimeStamp", () => {
  it("formatea un timestamp ISO con fecha y hora", () => {
    const result = formatDateTimeStamp("2026-03-15T14:30:00.000Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatTimeStamp", () => {
  it("formatea solo la hora de un timestamp ISO", () => {
    const result = formatTimeStamp("2026-03-15T14:30:00.000Z");
    expect(result).toMatch(/^\d{1,2}:\d{2}\s?(a\.?\s?m\.?|p\.?\s?m\.?)$/i);
  });
});

describe("getErrorMessage", () => {
  it("extrae el mensaje de un Error", () => {
    expect(getErrorMessage(new Error("algo fallo"))).toBe("algo fallo");
  });

  it("devuelve el string directamente si el error es un string", () => {
    expect(getErrorMessage("error crudo")).toBe("error crudo");
  });

  it("devuelve el fallback para tipos desconocidos", () => {
    expect(getErrorMessage({ weird: true }, "fallback")).toBe("fallback");
  });

  it("usa 'Error' como fallback por defecto", () => {
    expect(getErrorMessage(null)).toBe("Error");
  });
});

describe("toLocalDateKey", () => {
  it("usa el dia local, no el UTC", () => {
    // 20:30 en UTC-5 ya es el dia siguiente en UTC: toISOString() habria
    // devuelto el 16.
    const nocheDel15 = new Date(2026, 6, 15, 20, 30, 0);
    expect(toLocalDateKey(nocheDel15)).toBe("2026-07-15");
  });

  it("rellena mes y dia a dos digitos", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("respeta el primer instante del dia", () => {
    expect(toLocalDateKey(new Date(2026, 11, 31, 0, 0, 0))).toBe("2026-12-31");
  });
});
