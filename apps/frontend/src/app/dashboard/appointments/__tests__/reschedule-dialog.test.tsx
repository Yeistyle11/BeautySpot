import { fireEvent, render, screen } from "@testing-library/react";
import { RescheduleDialog } from "../reschedule-dialog";
import type { Appointment } from "../schemas";

let huecos: { startTime: string; endTime: string; available: boolean }[] = [];

jest.mock("@/lib/swr", () => ({
  useApi: (clave: string | null) => ({
    data: clave ? huecos : undefined,
    isLoading: false,
  }),
}));

const CITA = {
  id: "appt-1",
  date: "2026-08-20",
  startTime: "10:00",
  endTime: "10:30",
  status: "CONFIRMED",
  professionalId: "prof-1",
  appointmentServices: [{ serviceName: "Barba", price: 30000, duration: 30 }],
} as unknown as Appointment;

/** El diálogo abierto sobre esa cita, con los huecos que se hayan sembrado. */
function pintar(props = {}) {
  return render(
    <RescheduleDialog
      open
      onClose={jest.fn()}
      appointment={CITA}
      onConfirm={jest.fn()}
      pending={false}
      {...props}
    />
  );
}

describe("RescheduleDialog", () => {
  beforeEach(() => {
    huecos = [
      { startTime: "11:00", endTime: "11:30", available: true },
      { startTime: "12:00", endTime: "12:30", available: false },
    ];
  });

  it("dice dónde está la cita ahora", () => {
    pintar();

    expect(screen.getByText(/10:00 am/)).toBeInTheDocument();
    expect(screen.getByText(/30 minutos/)).toBeInTheDocument();
  });

  it("ofrece solo los huecos libres", () => {
    pintar();

    expect(
      screen.getByRole("button", { name: "11:00 am" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "12:00 pm" })
    ).not.toBeInTheDocument();
  });

  it("mueve la cita al hueco elegido", () => {
    const onConfirm = jest.fn();
    pintar({ onConfirm });

    fireEvent.click(screen.getByRole("button", { name: "11:00 am" }));
    fireEvent.click(screen.getByRole("button", { name: /Mover la cita/ }));

    expect(onConfirm).toHaveBeenCalledWith("2026-08-20", "11:00");
  });

  it("no deja mover sin elegir hueco", () => {
    pintar();

    expect(
      screen.getByRole("button", { name: /Mover la cita/ })
    ).toBeDisabled();
  });

  it("dice que el día no tiene huecos", () => {
    huecos = [];
    pintar();

    expect(screen.getByText(/No queda ningún hueco libre/)).toBeInTheDocument();
  });

  it("muestra el error del servidor sin cerrarse", () => {
    pintar({ error: "Ese horario ya está ocupado" });

    expect(screen.getByText("Ese horario ya está ocupado")).toBeInTheDocument();
  });
});
