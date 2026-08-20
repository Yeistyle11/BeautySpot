import {
  diasDelPeriodo,
  nombreDelPeriodo,
  periodoValido,
  resolverPeriodo,
  variacion,
  PERIODO_POR_DEFECTO,
} from "@/lib/periodo";

// Un lunes de agosto, para que la semana y el mes se vean por separado.
const LUNES = new Date(2026, 7, 17, 12, 0, 0);

describe("resolverPeriodo", () => {
  it("hoy es un solo día", () => {
    expect(resolverPeriodo("hoy", LUNES)).toEqual({
      from: "2026-08-17",
      to: "2026-08-17",
    });
  });

  it("ayer también, pero el de antes", () => {
    expect(resolverPeriodo("ayer", LUNES)).toEqual({
      from: "2026-08-16",
      to: "2026-08-16",
    });
  });

  it("la semana empieza el lunes", () => {
    expect(resolverPeriodo("semana", LUNES)).toEqual({
      from: "2026-08-17",
      to: "2026-08-17",
    });
  });

  // El domingo cierra la semana que empezó el lunes anterior, no abre una.
  it("el domingo pertenece a la semana que ya iba", () => {
    const domingo = new Date(2026, 7, 23, 12, 0, 0);

    expect(resolverPeriodo("semana", domingo)).toEqual({
      from: "2026-08-17",
      to: "2026-08-23",
    });
  });

  // Es la queja concreta del informe: la ventana móvil no cuadra con el mes
  // con el que se factura y se declara.
  it("el mes va del día 1 a hoy", () => {
    expect(resolverPeriodo("mes", LUNES)).toEqual({
      from: "2026-08-01",
      to: "2026-08-17",
    });
  });

  it("el mes pasado va entero, de su día 1 a su último día", () => {
    expect(resolverPeriodo("mesPasado", LUNES)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("el mes pasado de enero es diciembre del año anterior", () => {
    const enero = new Date(2026, 0, 15, 12, 0, 0);

    expect(resolverPeriodo("mesPasado", enero)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("el mes pasado de marzo respeta los 28 de febrero", () => {
    const marzo = new Date(2026, 2, 10, 12, 0, 0);

    expect(resolverPeriodo("mesPasado", marzo)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  // Se retroceden veintinueve dias: hoy cuenta.
  it("los últimos 30 días son treinta días", () => {
    const rango = resolverPeriodo("ultimos30", LUNES);

    expect(rango).toEqual({ from: "2026-07-19", to: "2026-08-17" });
    expect(diasDelPeriodo(rango)).toBe(30);
  });

  it("el año va del 1 de enero a hoy", () => {
    expect(resolverPeriodo("anio", LUNES)).toEqual({
      from: "2026-01-01",
      to: "2026-08-17",
    });
  });

  it("la pantalla abre en el mes natural", () => {
    expect(PERIODO_POR_DEFECTO).toBe("mes");
    expect(resolverPeriodo(PERIODO_POR_DEFECTO, LUNES).from).toBe("2026-08-01");
  });
});

describe("diasDelPeriodo", () => {
  it("cuenta los dos extremos", () => {
    expect(diasDelPeriodo({ from: "2026-08-17", to: "2026-08-17" })).toBe(1);
    expect(diasDelPeriodo({ from: "2026-08-01", to: "2026-08-31" })).toBe(31);
  });

  it("cuenta el 29 de febrero de un bisiesto", () => {
    expect(diasDelPeriodo({ from: "2024-02-01", to: "2024-02-29" })).toBe(29);
  });
});

describe("periodoValido", () => {
  it("acepta un periodo completo y en orden", () => {
    expect(periodoValido({ from: "2026-08-01", to: "2026-08-31" })).toBe(true);
    expect(periodoValido({ from: "2026-08-01", to: "2026-08-01" })).toBe(true);
  });

  it("rechaza el periodo al revés o a medias", () => {
    expect(periodoValido({ from: "2026-08-31", to: "2026-08-01" })).toBe(false);
    expect(periodoValido({ from: "", to: "2026-08-01" })).toBe(false);
    expect(periodoValido({ from: "2026-08-01", to: "" })).toBe(false);
  });
});

describe("variacion", () => {
  it("mide la subida y la bajada en porcentaje", () => {
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(80, 100)).toBe(-20);
    expect(variacion(100, 100)).toBe(0);
  });

  // Pasar de cero a cinco no es un aumento del quinientos por ciento: es que
  // antes no habia con que comparar, y una flecha ahi solo confunde.
  it("no inventa una variación cuando antes no había nada", () => {
    expect(variacion(5, 0)).toBeNull();
    expect(variacion(5, null)).toBeNull();
    expect(variacion(5, undefined)).toBeNull();
  });
});

describe("nombreDelPeriodo", () => {
  it("un solo día se nombra por su fecha", () => {
    expect(nombreDelPeriodo({ from: "2026-08-17", to: "2026-08-17" })).toBe(
      "2026-08-17"
    );
  });

  it("un rango nombra sus dos extremos", () => {
    expect(nombreDelPeriodo({ from: "2026-08-01", to: "2026-08-31" })).toBe(
      "2026-08-01_2026-08-31"
    );
  });
});
