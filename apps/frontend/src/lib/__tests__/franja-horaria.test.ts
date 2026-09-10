import { franjaDeHoras } from "../franja-horaria";

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
