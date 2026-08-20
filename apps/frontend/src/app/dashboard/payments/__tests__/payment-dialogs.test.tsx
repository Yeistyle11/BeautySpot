import { fireEvent, render, screen } from "@testing-library/react";
import { CreatePaymentDialog } from "../payment-dialogs";
import { emptyCreateForm } from "../schemas";
import type { CitaCobrable, Client, CreateForm } from "../schemas";

const CLIENTES = [
  { id: "cli-1", name: "Carlos Pérez", loyaltyPoints: 0 },
] as Client[];

const CITAS = [
  {
    id: "cita-1",
    date: "2026-08-17",
    startTime: "10:00",
    totalAmount: 30000,
    appointmentServices: [{ serviceName: "Corte clásico" }],
  },
] as CitaCobrable[];

/** Monta el diálogo con el cliente ya elegido, que es cuando ofrece citas. */
function pintar(citas: CitaCobrable[], onChange = jest.fn()) {
  const form: CreateForm = { ...emptyCreateForm, clientId: "cli-1" };
  render(
    <CreatePaymentDialog
      open
      onClose={jest.fn()}
      form={form}
      onChange={onChange}
      onSubmit={jest.fn()}
      clients={CLIENTES}
      citasPorCobrar={citas}
      saving={false}
    />
  );
  return onChange;
}

describe("CreatePaymentDialog", () => {
  it("ofrece las citas atendidas del cliente con su servicio e importe", () => {
    pintar(CITAS);

    expect(screen.getByLabelText("Cita")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Corte clásico/ })
    ).toBeInTheDocument();
  });

  // El importe tecleado a mano pierde el precio del catálogo y deja el cobro
  // sin decir qué se vendió; elegir la cita lo trae de ella.
  it("al elegir la cita, el importe sale de ella", () => {
    const onChange = pintar(CITAS);

    fireEvent.change(screen.getByLabelText("Cita"), {
      target: { value: "cita-1" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: "cita-1", amount: "30000" })
    );
  });

  // Una venta de producto en el mostrador no tiene cita detrás, y el importe
  // se sigue escribiendo a mano.
  it("deja cobrar sin cita", () => {
    pintar(CITAS);

    expect(
      screen.getByRole("option", { name: "Venta suelta, sin cita" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Monto (COP)")).not.toHaveAttribute(
      "readonly"
    );
  });

  it("no ofrece el campo si el cliente no tiene citas por cobrar", () => {
    pintar([]);

    expect(screen.queryByLabelText("Cita")).not.toBeInTheDocument();
  });
});
