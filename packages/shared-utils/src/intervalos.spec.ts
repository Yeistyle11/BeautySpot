import {
  algunSolape,
  duracionDeCliente,
  finDeOcupacion,
  intervalosDeAgenda,
  repartoPorProfesional,
  type LineaDeAgenda,
} from "./intervalos";

/** Tinte de 90 min: aplica 20, procesa 40 y remata 30. */
const TINTE: LineaDeAgenda = {
  duration: 90,
  orden: 0,
  procesadoDesde: 20,
  procesadoMinutos: 40,
  bufferDespues: 10,
};

/** Corte de 30 min sin procesado ni limpieza. */
const CORTE: LineaDeAgenda = { duration: 30, orden: 1 };

describe("intervalosDeAgenda", () => {
  it("sin líneas devuelve el bloque continuo, como siempre", () => {
    expect(intervalosDeAgenda("10:00", "11:00", [])).toEqual([
      { inicio: "10:00", fin: "11:00" },
    ]);
  });

  it("un servicio sin procesado ocupa de principio a fin", () => {
    expect(intervalosDeAgenda("10:00", "10:30", [CORTE])).toEqual([
      { inicio: "10:00", fin: "10:30" },
    ]);
  });

  it("parte el servicio en dos y deja libre el procesado", () => {
    const intervalos = intervalosDeAgenda("10:00", "11:30", [
      { ...TINTE, bufferDespues: 0 },
    ]);

    expect(intervalos).toEqual([
      { inicio: "10:00", fin: "10:20" },
      { inicio: "11:00", fin: "11:30" },
    ]);
  });

  it("ocupa la limpieza posterior, ya sin cliente delante", () => {
    const intervalos = intervalosDeAgenda("10:00", "11:30", [TINTE]);

    expect(intervalos).toContainEqual({ inicio: "11:30", fin: "11:40" });
  });

  it("encadena las líneas una detrás de otra", () => {
    const intervalos = intervalosDeAgenda("10:00", "12:00", [
      { ...TINTE, bufferDespues: 0 },
      CORTE,
    ]);

    expect(intervalos).toEqual([
      { inicio: "10:00", fin: "10:20" },
      { inicio: "11:00", fin: "11:30" },
      { inicio: "11:30", fin: "12:00" },
    ]);
  });

  it("reparte igual aunque las líneas lleguen desordenadas", () => {
    const enOrden = intervalosDeAgenda("10:00", "12:00", [TINTE, CORTE]);
    const alReves = intervalosDeAgenda("10:00", "12:00", [CORTE, TINTE]);

    expect(alReves).toEqual(enOrden);
  });

  it("ignora un procesado que no cabe en la duración de su línea", () => {
    const intervalos = intervalosDeAgenda("10:00", "10:50", [
      { duration: 50, orden: 0, procesadoDesde: 20, procesadoMinutos: 40 },
    ]);

    expect(intervalos).toEqual([{ inicio: "10:00", fin: "10:50" }]);
  });

  it("no deja intervalo vacío si el procesado arranca con el servicio", () => {
    const intervalos = intervalosDeAgenda("10:00", "11:00", [
      { duration: 60, orden: 0, procesadoDesde: 0, procesadoMinutos: 40 },
    ]);

    expect(intervalos).toEqual([{ inicio: "10:40", fin: "11:00" }]);
  });
});

describe("finDeOcupacion", () => {
  it("suma solo la limpieza de la última línea", () => {
    expect(
      finDeOcupacion("10:00", [TINTE, { ...CORTE, bufferDespues: 5 }])
    ).toBe("12:05");
  });

  it("sin líneas devuelve la propia hora de inicio", () => {
    expect(finDeOcupacion("10:00", [])).toBe("10:00");
  });
});

describe("duracionDeCliente", () => {
  it("suma las duraciones sin contar la limpieza", () => {
    expect(duracionDeCliente([TINTE, CORTE])).toBe(120);
  });
});

describe("algunSolape", () => {
  const tinte = intervalosDeAgenda("10:00", "11:30", [
    { ...TINTE, bufferDespues: 0 },
  ]);

  it("deja hueco al corte que cabe en el procesado", () => {
    const corte = intervalosDeAgenda("10:20", "10:50", [CORTE]);

    expect(algunSolape(tinte, corte)).toBe(false);
  });

  it("choca con el corte que se pasa del procesado", () => {
    const corte = intervalosDeAgenda("10:40", "11:10", [CORTE]);

    expect(algunSolape(tinte, corte)).toBe(true);
  });

  it("dos citas pegadas no se solapan", () => {
    expect(
      algunSolape(
        [{ inicio: "10:00", fin: "10:30" }],
        [{ inicio: "10:30", fin: "11:00" }]
      )
    ).toBe(false);
  });
});

describe("repartoPorProfesional", () => {
  it("sin líneas, la cita entera es del titular", () => {
    expect(repartoPorProfesional("10:00", "11:00", [], "ana")).toEqual([
      {
        professionalId: "ana",
        intervalos: [{ inicio: "10:00", fin: "11:00" }],
        inicio: "10:00",
        finDeCliente: "11:00",
        fin: "11:00",
      },
    ]);
  });

  it("las líneas sin profesional propio son del titular", () => {
    const reparto = repartoPorProfesional(
      "10:00",
      "12:00",
      [TINTE, CORTE],
      "ana"
    );

    expect(reparto).toHaveLength(1);
    expect(reparto[0].professionalId).toBe("ana");
  });

  it("una línea de otro profesional ocupa su agenda, no la del titular", () => {
    const reparto = repartoPorProfesional(
      "10:00",
      "12:00",
      [TINTE, { ...CORTE, professionalId: "bea" }],
      "ana"
    );

    expect(reparto.map((o) => o.professionalId)).toEqual(["ana", "bea"]);
    // El tinte va de 10:00 a 11:30 y su limpieza hasta las 11:40.
    expect(reparto[0].intervalos).toEqual([
      { inicio: "10:00", fin: "10:20" },
      { inicio: "11:00", fin: "11:30" },
      { inicio: "11:30", fin: "11:40" },
    ]);
    // El corte empieza donde termina el tinte, ya en la agenda de Bea.
    expect(reparto[1]).toEqual({
      professionalId: "bea",
      intervalos: [{ inicio: "11:30", fin: "12:00" }],
      inicio: "11:30",
      finDeCliente: "12:00",
      fin: "12:00",
    });
  });

  it("junta las líneas del mismo profesional aunque no vayan seguidas", () => {
    const reparto = repartoPorProfesional(
      "10:00",
      "11:30",
      [
        { duration: 30, orden: 0 },
        { duration: 30, orden: 1, professionalId: "bea" },
        { duration: 30, orden: 2 },
      ],
      "ana"
    );

    expect(reparto).toHaveLength(2);
    expect(reparto[0].intervalos).toEqual([
      { inicio: "10:00", fin: "10:30" },
      { inicio: "11:00", fin: "11:30" },
    ]);
    expect(reparto[0].inicio).toBe("10:00");
    expect(reparto[0].finDeCliente).toBe("11:30");
  });

  it("solo cuenta la limpieza de la última línea de cada profesional", () => {
    const reparto = repartoPorProfesional(
      "10:00",
      "11:00",
      [
        { duration: 30, orden: 0, bufferDespues: 15 },
        { duration: 30, orden: 1, bufferDespues: 5 },
      ],
      "ana"
    );

    expect(reparto[0].fin).toBe("11:05");
    expect(reparto[0].intervalos).toEqual([
      { inicio: "10:00", fin: "10:30" },
      { inicio: "10:30", fin: "11:00" },
      { inicio: "11:00", fin: "11:05" },
    ]);
  });
});
