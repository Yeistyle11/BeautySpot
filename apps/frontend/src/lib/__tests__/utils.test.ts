import {
  cn,
  formatAniosExperiencia,
  formatCurrency,
  formatDate,
  formatTime,
  toLocalDateKey,
  formatDateTime,
  formatDateTimeStamp,
  formatTimeStamp,
  haComenzado,
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

  // La agenda calcula en horas que se pasan del dia: la cita de las 23:30 que
  // dura una hora termina a las "24:30". Leerlas tal cual anunciaria las 24:30
  // como "12:30 pm", que es media jornada de diferencia.
  it("baja al reloj las horas que se pasan del dia", () => {
    expect(formatTime("24:30")).toBe("12:30 am");
    expect(formatTime("25:00")).toBe("1:00 am");
    expect(formatTime("26:00")).toBe("2:00 am");
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

describe("formatAniosExperiencia", () => {
  it("usa el singular con un solo año", () => {
    expect(formatAniosExperiencia(1)).toBe("1 año de experiencia");
  });

  it("usa el plural con varios años", () => {
    expect(formatAniosExperiencia(4)).toBe("4 años de experiencia");
  });

  it("trata el cero como plural", () => {
    expect(formatAniosExperiencia(0)).toBe("0 años de experiencia");
  });

  it("escribe año con eñe, que es texto de cara al usuario", () => {
    expect(formatAniosExperiencia(2)).toContain("años");
    expect(formatAniosExperiencia(2)).not.toContain("anos");
  });
});

describe("haComenzado", () => {
  /** Fecha y hora locales de un instante desplazado los minutos indicados. */
  const desplazado = (minutos: number) => {
    const d = new Date(Date.now() + minutos * 60 * 1000);
    const dos = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
      startTime: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
    };
  };

  it("reconoce una cita que ya empezo", () => {
    const { date, startTime } = desplazado(-30);
    expect(haComenzado(date, startTime)).toBe(true);
  });

  it("reconoce una cita que aun no empieza", () => {
    const { date, startTime } = desplazado(120);
    expect(haComenzado(date, startTime)).toBe(false);
  });

  it("da por empezada una cita de un dia anterior", () => {
    expect(haComenzado("2020-01-15", "23:59")).toBe(true);
  });

  it("no da por empezada una cita de un dia posterior", () => {
    expect(haComenzado("2999-01-15", "00:00")).toBe(false);
  });
});
