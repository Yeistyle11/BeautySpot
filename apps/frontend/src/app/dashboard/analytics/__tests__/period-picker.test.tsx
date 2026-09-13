import { fireEvent, render, screen } from "@testing-library/react";
import { PeriodPicker } from "../period-picker";
import { MetricRow } from "../metric-row";
import type { PeriodoId } from "@/lib/periodo";

const PERIODO = { from: "2026-08-01", to: "2026-08-31" };

/** Monta el selector y devuelve los espías de sus dos salidas. */
function pintar(seleccionado: PeriodoId = "mes", periodo = PERIODO) {
  const onSeleccionar = jest.fn();
  const onPersonalizar = jest.fn();
  render(
    <PeriodPicker
      seleccionado={seleccionado}
      periodo={periodo}
      onSeleccionar={onSeleccionar}
      onPersonalizar={onPersonalizar}
    />
  );
  return { onSeleccionar, onPersonalizar };
}

describe("PeriodPicker", () => {
  it("ofrece los periodos con los que trabaja un negocio", () => {
    pintar();

    const opciones = screen.getAllByRole("option").map((o) => o.textContent);

    expect(opciones).toEqual([
      "Hoy",
      "Ayer",
      "Esta semana",
      "Este mes",
      "Mes pasado",
      "Últimos 30 días",
      "Este año",
      "Personalizado",
    ]);
  });

  it("marca cuál está elegido", () => {
    pintar("mes");

    expect(screen.getByLabelText("Periodo")).toHaveValue("mes");
  });

  it("avisa del periodo elegido", () => {
    const { onSeleccionar } = pintar();

    fireEvent.change(screen.getByLabelText("Periodo"), {
      target: { value: "mesPasado" },
    });

    expect(onSeleccionar).toHaveBeenCalledWith("mesPasado");
  });

  // Las fechas se ven resueltas para cualquier periodo y se pueden escribir
  // siempre.
  it("muestra las fechas resueltas del atajo elegido", () => {
    pintar("mes");

    expect(screen.getByLabelText("Desde")).toHaveValue("2026-08-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-08-31");
  });

  it("deja escribir las dos fechas sin elegir antes el periodo a medida", () => {
    const { onPersonalizar } = pintar("mes");

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-07-01" },
    });

    expect(onPersonalizar).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-08-31",
    });
  });

  it("dice cuántos días abarca el periodo", () => {
    pintar("mes");

    expect(screen.getByText("31 días")).toBeInTheDocument();
  });

  // Darle la vuelta a las fechas devolvería cifras de un periodo que nadie
  // pidió, y quien las lea no lo sabrá.
  it("avisa del periodo invertido en vez de corregirlo", () => {
    pintar("personalizado", { from: "2026-08-31", to: "2026-08-01" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /anterior a la de fin/i
    );
  });

  it("no avisa cuando el periodo está en orden", () => {
    pintar("personalizado");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("MetricRow", () => {
  it("muestra la cifra sin comparativa cuando no hay con qué comparar", () => {
    render(<MetricRow etiqueta="Ingresos" valor="$ 100" actual={100} />);

    expect(screen.getByText("$ 100")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("muestra la subida frente al periodo anterior", () => {
    render(
      <MetricRow
        etiqueta="Ingresos"
        valor="$ 150"
        actual={150}
        anterior={100}
      />
    );

    expect(screen.getByText("+50%")).toBeInTheDocument();
  });

  it("muestra la bajada con su signo", () => {
    render(
      <MetricRow etiqueta="Ingresos" valor="$ 80" actual={80} anterior={100} />
    );

    expect(screen.getByText("-20%")).toBeInTheDocument();
  });

  it("pinta como mejora que bajen las cancelaciones", () => {
    render(
      <MetricRow
        etiqueta="Canceladas"
        valor={5}
        actual={5}
        anterior={10}
        bajarEsBueno
      />
    );

    expect(screen.getByText("-50%")).toHaveClass("text-success");
  });

  it("pinta como empeoramiento que suban las cancelaciones", () => {
    render(
      <MetricRow
        etiqueta="Canceladas"
        valor={10}
        actual={10}
        anterior={5}
        bajarEsBueno
      />
    );

    expect(screen.getByText("+100%")).toHaveClass("text-destructive");
  });

  it("no inventa una variación cuando antes no había nada", () => {
    render(
      <MetricRow etiqueta="Ingresos" valor="$ 100" actual={100} anterior={0} />
    );

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
