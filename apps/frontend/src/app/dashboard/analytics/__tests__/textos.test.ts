import {
  textoDeFrecuencia,
  textoDeOcupacion,
  textoDeTasaCompletado,
  textoDeTasaDeRetorno,
  textoDelTicket,
} from "../textos";
import type { CifrasDelPeriodo, Retencion } from "@/lib/schemas/kpis";

/** Retención con clientes que repiten. */
function retencion(extra: Partial<Retencion> = {}): Retencion {
  return {
    clientes: 40,
    recurrentes: 12,
    tasaDeRetorno: 30,
    diasEntreVisitas: 24,
    ...extra,
  };
}

/** Cifras del periodo con lo justo para rotular las dos que pueden faltar. */
function cifras(extra: Partial<CifrasDelPeriodo> = {}): CifrasDelPeriodo {
  return {
    from: "2026-08-01",
    to: "2026-08-31",
    dias: 31,
    totalAppointments: 100,
    completedAppointments: 80,
    cancelledAppointments: 15,
    noShowAppointments: 5,
    totalRevenue: 1100000,
    avgDailyRevenue: 35484,
    completionRate: 80,
    cancellationRate: 15,
    noShowRate: 5,
    newClients: 12,
    returningClients: 40,
    avgTicket: 37500,
    ocupacion: 62,
    ...extra,
  };
}

describe("textoDelTicket", () => {
  it("da el importe cuando hay ticket", () => {
    expect(textoDelTicket(cifras({ avgTicket: 52167 }))).toContain("52.167");
  });

  it("sin cobros lo dice, en vez de enseñar un cero", () => {
    expect(textoDelTicket(cifras({ avgTicket: null }))).toBe("Sin cobros aún");
  });

  // Un ticket descuadrado no es lo mismo que no tener cobros: hay dinero, lo
  // que falta es a cuantas ventas repartirlo.
  it("con las métricas descuadradas avisa de por qué no hay cifra", () => {
    expect(
      textoDelTicket(cifras({ avgTicket: null, ticketDescuadrado: true }))
    ).toBe("Sin calcular: hay ingresos sin cobro asociado");
  });
});

describe("textoDeOcupacion", () => {
  it("da el porcentaje cuando hay capacidad medida", () => {
    expect(textoDeOcupacion(cifras({ ocupacion: 62 }))).toBe("62%");
  });

  it("distingue la agenda libre de la que aún no se ha medido", () => {
    expect(textoDeOcupacion(cifras({ ocupacion: 0 }))).toBe("0%");
    expect(textoDeOcupacion(cifras({ ocupacion: null }))).toBe("Sin datos aún");
  });
});

describe("textoDeTasaCompletado", () => {
  it("da el porcentaje cuando hubo citas", () => {
    expect(textoDeTasaCompletado(cifras())).toContain("80");
  });

  it("sin citas en el periodo no afirma un 0%", () => {
    expect(
      textoDeTasaCompletado(cifras({ totalAppointments: 0, completionRate: 0 }))
    ).toBe("Sin datos aún");
  });
});

describe("textoDeTasaDeRetorno", () => {
  it("da el porcentaje cuando hay clientes", () => {
    expect(textoDeTasaDeRetorno(retencion())).toContain("30");
  });

  it("sin clientes no afirma un 0%", () => {
    expect(
      textoDeTasaDeRetorno(
        retencion({ clientes: 0, recurrentes: 0, tasaDeRetorno: 0 })
      )
    ).toBe("Sin datos aún");
  });
});

describe("textoDeFrecuencia", () => {
  it("da los días cuando alguien ha repetido", () => {
    expect(textoDeFrecuencia(retencion())).toBe("24 días");
  });

  it("sin nadie que repita no da una frecuencia", () => {
    expect(
      textoDeFrecuencia(retencion({ recurrentes: 0, diasEntreVisitas: 0 }))
    ).toBe("Sin datos aún");
  });
});
