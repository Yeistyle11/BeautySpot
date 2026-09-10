import { fireEvent, render, screen } from "@testing-library/react";
import { useAuthStore } from "@/lib/store";
import { InvoiceDetailDialog } from "../invoice-detail-dialog";
import { EmitirDialog } from "../emitir-dialog";
import { paginatedSchema } from "@/lib/pagination";
import {
  cobroFacturableSchema,
  invoiceSchema,
  porcentajeDeImpuesto,
  SIGUIENTES_ESTADOS,
  type Invoice,
} from "../schemas";

/** Factura emitida desde un cobro, tal como la devuelve la API. */
const FACTURA: Invoice = {
  id: "inv-1",
  number: "INV-2026-000001",
  clientId: "client-1",
  paymentId: "pay-1",
  date: "2026-08-30",
  dueDate: "2026-09-29",
  subtotal: 100000,
  taxRate: 0.19,
  tax: 19000,
  total: 119000,
  status: "DRAFT",
  notes: null,
  items: [
    {
      id: "it-1",
      description: "Corte",
      quantity: 1,
      unitPrice: 100000,
      total: 100000,
    },
  ],
};

function pintarDetalle(
  extra: Partial<React.ComponentProps<typeof InvoiceDetailDialog>> = {}
) {
  const props: React.ComponentProps<typeof InvoiceDetailDialog> = {
    invoice: FACTURA,
    onClose: jest.fn(),
    onDescargar: jest.fn(),
    onCambiarEstado: jest.fn(),
    cliente: "María Gómez",
    puedeCambiarEstado: true,
    cambiando: false,
    ...extra,
  };
  render(<InvoiceDetailDialog {...props} />);
  return props;
}

beforeEach(() => {
  useAuthStore.setState({ role: "OWNER" });
});

describe("porcentajeDeImpuesto", () => {
  it("presenta el tipo congelado como porcentaje", () => {
    expect(porcentajeDeImpuesto(0.19)).toBe("19 %");
    expect(porcentajeDeImpuesto(0)).toBe("0 %");
    expect(porcentajeDeImpuesto(0.055)).toBe("5.50 %");
  });
});

describe("InvoiceDetailDialog", () => {
  it("enseña el desglose tal como se emitió", () => {
    pintarDetalle();

    expect(screen.getByText("Impuesto (19 %)")).toBeInTheDocument();
    expect(screen.getByText("$ 119.000")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
  });

  // El cuadro de transiciones es el del servicio: ofrecer un botón que va a
  // responder 400 es peor que no ofrecerlo.
  it("solo ofrece los estados a los que la factura puede pasar", () => {
    pintarDetalle();

    expect(
      screen.getByRole("button", { name: "Marcar enviada" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar pagada" })
    ).not.toBeInTheDocument();
  });

  it("una enviada ya se puede dar por pagada", () => {
    pintarDetalle({ invoice: { ...FACTURA, status: "SENT" } });

    expect(
      screen.getByRole("button", { name: "Marcar pagada" })
    ).toBeInTheDocument();
  });

  it("una pagada no cambia de estado, y lo explica", () => {
    pintarDetalle({ invoice: { ...FACTURA, status: "PAID" } });

    expect(screen.getByText(/ya no cambia de estado/)).toBeInTheDocument();
    expect(SIGUIENTES_ESTADOS.PAID).toEqual([]);
  });

  it("pide el cambio de estado que se pulsa", () => {
    const { onCambiarEstado } = pintarDetalle();

    fireEvent.click(screen.getByRole("button", { name: "Marcar enviada" }));

    expect(onCambiarEstado).toHaveBeenCalledWith(FACTURA, "SENT");
  });

  // Recepción consulta y descarga; emitir y cambiar el estado es de dueño y
  // administrador, como en el backend.
  it("quien no puede cambiar el estado sigue pudiendo descargar", () => {
    pintarDetalle({ puedeCambiarEstado: false });

    expect(
      screen.queryByRole("button", { name: "Marcar enviada" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Descargar PDF/ })
    ).toBeInTheDocument();
  });
});

// `/payment/payments` es una ruta paginada: validarla como un array plano deja
// los datos en undefined y el dialogo lo pinta como «No hay cobros completados
// que facturar», con lo que el fallo se disfraza de estado vacio.
describe("contrato de la lista de cobros facturables", () => {
  const COBRO = {
    id: "pay-1",
    amount: 119000,
    method: "CASH",
    status: "COMPLETED",
    createdAt: "2026-08-30T15:00:00.000Z",
    clientId: "client-1",
  };
  const META = {
    page: 1,
    limit: 50,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  it("acepta el sobre { data, meta } que devuelve la ruta paginada", () => {
    const pagina = paginatedSchema(cobroFacturableSchema).parse({
      data: [COBRO],
      meta: META,
    });

    expect(pagina.data).toHaveLength(1);
    expect(pagina.meta.total).toBe(1);
  });

  it("no acepta un array plano, que es lo que se validaba antes", () => {
    expect(() =>
      paginatedSchema(cobroFacturableSchema).parse([COBRO])
    ).toThrow();
  });
});

describe("EmitirDialog", () => {
  const COBRO = {
    id: "pay-1",
    amount: 119000,
    method: "CASH",
    status: "COMPLETED",
    createdAt: "2026-08-30T15:00:00.000Z",
    clientId: "client-1",
  };

  function pintarEmitir(
    extra: Partial<React.ComponentProps<typeof EmitirDialog>> = {}
  ) {
    const onEmitir = jest.fn();
    render(
      <EmitirDialog
        open
        onClose={jest.fn()}
        onEmitir={onEmitir}
        cobros={[COBRO]}
        clientes={{ "client-1": "María Gómez" }}
        cargando={false}
        emitiendo={null}
        {...extra}
      />
    );
    return onEmitir;
  }

  it("lista los cobros con su cliente y su importe", () => {
    pintarEmitir();

    expect(screen.getByText("María Gómez")).toBeInTheDocument();
    expect(screen.getByText("$ 119.000")).toBeInTheDocument();
  });

  it("factura el cobro que se elige", () => {
    const onEmitir = pintarEmitir();

    fireEvent.click(screen.getByRole("button", { name: "Facturar" }));

    expect(onEmitir).toHaveBeenCalledWith(COBRO);
  });

  it("lo dice cuando no hay nada que facturar", () => {
    pintarEmitir({ cobros: [] });

    expect(screen.getByText(/No hay cobros completados/)).toBeInTheDocument();
  });

  // El 409 de un cobro ya facturado se lee donde se pulsó, no en un aviso que
  // se va solo.
  it("muestra el motivo del rechazo junto a la lista", () => {
    pintarEmitir({ error: "Ese cobro ya tiene una factura" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese cobro ya tiene una factura"
    );
  });
  // Un fallo al pedir los cobros no es «no hay ninguno»: confundirlos deja la
  // facturacion inservible sin que nadie lo note.
  it("distingue un fallo de carga de una lista vacia", () => {
    pintarEmitir({ cobros: [], errorAlCargar: new Error("boom") });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /No se pudieron cargar los cobros/
    );
    expect(
      screen.queryByText(/No hay cobros completados/)
    ).not.toBeInTheDocument();
  });
});

describe("invoiceSchema", () => {
  it("acepta la factura tal como la sirve la API", () => {
    expect(invoiceSchema.safeParse(FACTURA).success).toBe(true);
  });

  it("una factura escrita a mano no trae cobro", () => {
    const aMano = { ...FACTURA, paymentId: null };

    expect(invoiceSchema.parse(aMano).paymentId).toBeNull();
  });
});
