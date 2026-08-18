import { render, screen } from "@testing-library/react";
import {
  filasDeProfesionales,
  ProfessionalsTable,
} from "../professionals-table";
import type { ReporteProfesionales } from "@/lib/schemas/kpis";

/** Reporte tal como lo sirve analytics: solo identificadores y cifras. */
function reporte(
  professionals: ReporteProfesionales["professionals"]
): ReporteProfesionales {
  return { period: { from: "2026-08-01", to: "2026-08-31" }, professionals };
}

const ANA = {
  professionalId: "p-1",
  appointments: 30,
  revenue: 900000,
  avgRating: 4.8,
  days: 20,
};
const LUIS = {
  professionalId: "p-2",
  appointments: 40,
  revenue: 1200000,
  avgRating: 4.5,
  days: 22,
};

const EQUIPO = [
  { id: "p-1", name: "Ana Gómez" },
  { id: "p-2", name: "Luis Díaz" },
];

describe("filasDeProfesionales", () => {
  it("pone nombre a cada fila cruzando con el equipo", () => {
    const filas = filasDeProfesionales(reporte([ANA]), EQUIPO);

    expect(filas[0].nombre).toBe("Ana Gómez");
  });

  it("ordena por lo que ingresó cada uno", () => {
    const filas = filasDeProfesionales(reporte([ANA, LUIS]), EQUIPO);

    expect(filas.map((f) => f.nombre)).toEqual(["Luis Díaz", "Ana Gómez"]);
  });

  // Su trabajo cuenta en el periodo aunque ya no esté en el equipo: quitarlo
  // haría que los ingresos de la tabla no sumaran los del negocio.
  it("no descarta a quien ya no está en el equipo", () => {
    const filas = filasDeProfesionales(reporte([ANA]), []);

    expect(filas).toHaveLength(1);
    expect(filas[0].nombre).toBe("Profesional dado de baja");
  });

  it("aguanta que aún no haya llegado ni el reporte ni el equipo", () => {
    expect(filasDeProfesionales(undefined, undefined)).toEqual([]);
  });
});

describe("ProfessionalsTable", () => {
  it("muestra las cifras de cada profesional", () => {
    render(
      <ProfessionalsTable
        filas={filasDeProfesionales(reporte([ANA]), EQUIPO)}
      />
    );

    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("4.80")).toBeInTheDocument();
  });

  // Un cero se leería como la peor nota, y lo que pasa es que nadie la ha
  // valorado todavía.
  it("no pinta un cero donde no hay valoraciones", () => {
    render(
      <ProfessionalsTable
        filas={filasDeProfesionales(
          reporte([{ ...ANA, avgRating: 0 }]),
          EQUIPO
        )}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("dice que no hubo actividad en vez de una tabla vacía", () => {
    render(<ProfessionalsTable filas={[]} />);

    expect(screen.getByText(/nadie atendió citas/i)).toBeInTheDocument();
  });
});
