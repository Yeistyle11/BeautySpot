import { fireEvent, render, screen } from "@testing-library/react";
import { RefundDialog } from "../payment-dialogs";
import { PaymentCard } from "../payment-card";
import {
  devolucionCompleta,
  devolucionParaEnviar,
  emptyDevolucionForm,
  estadoDeDevolucion,
  DIAS_PARA_DEVOLVER,
  type Payment,
} from "../schemas";

/** Cobro en efectivo de hoy, vivo y devolvible. */
const COBRO: Payment = {
  id: "pay-1",
  amount: 50000,
  method: "CASH",
  status: "COMPLETED",
  createdAt: "2026-08-30T15:00:00.000Z",
  appointmentId: null,
  clientId: "client-1",
  reference: null,
  notes: null,
  refundedAt: null,
  refundAmount: null,
  refundReason: null,
};

const HOY = new Date("2026-08-30T18:00:00.000Z");

describe("estadoDeDevolucion", () => {
  it("un cobro completado y reciente se puede devolver", () => {
    expect(estadoDeDevolucion(COBRO, HOY)).toEqual({ puede: true });
  });

  it("uno ya devuelto, no", () => {
    const devuelto = { ...COBRO, status: "REFUNDED" };

    expect(estadoDeDevolucion(devuelto, HOY)).toMatchObject({
      puede: false,
      motivo: expect.stringContaining("ya se devolvió"),
    });
  });

  // El servicio tiene una ventana de 30 días: la pantalla lo dice antes de que
  // alguien pulse un botón que iba a responder 400.
  it("fuera de plazo, tampoco, y explica por qué", () => {
    const viejo = { ...COBRO, createdAt: "2026-06-01T15:00:00.000Z" };

    expect(estadoDeDevolucion(viejo, HOY)).toMatchObject({
      puede: false,
      motivo: expect.stringContaining(String(DIAS_PARA_DEVOLVER)),
    });
  });

  it("el último día del plazo todavía admite la devolución", () => {
    const justo = { ...COBRO, createdAt: "2026-08-01T15:00:00.000Z" };

    expect(estadoDeDevolucion(justo, HOY).puede).toBe(true);
  });
});

describe("devolucionParaEnviar", () => {
  // El total va sin importe: lo pone el servicio, y así no se devuelve un peso
  // de menos por el redondeo del formulario.
  it("la devolución total no manda importe", () => {
    const cuerpo = devolucionParaEnviar({
      ...emptyDevolucionForm,
      motivo: "El tinte salió mal",
    });

    expect(cuerpo).toEqual({
      reason: "El tinte salió mal",
      refundAmount: undefined,
    });
  });

  it("la parcial manda lo que se escribió", () => {
    const cuerpo = devolucionParaEnviar({
      alcance: "parcial",
      importe: "20000",
      motivo: "Se le cobró de más",
    });

    expect(cuerpo.refundAmount).toBe(20000);
  });

  it("recorta el motivo", () => {
    const cuerpo = devolucionParaEnviar({
      ...emptyDevolucionForm,
      motivo: "  cortesía  ",
    });

    expect(cuerpo.reason).toBe("cortesía");
  });
});

describe("devolucionCompleta", () => {
  it("sin motivo no se envía", () => {
    expect(devolucionCompleta(emptyDevolucionForm, 50000)).toBe(false);
  });

  it("con motivo, la total está lista", () => {
    expect(
      devolucionCompleta({ ...emptyDevolucionForm, motivo: "error" }, 50000)
    ).toBe(true);
  });

  it("la parcial no admite más de lo cobrado", () => {
    const form = { alcance: "parcial", importe: "60000", motivo: "error" };

    expect(devolucionCompleta(form, 50000)).toBe(false);
    expect(devolucionCompleta({ ...form, importe: "50000" }, 50000)).toBe(true);
  });

  it("la parcial no admite cero ni texto", () => {
    const form = { alcance: "parcial", importe: "0", motivo: "error" };

    expect(devolucionCompleta(form, 50000)).toBe(false);
    expect(devolucionCompleta({ ...form, importe: "todo" }, 50000)).toBe(false);
  });
});

describe("RefundDialog", () => {
  function pintar(
    extra: Partial<React.ComponentProps<typeof RefundDialog>> = {}
  ) {
    const onChange = jest.fn();
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <RefundDialog
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        payment={COBRO}
        form={{ ...emptyDevolucionForm, motivo: "El tinte salió mal" }}
        onChange={onChange}
        saving={false}
        {...extra}
      />
    );
    return { onChange, onSubmit };
  }

  it("recuerda cuánto y cómo se cobró", () => {
    pintar();

    expect(
      screen.getByText(/Se cobraron/).textContent?.replace(/\s+/g, " ")
    ).toMatch(/\$ 50.000 en efectivo/);
  });

  it("el importe solo se pide en la devolución parcial", () => {
    pintar();

    expect(
      screen.queryByLabelText(/Importe a devolver/)
    ).not.toBeInTheDocument();
  });

  it("con «Una parte» elegida aparece el importe", () => {
    pintar({
      form: { alcance: "parcial", importe: "", motivo: "error" },
    });

    expect(screen.getByLabelText(/Importe a devolver/)).toBeInTheDocument();
  });

  // El efectivo sale del cajón, y sin caja abierta el servicio lo rechaza.
  it("avisa de que el efectivo sale de la caja", () => {
    pintar();

    expect(screen.getByText(/se descuenta de la caja abierta/)).toBeVisible();
  });

  it("con tarjeta no habla de la caja", () => {
    pintar({ payment: { ...COBRO, method: "CARD" } });

    expect(
      screen.queryByText(/se descuenta de la caja abierta/)
    ).not.toBeInTheDocument();
  });

  it("sin motivo no deja devolver", () => {
    pintar({ form: emptyDevolucionForm });

    expect(screen.getByRole("button", { name: "Devolver" })).toBeDisabled();
  });

  it("enseña el motivo por el que el servicio la rechazó", () => {
    pintar({ error: "No hay una caja abierta" });

    expect(screen.getByRole("alert")).toHaveTextContent("No hay una caja");
  });
});

describe("PaymentCard", () => {
  function pintarTarjeta(payment: Payment, canRefund = true) {
    const onRefund = jest.fn();
    render(
      <PaymentCard
        payment={payment}
        canEdit
        onEdit={jest.fn()}
        canRefund={canRefund}
        onRefund={onRefund}
        clientName="María Gómez"
      />
    );
    return onRefund;
  }

  it("ofrece devolver un cobro vivo", () => {
    const onRefund = pintarTarjeta(COBRO);

    fireEvent.click(
      screen.getByRole("button", { name: /Devolver el pago de/ })
    );

    expect(onRefund).toHaveBeenCalledWith(COBRO);
  });

  it("no lo ofrece a quien no puede devolver", () => {
    pintarTarjeta(COBRO, false);

    expect(
      screen.queryByRole("button", { name: /Devolver el pago de/ })
    ).not.toBeInTheDocument();
  });

  it("no lo ofrece sobre un cobro ya devuelto", () => {
    pintarTarjeta({
      ...COBRO,
      status: "REFUNDED",
      refundAmount: 50000,
      refundReason: "El tinte salió mal",
    });

    expect(
      screen.queryByRole("button", { name: /Devolver el pago de/ })
    ).not.toBeInTheDocument();
  });

  // Una parcial deja el cobro vivo por el resto: sin decir cuánto volvió, la
  // cifra de arriba engaña.
  it("dice cuánto se devolvió y por qué", () => {
    pintarTarjeta({
      ...COBRO,
      refundAmount: 20000,
      refundReason: "Se le cobró de más",
    });

    expect(
      screen.getByText(/Devuelto \$ 20.000 · Se le cobró de más/)
    ).toBeInTheDocument();
  });
});
