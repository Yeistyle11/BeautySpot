import { render, screen } from "@testing-library/react";
import { BookingConfirmation } from "../booking-confirmation";

/** Reserva ya creada, tal como la devuelve la ruta pública. */
const reserva = {
  id: "appt-1",
  startTime: "10:00",
  endTime: "10:30",
  totalAmount: 25000,
  services: ["Corte clásico"],
};

/** Pinta la confirmación de una reserva hecha con ese contacto. */
function pintar(contacto: { email?: string | null; phone?: string | null }) {
  render(
    <BookingConfirmation
      confirmation={reserva}
      businessName="QA-Barbería La Noche"
      slug="qa-barberia-la-noche"
      date="2026-08-26"
      isAuthenticated={false}
      contacto={contacto}
    />
  );
}

describe("BookingConfirmation", () => {
  it("anuncia el correo a quien lo dejó, y dice a cuál", () => {
    pintar({ email: "ana@correo.local" });

    expect(
      screen.getByText(/Recibirás un correo de confirmación/)
    ).toHaveTextContent("ana@correo.local");
  });

  it("con solo teléfono promete una llamada, no un correo", () => {
    pintar({ phone: "+573009998877" });

    expect(screen.getByText(/por teléfono/)).toBeInTheDocument();
    expect(screen.queryByText(/correo/)).not.toBeInTheDocument();
  });

  // Prometer un correo a quien no dejó ninguno deja al cliente esperando una
  // confirmación que nadie va a enviar.
  it("no promete nada a quien no dejó ningún dato", () => {
    pintar({});

    expect(screen.getByText(/no dejaste ningún dato/)).toBeInTheDocument();
    expect(screen.queryByText(/Recibirás un correo/)).not.toBeInTheDocument();
  });
});
