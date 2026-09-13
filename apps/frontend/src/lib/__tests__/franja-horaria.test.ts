import {
  franjaDeHoras,
  franjaDeJornada,
  ordenarPorJornada,
} from "../franja-horaria";

describe("franjaDeHoras", () => {
  it("pinta la jornada por defecto cuando nada pide mas", () => {
    const horas = franjaDeHoras([]);
    expect(horas[0]).toBe(7);
    expect(horas[horas.length - 1]).toBe(20);
  });

  it("estira la rejilla para que quepa una cita tardia", () => {
    const horas = franjaDeHoras([{ inicio: "21:00", fin: "21:45" }]);
    expect(horas).toContain(21);
  });

  it("estira la rejilla hacia atras para una cita temprana", () => {
    const horas = franjaDeHoras([{ inicio: "06:00", fin: "07:00" }]);
    expect(horas[0]).toBe(6);
  });

  // Una barberia nocturna abre a las 20:00 y cierra a las 02:00: el cierre es
  // del dia siguiente, asi que la rejilla tiene que llegar a las 26 (2:00 am).
  it("cuenta la madrugada como continuacion del mismo dia", () => {
    const horas = franjaDeHoras(
      [],
      [{ openTime: "20:00", closeTime: "02:00", active: true }]
    );
    expect(horas[0]).toBe(7);
    expect(horas[horas.length - 1]).toBe(25);
    expect(horas).toContain(24);
  });

  it("no estira nada por un dia cerrado", () => {
    const horas = franjaDeHoras(
      [],
      [{ openTime: "20:00", closeTime: "02:00", active: false }]
    );
    expect(horas[horas.length - 1]).toBe(20);
  });

  it("toma el horario mas amplio de la semana", () => {
    const horas = franjaDeHoras(
      [],
      [
        { openTime: "09:00", closeTime: "18:00", active: true },
        { openTime: "20:00", closeTime: "23:00", active: true },
        { openTime: "06:00", closeTime: "14:00", active: true },
      ]
    );
    expect(horas[0]).toBe(6);
    expect(horas[horas.length - 1]).toBe(22);
  });

  it("combina el horario con lo que hay agendado fuera de el", () => {
    const horas = franjaDeHoras(
      [{ inicio: "23:00", fin: "23:30" }],
      [{ openTime: "09:00", closeTime: "18:00", active: true }]
    );
    expect(horas[horas.length - 1]).toBe(23);
  });
});

describe("franjaDeJornada", () => {
  it("recorta a la jornada del negocio con una hora de margen", () => {
    const horas = franjaDeJornada([
      { openTime: "09:00", closeTime: "20:00", active: true },
    ]);

    expect(horas[0]).toBe(8);
    expect(horas[horas.length - 1]).toBe(20);
  });

  // Quien cierra a las 02:00 cierra en la hora 26.
  it("llega a la madrugada del negocio nocturno", () => {
    const horas = franjaDeJornada([
      { openTime: "20:00", closeTime: "02:00", active: true },
    ]);

    expect(horas).toContain(25);
  });

  it("ignora los dias que el negocio no abre", () => {
    const horas = franjaDeJornada([
      { openTime: "09:00", closeTime: "18:00", active: true },
      { openTime: "00:00", closeTime: "23:59", active: false },
    ]);

    expect(horas[0]).toBe(8);
    expect(horas[horas.length - 1]).toBe(18);
  });

  it("cae en la jornada por defecto cuando no hay horario", () => {
    expect(franjaDeJornada([])).toEqual(franjaDeJornada());
  });
});

describe("ordenarPorJornada", () => {
  // El negocio abre de 20:00 a 02:00: la cola de la noche no puede encabezar la
  // lista de quien quiere reservar ese día.
  it("pone la jornada delante y la madrugada detrás", () => {
    const { enJornada, deMadrugada } = ordenarPorJornada([
      "00:00",
      "00:30",
      "01:00",
      "20:00",
      "20:30",
      "21:00",
    ]);

    expect(enJornada[0]).toBe("20:00");
    expect(deMadrugada).toEqual(["00:00", "00:30", "01:00"]);
  });

  it("no toca una jornada que no cruza la medianoche", () => {
    const horas = ["09:00", "09:30", "10:00", "17:30"];

    const { enJornada, deMadrugada } = ordenarPorJornada(horas);

    expect(enJornada).toEqual(horas);
    expect(deMadrugada).toEqual([]);
  });

  it("ordena una lista que llega desordenada", () => {
    const { enJornada } = ordenarPorJornada(["10:00", "09:00", "09:30"]);

    expect(enJornada).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("aguanta la lista vacía y la de un solo hueco", () => {
    expect(ordenarPorJornada([])).toEqual({ enJornada: [], deMadrugada: [] });
    expect(ordenarPorJornada(["08:00"])).toEqual({
      enJornada: ["08:00"],
      deMadrugada: [],
    });
  });
});
