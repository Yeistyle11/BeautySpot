import {
  cabecerasDelResumen,
  exportarProfesionales,
  exportarResumen,
  exportarServicios,
  filasDelResumen,
} from "../export";
import type { CifrasDelPeriodo } from "@/lib/schemas/kpis";
import { downloadCsv } from "@/lib/export-csv";

// La descarga en sí ya está probada donde vive; aquí lo que importa es qué
// filas se le entregan.
jest.mock("@/lib/export-csv", () => ({
  downloadCsv: jest.fn(),
}));

const PERIODO = { from: "2026-08-01", to: "2026-08-31" };

/** Cifras del periodo con lo justo para armar el CSV. */
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

/** Fila del resumen cuyo indicador empieza por ese texto. */
function fila(filas: unknown[][], indicador: string) {
  return filas.find((f) => String(f[0]).startsWith(indicador));
}

beforeEach(() => {
  (downloadCsv as jest.Mock).mockClear();
});

describe("filasDelResumen", () => {
  // Quien abre esto en una hoja de calculo va a sumar y a graficar: un
  // "$ 1.100.000" seria texto y no un numero.
  it("exporta las cifras en bruto, sin formato de moneda", () => {
    const filas = filasDelResumen(cifras());

    expect(fila(filas, "Ingresos")).toEqual(["Ingresos", 1100000, null, null]);
  });

  it("sin comparativa no inventa columnas de periodo anterior", () => {
    const filas = filasDelResumen(cifras());

    expect(fila(filas, "Citas totales")).toEqual([
      "Citas totales",
      100,
      null,
      null,
    ]);
  });

  it("con comparativa lleva la cifra anterior y su variación", () => {
    const filas = filasDelResumen(
      cifras(),
      cifras({ totalRevenue: 1000000, totalAppointments: 50 })
    );

    expect(fila(filas, "Ingresos")).toEqual(["Ingresos", 1100000, 1000000, 10]);
    expect(fila(filas, "Citas totales")).toEqual([
      "Citas totales",
      100,
      50,
      100,
    ]);
  });

  // Sin cobros no hay ticket que promediar; un cero ahi se leeria como que el
  // negocio no vende.
  it("deja el ticket medio vacío cuando no hubo cobros", () => {
    const filas = filasDelResumen(cifras({ avgTicket: null }));

    expect(fila(filas, "Ticket medio")).toEqual([
      "Ticket medio",
      null,
      null,
      null,
    ]);
  });

  it("no inventa una variación cuando antes no había nada", () => {
    const filas = filasDelResumen(cifras(), cifras({ totalRevenue: 0 }));

    expect(fila(filas, "Ingresos")).toEqual(["Ingresos", 1100000, 0, null]);
  });
});

describe("cabecerasDelResumen", () => {
  it("solo nombra el periodo anterior cuando se está comparando", () => {
    expect(cabecerasDelResumen(false)).toEqual(["Indicador", "Periodo"]);
    expect(cabecerasDelResumen(true)).toHaveLength(4);
  });
});

describe("exportarResumen", () => {
  it("nombra el archivo con el periodo exportado", () => {
    exportarResumen(PERIODO, cifras());

    expect(downloadCsv).toHaveBeenCalledWith(
      "reporte_2026-08-01_2026-08-31",
      ["Indicador", "Periodo"],
      expect.any(Array)
    );
  });

  it("un periodo de un día se nombra por esa fecha", () => {
    exportarResumen({ from: "2026-08-17", to: "2026-08-17" }, cifras());

    expect(downloadCsv).toHaveBeenCalledWith(
      "reporte_2026-08-17",
      expect.any(Array),
      expect.any(Array)
    );
  });

  it("sin comparativa recorta las filas a dos columnas", () => {
    exportarResumen(PERIODO, cifras());

    const [, , filas] = (downloadCsv as jest.Mock).mock.calls[0];
    expect(filas[0]).toHaveLength(2);
  });

  it("con comparativa mantiene las cuatro columnas", () => {
    exportarResumen(PERIODO, cifras(), cifras({ totalRevenue: 1000000 }));

    const [, cabeceras, filas] = (downloadCsv as jest.Mock).mock.calls[0];
    expect(cabeceras).toHaveLength(4);
    expect(filas[0]).toHaveLength(4);
  });
});

describe("exportarServicios", () => {
  it("lleva cada servicio con sus cifras del periodo", () => {
    exportarServicios(PERIODO, [
      {
        serviceId: "s-1",
        serviceName: "Corte clásico",
        veces: 12,
        ingresos: 360000,
        minutos: 360,
        ingresoPorHora: 60000,
      },
    ]);

    expect(downloadCsv).toHaveBeenCalledWith(
      "servicios_2026-08-01_2026-08-31",
      expect.arrayContaining(["Servicio", "Ingreso por hora"]),
      [["Corte clásico", 12, 360000, 360, 60000]]
    );
  });
});

describe("exportarProfesionales", () => {
  const ana = {
    professionalId: "p-1",
    nombre: "Ana",
    appointments: 30,
    revenue: 900000,
    avgRating: 4.8,
    days: 20,
  };

  it("lleva a cada profesional con lo que hizo en el periodo", () => {
    exportarProfesionales(PERIODO, [ana]);

    expect(downloadCsv).toHaveBeenCalledWith(
      "profesionales_2026-08-01_2026-08-31",
      expect.arrayContaining(["Profesional", "Valoracion"]),
      [["Ana", 30, 900000, 4.8, 20]]
    );
  });

  // Un cero en valoración se leería como la peor nota posible, y lo que pasa
  // es que todavía no la ha valorado nadie.
  it("deja la valoración vacía si nadie le ha puntuado", () => {
    exportarProfesionales(PERIODO, [{ ...ana, avgRating: 0 }]);

    const [, , filas] = (downloadCsv as jest.Mock).mock.calls[0];
    expect(filas[0][3]).toBeNull();
  });
});
