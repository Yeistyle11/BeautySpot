import { fireEvent, render, screen } from "@testing-library/react";
import { CalendarView } from "../calendar-view";
import type { Appointment } from "@/app/dashboard/appointments/schemas";

// Martes 25 de agosto de 2026; su semana va del lunes 24 al domingo 30.
const MARTES = "2026-08-25";

const cita = {
  id: "appt-1",
  businessId: "business-1",
  clientId: "client-1",
  professionalId: "prof-1",
  date: MARTES,
  startTime: "10:00",
  endTime: "11:00",
  ocupadoHasta: null,
  totalAmount: 50000,
  status: "CONFIRMED",
  appointmentServices: [{ serviceName: "Corte", duration: 60 }],
} as unknown as Appointment;

/** Bloqueo de la tarde del martes, como los devuelve el rango de la semana. */
const bloqueo = {
  id: "block-1",
  professionalId: "prof-1",
  date: MARTES,
  startTime: "14:00",
  endTime: "16:00",
  reason: "QA-bloqueo de prueba",
};

function pintar(extra: Record<string, unknown> = {}) {
  return render(
    <CalendarView
      appointments={[cita]}
      date={MARTES}
      onDateChange={jest.fn()}
      onComplete={jest.fn()}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      onNoShow={jest.fn()}
      canConfirm
      canCancel
      clientNames={{ "client-1": "María" }}
      {...extra}
    />
  );
}

describe("CalendarView", () => {
  it("pinta la semana que contiene el día abierto, no la de hoy", () => {
    pintar();

    expect(
      screen.getByText((texto) => texto.startsWith("24 de ago"))
    ).toHaveTextContent("30 de ago de 2026");
  });

  it("navegar de semana mueve el día que la página tiene abierto", () => {
    const onDateChange = jest.fn();
    pintar({ onDateChange });

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(onDateChange).toHaveBeenCalledWith("2026-09-01");

    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));
    expect(onDateChange).toHaveBeenCalledWith("2026-08-18");
  });

  // La franja de quien está de vacaciones se veía libre justo en la pantalla
  // con la que se responde al teléfono.
  it("muestra los bloqueos, como ya hacía la vista día", () => {
    pintar({
      bloqueos: [bloqueo],
      nombresDeProfesional: { "prof-1": "Ana" },
    });

    // De 14:00 a 16:00: aparece en las dos franjas horarias.
    const pintados = screen.getAllByText("QA-bloqueo de prueba");
    expect(pintados).toHaveLength(2);
    expect(pintados[0]).toHaveAttribute(
      "title",
      expect.stringContaining("Ana")
    );
  });

  it("un bloqueo sin motivo se pinta igualmente", () => {
    pintar({ bloqueos: [{ ...bloqueo, reason: null, endTime: "15:00" }] });

    expect(screen.getAllByText("Bloqueado")).toHaveLength(1);
  });

  it("marca los días en los que el negocio no abre", () => {
    // Solo de lunes a viernes: el sábado y el domingo salen cerrados.
    pintar({ diasAbiertos: [1, 2, 3, 4, 5] });

    expect(screen.getAllByText("Cerrado")).toHaveLength(2);
  });

  it("sin horario cargado no afirma que ningún día esté cerrado", () => {
    pintar();

    expect(screen.queryByText("Cerrado")).not.toBeInTheDocument();
  });

  it("sigue abriendo el detalle de la cita que se pulsa", () => {
    pintar();

    fireEvent.click(screen.getByText("María"));

    expect(screen.getByText("Corte")).toBeInTheDocument();
  });
});
