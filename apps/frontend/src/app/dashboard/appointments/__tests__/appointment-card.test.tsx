import { fireEvent, render, screen } from "@testing-library/react";
import { AppointmentCard } from "../appointment-card";
import type { Appointment } from "../schemas";

const CITA = {
  id: "appt-1",
  date: "2026-08-20",
  startTime: "10:00",
  endTime: "10:30",
  status: "CONFIRMED",
  notes: null,
  totalAmount: 30000,
  businessId: "biz-1",
  professionalId: "prof-1",
  clientId: "cli-1",
  appointmentServices: [{ serviceName: "Barba", price: 30000, duration: 30 }],
} as unknown as Appointment;

/** La tarjeta con todos los permisos, salvo lo que se indique. */
function pintar(cita: Partial<Appointment>, props = {}) {
  return render(
    <AppointmentCard
      appointment={{ ...CITA, ...cita } as Appointment}
      professionalName="Ana Restrepo"
      clientName="Maria Gomez"
      canConfirm
      canCancel
      canReschedule
      onConfirm={jest.fn()}
      onComplete={jest.fn()}
      onCancel={jest.fn()}
      onNoShow={jest.fn()}
      onReschedule={jest.fn()}
      {...props}
    />
  );
}

describe("AppointmentCard", () => {
  describe("cita cancelada", () => {
    it("dice por qué se canceló y qué se anotó", () => {
      pintar({
        status: "CANCELLED",
        cancelReasonType: "PROFESIONAL_NO_DISPONIBLE",
        cancelReason: "Ana pidió el día por cita médica",
      });

      expect(screen.getByText(/El profesional no está/)).toBeInTheDocument();
      expect(screen.getByText(/cita médica/)).toBeInTheDocument();
    });

    it("nombra el motivo aunque no haya nota", () => {
      pintar({ status: "CANCELLED", cancelReasonType: "DUPLICADA" });

      expect(screen.getByText(/Cita duplicada/)).toBeInTheDocument();
    });

    it("no deja hueco cuando la cita sigue viva", () => {
      pintar({ cancelReasonType: "DUPLICADA" });

      expect(screen.queryByText(/Cita duplicada/)).not.toBeInTheDocument();
    });
  });

  describe("reagendar", () => {
    it("ofrece mover la cita a quien puede", () => {
      const onReschedule = jest.fn();
      pintar({}, { onReschedule });

      fireEvent.click(screen.getByRole("button", { name: /Reagendar/ }));

      expect(onReschedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: "appt-1" })
      );
    });

    it("no la ofrece a quien no puede", () => {
      pintar({}, { canReschedule: false });

      expect(
        screen.queryByRole("button", { name: /Reagendar/ })
      ).not.toBeInTheDocument();
    });

    it("no la ofrece sobre una cita ya cerrada", () => {
      pintar({ status: "COMPLETED" });

      expect(
        screen.queryByRole("button", { name: /Reagendar/ })
      ).not.toBeInTheDocument();
    });
  });
});
