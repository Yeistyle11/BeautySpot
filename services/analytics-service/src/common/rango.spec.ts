import { BadRequestException, ValidationPipe } from "@nestjs/common";
import {
  RangoQueryDto,
  rangoPedido,
  periodoAnterior,
  diasEntre,
  sumarDias,
} from "./rango.dto";

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const metadata = { type: "query" as const, metatype: RangoQueryDto };

describe("rangoPedido", () => {
  it("sin fechas no hay periodo pedido, y cada endpoint pone el suyo", () => {
    expect(rangoPedido({})).toBeNull();
  });

  it("devuelve el periodo cuando llegan los dos extremos", () => {
    expect(rangoPedido({ from: "2026-08-01", to: "2026-08-31" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("acepta un periodo de un solo día", () => {
    expect(rangoPedido({ from: "2026-08-17", to: "2026-08-17" })).toEqual({
      from: "2026-08-17",
      to: "2026-08-17",
    });
  });

  it.each([
    ["solo el inicio", { from: "2026-08-01" }],
    ["solo el fin", { to: "2026-08-31" }],
  ])("rechaza un periodo con %s", (_caso, query) => {
    expect(() => rangoPedido(query)).toThrow(BadRequestException);
  });

  // Darle la vuelta a los extremos devolvería cifras que no se parecen a lo
  // que se pidió, y quien las lea no sabrá que miró otro periodo.
  it("rechaza el periodo invertido en vez de corregirlo", () => {
    expect(() => rangoPedido({ from: "2026-08-31", to: "2026-08-01" })).toThrow(
      "posterior"
    );
  });
});

describe("periodoAnterior", () => {
  it("el mes anterior acaba justo antes y dura lo mismo", () => {
    expect(periodoAnterior({ from: "2026-08-01", to: "2026-08-31" })).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("la semana anterior son los siete días previos", () => {
    expect(periodoAnterior({ from: "2026-08-10", to: "2026-08-16" })).toEqual({
      from: "2026-08-03",
      to: "2026-08-09",
    });
  });

  it("el día anterior a un solo día es el día de antes", () => {
    expect(periodoAnterior({ from: "2026-08-17", to: "2026-08-17" })).toEqual({
      from: "2026-08-16",
      to: "2026-08-16",
    });
  });

  // Se cuenta en días: febrero contra marzo compararía 28 con 31, y la
  // diferencia que saldría sería la del calendario, no la del negocio.
  it("compara febrero contra los mismos 28 días de antes", () => {
    expect(periodoAnterior({ from: "2026-02-01", to: "2026-02-28" })).toEqual({
      from: "2026-01-04",
      to: "2026-01-31",
    });
  });
});

describe("diasEntre", () => {
  it("cuenta los dos extremos", () => {
    expect(diasEntre("2026-08-01", "2026-08-01")).toBe(1);
    expect(diasEntre("2026-08-01", "2026-08-31")).toBe(31);
  });

  it("cuenta el 29 de febrero de un año bisiesto", () => {
    expect(diasEntre("2024-02-01", "2024-02-29")).toBe(29);
  });

  // Se cuenta en UTC: un cambio de horario de verano no cuela un dia de mas
  // ni de menos.
  it("no se descuadra al cruzar un cambio de hora", () => {
    expect(diasEntre("2026-03-01", "2026-04-30")).toBe(61);
  });
});

describe("sumarDias", () => {
  it("cruza el fin de mes", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("cruza el fin de año", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("RangoQueryDto", () => {
  it("acepta un periodo con fechas reales", async () => {
    await expect(
      pipe.transform({ from: "2026-08-01", to: "2026-08-31" }, metadata)
    ).resolves.toMatchObject({ from: "2026-08-01" });
  });

  // Tiene forma de fecha y no existe: dejarla pasar da un rango que compara
  // contra nada y devuelve ceros sin decir por qué.
  it("rechaza un día que no existe en el calendario", async () => {
    await expect(
      pipe.transform({ from: "2026-02-30", to: "2026-08-31" }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lee comparar tal como llega en la URL", async () => {
    await expect(
      pipe.transform({ comparar: "true" }, metadata)
    ).resolves.toMatchObject({ comparar: true });
    await expect(
      pipe.transform({ comparar: "false" }, metadata)
    ).resolves.toMatchObject({ comparar: false });
  });
});
