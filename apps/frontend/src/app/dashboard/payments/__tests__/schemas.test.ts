import {
  paymentSchema,
  clientSchema,
  dailySummarySchema,
  METHOD_LABELS,
  METHOD_FILTERS,
  STATUS_LABELS,
  emptyCreateForm,
  emptyEditForm,
  PAYMENTS_KEY,
  CLIENTS_KEY,
  cobroListo,
  cobroParaEnviar,
  importeACobrar,
  mediosDelCobro,
  totalDelCobro,
} from "../schemas";

/** Un pago tal y como lo devuelve `GET /payment/payments`. */
const pagoDeLaApi = {
  id: "2dd37d5f-145f-4ac2-8c52-34cadc3af326",
  createdAt: "2026-07-28T05:25:55.581Z",
  updatedAt: "2026-07-28T05:25:55.581Z",
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  appointmentId: null,
  clientId: "afe1accd-8dae-49aa-979a-53c9074aa983",
  amount: 15000,
  method: "CASH",
  status: "COMPLETED",
  reference: null,
  notes: "Prueba navegador",
  registeredBy: "93532a9f-3727-474b-b3b1-979927a191bc",
  refundedAt: null,
  refundAmount: null,
  refundReason: null,
  refundedBy: null,
};

describe("paymentSchema", () => {
  it("acepta el pago que devuelve la API, con nulos incluidos", () => {
    const result = paymentSchema.safeParse(pagoDeLaApi);

    expect(result.success).toBe(true);
  });

  it("conserva el importe como número, sin convertirlo a texto", () => {
    const result = paymentSchema.parse(pagoDeLaApi);

    expect(result.amount).toBe(15000);
  });

  it("no exige campos que la API no envía", () => {
    const result = paymentSchema.safeParse(pagoDeLaApi);

    expect(result.success).toBe(true);
    expect(pagoDeLaApi).not.toHaveProperty("registeredAt");
  });

  it("rechaza un importe que llegue como texto", () => {
    const result = paymentSchema.safeParse({ ...pagoDeLaApi, amount: "15000" });

    expect(result.success).toBe(false);
  });
});

describe("clientSchema", () => {
  it("acepta el cliente que devuelve /core/clients", () => {
    const result = clientSchema.safeParse({
      id: "afe1accd-8dae-49aa-979a-53c9074aa983",
      name: "Cliente de prueba",
    });

    expect(result.success).toBe(true);
  });
});

describe("dailySummarySchema", () => {
  it("acepta el resumen del día agregado por método", () => {
    const result = dailySummarySchema.safeParse({
      date: "2026-07-27",
      total: 69900,
      count: 4,
      byMethod: { CASH: 29900, CARD: 40000 },
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un total que llegue como texto", () => {
    const result = dailySummarySchema.safeParse({
      date: "2026-07-27",
      total: "69900",
      count: 4,
      byMethod: {},
    });

    expect(result.success).toBe(false);
  });
});

describe("estados de pago", () => {
  it("traduce todos los estados que puede devolver la API", () => {
    for (const estado of ["PENDING", "COMPLETED", "REFUNDED", "CANCELLED"]) {
      expect(STATUS_LABELS[estado]).toBeTruthy();
      expect(STATUS_LABELS[estado]).not.toBe(estado);
    }
  });
});

describe("constantes de la pantalla", () => {
  it("etiqueta en español cada método filtrable", () => {
    for (const method of METHOD_FILTERS.filter((m) => m !== "all")) {
      expect(METHOD_LABELS[method]).toBeTruthy();
    }
  });

  it("arranca los formularios vacíos con efectivo por defecto", () => {
    expect(emptyCreateForm.method).toBe("CASH");
    expect(emptyCreateForm.amount).toBe("");
    expect(emptyEditForm.amount).toBe("");
  });

  it("apunta a las rutas del gateway", () => {
    expect(PAYMENTS_KEY).toBe("/payment/payments");
    expect(CLIENTS_KEY).toBe("/core/clients?limit=100");
  });

  it("pide los clientes de a lotes grandes, porque alimentan un desplegable", () => {
    expect(CLIENTS_KEY).toContain("limit=");
    const limite = Number(
      new URLSearchParams(CLIENTS_KEY.split("?")[1]).get("limit")
    );
    expect(limite).toBeGreaterThanOrEqual(100);
  });
});

describe("importe del cobro", () => {
  const deUnaCita = {
    ...emptyCreateForm,
    clientId: "cli-1",
    appointmentId: "cita-1",
    amount: "42000",
  };

  it("en una cita resta del total el descuento y los puntos", () => {
    const form = {
      ...deUnaCita,
      descuentoComercial: "2000",
      puntosUsados: "500",
    };

    expect(importeACobrar(form)).toBe(39500);
    expect(cobroParaEnviar(form).amount).toBe(39500);
  });

  it("en una venta suelta el monto es lo que se paga", () => {
    const form = {
      ...emptyCreateForm,
      amount: "30000",
      descuentoComercial: "2000",
    };

    expect(importeACobrar(form)).toBe(30000);
  });

  it("la propina va encima de lo que se paga por los servicios", () => {
    const form = { ...deUnaCita, descuentoComercial: "2000", propina: "5000" };

    expect(totalDelCobro(form)).toBe(45000);
  });

  it("los medios son los del reparto, o el único elegido", () => {
    expect(mediosDelCobro(deUnaCita)).toEqual(["CASH"]);
    expect(
      mediosDelCobro({
        ...deUnaCita,
        metodos: [
          { method: "CARD", amount: "30000" },
          { method: "TRANSFER", amount: "12000" },
        ],
      })
    ).toEqual(["CARD", "TRANSFER"]);
  });

  it("no está listo con un reparto que no cuadra ni con descuento sin motivo", () => {
    expect(cobroListo(deUnaCita)).toBe(true);
    expect(
      cobroListo({ ...deUnaCita, metodos: [{ method: "CASH", amount: "1" }] })
    ).toBe(false);
    expect(cobroListo({ ...deUnaCita, descuentoComercial: "1000" })).toBe(
      false
    );
    expect(
      cobroListo({
        ...deUnaCita,
        descuentoComercial: "1000",
        motivoDescuento: "Cumpleaños",
      })
    ).toBe(true);
  });
});
