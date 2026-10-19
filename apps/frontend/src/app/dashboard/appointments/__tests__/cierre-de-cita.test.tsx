import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { api } from "@/lib/api";
import { descargarPdf } from "@/lib/descargar";
import { motivoParaNoCobrar } from "@/lib/caja-abierta";
import {
  cobroDeLaCita,
  CompleteAppointmentDialog,
  type PaymentDraft,
} from "../complete-appointment-dialog";
import { useCierreDeCita } from "../use-cierre-de-cita";
import type { Appointment } from "../schemas";

jest.mock("@/lib/api", () => ({ api: { post: jest.fn() } }));
jest.mock("@/lib/caja-abierta", () => ({
  motivoParaNoCobrar: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/lib/descargar", () => ({
  descargarPdf: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/swr", () => ({
  revalidatePrefix: jest.fn().mockResolvedValue(undefined),
}));

const toast = { exito: jest.fn(), error: jest.fn() };
jest.mock("@/components/ui/toast", () => ({ useToast: () => toast }));

const post = api.post as jest.Mock;

const CITA = {
  id: "cita-1",
  clientId: "cli-1",
  totalAmount: 42000,
  date: "2026-10-19",
  startTime: "10:00",
  endTime: "10:30",
  appointmentServices: [{ serviceName: "Corte", duration: 30, price: 42000 }],
} as unknown as Appointment;

/** Responde cada POST según su ruta. */
function responder(factura: "ok" | "falla" = "ok") {
  post.mockImplementation(async (ruta: string) => {
    if (ruta.endsWith("/complete")) return {};
    if (ruta === "/payment/payments") return { id: "pago-1" };
    if (ruta === "/payment/invoices") {
      if (factura === "falla") throw new Error("core no responde");
      return { id: "fac-1", number: "INV-2026-000042" };
    }
    throw new Error(`ruta inesperada ${ruta}`);
  });
}

/** Abre el cierre de la cita, ajusta su cobro y lo confirma con cobro. */
async function cerrarConCobro(
  puedeFacturar: boolean,
  cambios: Partial<PaymentDraft> = {}
) {
  const { result } = renderHook(() => useCierreDeCita(puedeFacturar));
  act(() => result.current.abrir(CITA));
  act(() => result.current.setCobro({ ...result.current.cobro, ...cambios }));
  await act(() => result.current.confirmar(true));
  return result;
}

const rutas = () => post.mock.calls.map(([ruta]) => ruta);

/** Cuerpo con el que se registró el cobro. */
const cuerpoDelCobro = () =>
  post.mock.calls.find(([ruta]) => ruta === "/payment/payments")?.[1];

describe("useCierreDeCita", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: () => "intento-1",
      configurable: true,
    });
  });
  beforeEach(() => jest.clearAllMocks());

  it("completa, cobra y factura el cobro recién registrado", async () => {
    responder();

    const result = await cerrarConCobro(true);

    expect(rutas()).toEqual([
      "/booking/appointments/cita-1/complete",
      "/payment/payments",
      "/payment/invoices",
    ]);
    expect(post).toHaveBeenLastCalledWith("/payment/invoices", {
      paymentId: "pago-1",
    });
    expect(toast.exito).toHaveBeenCalledWith(
      "Cita completada, cobrada y facturada (INV-2026-000042)",
      expect.objectContaining({ etiqueta: "Descargar" })
    );
    expect(result.current.cita).toBeNull();
  });

  it("el botón del aviso descarga el PDF de esa factura", async () => {
    responder();
    await cerrarConCobro(true);

    const [, accion] = toast.exito.mock.calls[0];
    accion.alPulsar();

    expect(descargarPdf).toHaveBeenCalledWith(
      "/payment/invoices/fac-1/pdf",
      "factura-INV-2026-000042.pdf"
    );
  });

  it("con la casilla desmarcada no factura", async () => {
    responder();

    await cerrarConCobro(true, { facturar: false });

    expect(rutas()).not.toContain("/payment/invoices");
    expect(toast.exito).toHaveBeenCalledWith("Cita completada y cobrada");
  });

  it("sin permiso para facturar no lo intenta", async () => {
    responder();

    await cerrarConCobro(false);

    expect(rutas()).not.toContain("/payment/invoices");
  });

  it("si la factura falla avisa de que lo demás sí quedó hecho", async () => {
    responder("falla");

    const result = await cerrarConCobro(true);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Cita completada y cobrada, pero la factura")
    );
    expect(toast.exito).not.toHaveBeenCalled();
    expect(result.current.cita).toBeNull();
  });

  it("el cobro sale de la cita y viaja con su identificador de intento", async () => {
    responder();

    await cerrarConCobro(true);

    expect(cuerpoDelCobro()).toMatchObject({
      appointmentId: "cita-1",
      clientId: "cli-1",
      amount: 42000,
      method: "CASH",
      solicitudId: "intento-1",
    });
  });

  it("lleva la propina y el reparto entre varios medios", async () => {
    responder();

    await cerrarConCobro(true, {
      propina: "5000",
      metodos: [
        { method: "CASH", amount: "20000" },
        { method: "CARD", amount: "27000" },
      ],
    });

    expect(cuerpoDelCobro()).toMatchObject({
      amount: 42000,
      propina: 5000,
      metodos: [
        { method: "CASH", amount: 20000 },
        { method: "CARD", amount: 27000 },
      ],
    });
  });

  it("con descuento cobra el total de la cita menos la rebaja", async () => {
    responder();

    await cerrarConCobro(true, {
      descuentoComercial: "2000",
      motivoDescuento: "Cliente frecuente",
    });

    expect(cuerpoDelCobro()).toMatchObject({
      amount: 40000,
      descuentoComercial: 2000,
      motivoDescuento: "Cliente frecuente",
    });
  });

  it("comprueba la caja si parte del reparto va en efectivo", async () => {
    responder();
    (motivoParaNoCobrar as jest.Mock).mockResolvedValueOnce(
      "No hay una caja abierta"
    );

    await cerrarConCobro(true, {
      method: "CARD",
      metodos: [
        { method: "CARD", amount: "30000" },
        { method: "CASH", amount: "12000" },
      ],
    });

    expect(toast.error).toHaveBeenCalledWith("No hay una caja abierta");
    expect(post).not.toHaveBeenCalled();
  });

  it("sin efectivo no pregunta por la caja", async () => {
    responder();

    await cerrarConCobro(true, { method: "CARD" });

    expect(motivoParaNoCobrar).not.toHaveBeenCalled();
  });

  it("sin cobro solo completa la cita", async () => {
    responder();
    const { result } = renderHook(() => useCierreDeCita(true));
    act(() => result.current.abrir(CITA));

    await act(() => result.current.confirmar(false));

    expect(rutas()).toEqual(["/booking/appointments/cita-1/complete"]);
  });
});

describe("CompleteAppointmentDialog", () => {
  const props = {
    open: true,
    onClose: jest.fn(),
    appointment: CITA,
    payment: cobroDeLaCita(CITA),
    onPaymentChange: jest.fn(),
    onComplete: jest.fn(),
    pending: false,
  };

  it("con permiso ofrece facturar, marcado de entrada", () => {
    render(<CompleteAppointmentDialog {...props} puedeFacturar />);

    expect(
      screen.getByRole("switch", { name: "Emitir factura del cobro" })
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: /Completar, cobrar y facturar/ })
    ).toBeInTheDocument();
  });

  it("desmarcar la casilla cambia el borrador del cobro", () => {
    const onPaymentChange = jest.fn();
    render(
      <CompleteAppointmentDialog
        {...props}
        onPaymentChange={onPaymentChange}
        puedeFacturar
      />
    );

    fireEvent.click(screen.getByRole("switch"));

    expect(onPaymentChange).toHaveBeenCalledWith(
      expect.objectContaining({ facturar: false })
    );
  });

  it("ofrece propina y pagar con varios métodos, como un cobro suelto", () => {
    render(<CompleteAppointmentDialog {...props} />);

    expect(screen.getByLabelText(/Propina/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pagar con varios métodos" })
    ).toBeInTheDocument();
  });

  it("no deja completar con cobro mientras el reparto no cuadre", () => {
    render(
      <CompleteAppointmentDialog
        {...props}
        payment={{
          ...cobroDeLaCita(CITA),
          metodos: [{ method: "CASH", amount: "10000" }],
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /Completar y registrar pago/ })
    ).toBeDisabled();
    expect(screen.getByText(/Falta repartir/)).toBeInTheDocument();
  });

  it("ofrece canjear puntos si el cliente tiene saldo", () => {
    render(<CompleteAppointmentDialog {...props} puntosDisponibles={300} />);

    expect(
      screen.getByLabelText(/Canjear puntos \(tiene 300\)/)
    ).toBeInTheDocument();
  });

  it("sin permiso no aparece la casilla", () => {
    render(<CompleteAppointmentDialog {...props} />);

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Completar y registrar pago/ })
    ).toBeInTheDocument();
  });
});
