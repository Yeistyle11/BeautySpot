import { fireEvent, render, screen } from "@testing-library/react";
import { SpecialDaysCard } from "../special-days-card";
import type { DiaEspecial } from "../schemas";

const FESTIVO: DiaEspecial = {
  id: "dia-1",
  startDate: "2026-07-20",
  endDate: "2026-07-20",
  closed: true,
  openTime: null,
  closeTime: null,
  motivo: "20 de julio",
};

const VACACIONES: DiaEspecial = {
  id: "dia-2",
  startDate: "2026-12-24",
  endDate: "2027-01-02",
  closed: true,
  openTime: null,
  closeTime: null,
  motivo: "Vacaciones",
};

/** La tarjeta con los días que se indiquen y todos los permisos. */
function pintar(dias: DiaEspecial[], props = {}) {
  return render(
    <SpecialDaysCard
      dias={dias}
      onCreate={jest.fn()}
      onRemove={jest.fn()}
      saving={false}
      role="OWNER"
      {...props}
    />
  );
}

describe("SpecialDaysCard", () => {
  it("dice que no hay ninguno declarado", () => {
    pintar([]);

    expect(screen.getByText(/Todavía no hay ninguno/)).toBeInTheDocument();
  });

  it("lista el festivo de un solo día", () => {
    pintar([FESTIVO]);

    expect(screen.getByText("20 de julio")).toBeInTheDocument();
    expect(screen.getByText(/Cerrado/)).toBeInTheDocument();
  });

  it("lista el rango de las vacaciones", () => {
    pintar([VACACIONES]);

    expect(screen.getByText(/al 2 de ene/)).toBeInTheDocument();
  });

  it("dice el horario propio del día que abre distinto", () => {
    pintar([
      {
        ...FESTIVO,
        closed: false,
        openTime: "09:00",
        closeTime: "14:00",
        motivo: "Nochebuena",
      },
    ]);

    expect(screen.getByText(/Abre de 09:00 a 14:00/)).toBeInTheDocument();
  });

  it("declara un festivo con el rango de un día", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    pintar([], { onCreate });

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-07-20" },
    });
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "20 de julio" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Añadir día/ }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        closed: true,
        motivo: "20 de julio",
      })
    );
  });

  it("no deja añadir sin fecha ni motivo", () => {
    pintar([]);

    expect(screen.getByRole("button", { name: /Añadir día/ })).toBeDisabled();
  });

  it("quita el día especial", () => {
    const onRemove = jest.fn();
    pintar([FESTIVO], { onRemove });

    fireEvent.click(screen.getByRole("button", { name: /Quitar 20 de julio/ }));

    expect(onRemove).toHaveBeenCalledWith("dia-1");
  });

  it("a quien no puede editar le deja mirar, no tocar", () => {
    pintar([FESTIVO], { role: "RECEPTIONIST" });

    expect(screen.getByText("20 de julio")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Añadir día/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Quitar/ })
    ).not.toBeInTheDocument();
  });
});
