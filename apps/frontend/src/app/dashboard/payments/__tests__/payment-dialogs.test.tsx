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
function pintar(
  citas: CitaCobrable[],
  onChange = jest.fn(),
  extra: Partial<CreateForm> = {},
  puedeDescontar = true
) {
  const form: CreateForm = {
    ...emptyCreateForm,
    clientId: "cli-1",
    ...extra,
  };
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
      puedeDescontar={puedeDescontar}
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

describe("descuento, propina y reparto", () => {
  // El servidor responde 403 a un descuento de recepcion: la pantalla no se lo
  // ofrece siquiera.
  it("no ofrece el descuento a quien no puede concederlo", () => {
    pintar([], jest.fn(), {}, false);

    expect(screen.queryByLabelText(/Descuento/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Propina/)).toBeInTheDocument();
  });

  it("pide el motivo en cuanto hay descuento", () => {
    pintar([], jest.fn(), { descuentoComercial: "5000" });

    expect(screen.getByLabelText(/Motivo del descuento/)).toBeInTheDocument();
  });

  it("dice cuánto falta por repartir y no deja enviar hasta que cuadre", () => {
    pintar([], jest.fn(), {
      amount: "100000",
      metodos: [{ method: "CASH", amount: "40000" }],
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Falta repartir/);
    expect(
      screen.getByRole("button", { name: /Registrar pago/ })
    ).toBeDisabled();
  });

  it("deja enviar cuando el reparto suma el cobro y la propina", () => {
    pintar([], jest.fn(), {
      amount: "100000",
      propina: "10000",
      metodos: [
        { method: "CASH", amount: "40000" },
        { method: "CARD", amount: "70000" },
      ],
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Repartido/);
    expect(
      screen.getByRole("button", { name: /Registrar pago/ })
    ).toBeEnabled();
  });

  it("abrir el reparto siembra la primera parte con el total", () => {
    const onChange = pintar([], jest.fn(), { amount: "50000" });

    fireEvent.click(
      screen.getByRole("button", { name: "Pagar con varios métodos" })
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        metodos: [{ method: "CASH", amount: "50000" }],
      })
    );
  });
});
