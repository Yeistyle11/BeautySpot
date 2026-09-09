import {
  fechaEnCastellano,
  fechaYHoraEnCastellano,
  horaEnCastellano,
} from "./fechas-en-castellano";

describe("fechaEnCastellano", () => {
  it("escribe la fecha como el resto del producto", () => {
    expect(fechaEnCastellano("2026-09-05")).toBe("5 de sept de 2026");
  });

  it("acepta tambien un instante ISO completo", () => {
    expect(fechaEnCastellano("2026-09-05T15:00:00.000Z")).toContain("2026");
  });

  // Sin el mediodia fijo, un huso negativo correria la fecha un dia atras.
  it("no corre el dia en un huso negativo", () => {
    expect(fechaEnCastellano("2026-09-05")).toContain("5");
  });

  it("devuelve el valor tal cual si no es una fecha", () => {
    expect(fechaEnCastellano("mañana")).toBe("mañana");
  });

  it("no inventa nada cuando no le dan fecha", () => {
    expect(fechaEnCastellano(undefined)).toBe("");
    expect(fechaEnCastellano(null)).toBe("");
  });
});

describe("horaEnCastellano", () => {
  it("convierte a doce horas con am y pm", () => {
    expect(horaEnCastellano("20:00")).toBe("8:00 pm");
    expect(horaEnCastellano("09:30")).toBe("9:30 am");
    expect(horaEnCastellano("12:00")).toBe("12:00 pm");
    expect(horaEnCastellano("00:15")).toBe("12:15 am");
  });

  // La madrugada se guarda como continuacion del dia: «24:30» son las 12:30 am.
  it("baja al reloj las horas de madrugada", () => {
    expect(horaEnCastellano("24:30")).toBe("12:30 am");
    expect(horaEnCastellano("25:00")).toBe("1:00 am");
  });

  it("devuelve el valor tal cual si no es una hora", () => {
    expect(horaEnCastellano("por la tarde")).toBe("por la tarde");
  });

  it("no inventa nada cuando no le dan hora", () => {
    expect(horaEnCastellano(undefined)).toBe("");
  });
});

describe("fechaYHoraEnCastellano", () => {
  it("junta las dos como las escribe el panel", () => {
    expect(fechaYHoraEnCastellano("2026-09-05", "20:00")).toBe(
      "5 de sept de 2026, 8:00 pm"
    );
  });

  it("sin hora se queda solo con la fecha", () => {
    expect(fechaYHoraEnCastellano("2026-09-05")).toBe("5 de sept de 2026");
  });
});
