import { fireEvent, render, screen } from "@testing-library/react";
import { DayView } from "../day-view";
import type { Appointment } from "@/app/dashboard/appointments/schemas";

const DIA = "2026-08-20";

const PROFESIONALES = [
  { id: "prof-1", name: "Ana" },
  { id: "prof-2", name: "Luis" },
];

/** Cita de una hora, con su única línea de servicio. */
const cita = {
  id: "appt-1",
  businessId: "business-1",
  clientId: "client-1",
  professionalId: "prof-1",
  date: DIA,
  startTime: "10:00",
  endTime: "11:00",
  ocupadoHasta: null,
  totalAmount: 50000,
  status: "CONFIRMED",
  appointmentServices: [
    {
      serviceName: "Corte",
      duration: 60,
      orden: 0,
      procesadoDesde: null,
      procesadoMinutos: null,
      bufferDespues: null,
      professionalId: null,
    },
  ],
} as unknown as Appointment;

/** Props mínimos: cada test cambia solo lo que le interesa. */
function pintar(extra: Record<string, unknown> = {}) {
  return render(
    <DayView
      appointments={[cita]}
      professionals={PROFESIONALES}
      date={DIA}
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

describe("DayView", () => {
  it("sin permiso para bloquear, la rejilla no es pulsable", () => {
    pintar();

    expect(
      screen.queryByRole("button", { name: /^Bloquear/ })
    ).not.toBeInTheDocument();
  });

  it("al pulsar un hueco propone bloquear esa media hora de ese profesional", () => {
    const onBloquearHueco = jest.fn();
    pintar({ onBloquearHueco });

    fireEvent.click(
      screen.getByRole("button", { name: "Bloquear 9:00 am de Luis" })
    );

    expect(onBloquearHueco).toHaveBeenCalledWith("prof-2", "09:00");
  });

  it("cada hora se parte en dos huecos de media hora", () => {
    const onBloquearHueco = jest.fn();
    pintar({ onBloquearHueco });

    fireEvent.click(
      screen.getByRole("button", { name: "Bloquear 9:30 am de Ana" })
    );

    expect(onBloquearHueco).toHaveBeenCalledWith("prof-1", "09:30");
  });

  it("pinta los bloqueos del dia con su motivo", () => {
    pintar({
      bloqueos: [
        {
          id: "block-1",
          professionalId: "prof-1",
          startTime: "13:00",
          endTime: "14:00",
          reason: "Almuerzo",
        },
      ],
    });

    expect(screen.getByText("Almuerzo")).toBeInTheDocument();
  });

  it("un bloqueo sin motivo se pinta igualmente", () => {
    pintar({
      bloqueos: [
        {
          id: "block-1",
          professionalId: "prof-1",
          startTime: "13:00",
          endTime: "14:00",
          reason: null,
        },
      ],
    });

    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
  });

  it("la rejilla se estira para que quepa un bloqueo de madrugada", () => {
    pintar({
      bloqueos: [
        {
          id: "block-1",
          professionalId: "prof-1",
          startTime: "01:00",
          endTime: "02:00",
          reason: "Cierre nocturno",
        },
      ],
    });

    // Sin estirarse, la rejilla arrancaría a las 7 y la 1 de la mañana no
    // tendría fila.
    expect(screen.getByText("1:00 am")).toBeInTheDocument();
  });

  // El fin llega en hora de reloj: la cita de las 23:30 termina a las "00:30".
  // Sin devolverla a la escala del reparto, el bloque se pintaría hacia arriba
  // y la rejilla no llegaría hasta él.
  it("pinta la cita que termina pasada la medianoche", () => {
    pintar({
      appointments: [
        {
          ...cita,
          id: "appt-noche",
          startTime: "23:30",
          endTime: "00:30",
        } as unknown as Appointment,
      ],
    });

    // La rejilla llega hasta la fila de la medianoche, que es donde acaba.
    expect(screen.getByText("11:00 pm")).toBeInTheDocument();
    expect(screen.getByText("12:00 am")).toBeInTheDocument();
  });
});
