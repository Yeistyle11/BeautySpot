import {
  cashSessionSchema,
  cashMovementSchema,
  cashSummarySchema,
  ACTIVE_KEY,
  HISTORY_KEY,
} from "../schemas";

/**
 * La sesión activa tal y como la devuelve /payment/cash-register/active. Una
 * caja abierta trae `closedAt` y `closingAmount` en null.
 */
const cajaAbiertaDeLaApi = {
  id: "ef352854-f990-495d-b4e3-da4ff00ccf3e",
  createdAt: "2026-07-28T06:54:26.330Z",
  updatedAt: "2026-07-28T06:54:26.330Z",
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  branchId: null,
  openedBy: "93532a9f-3727-474b-b3b1-979927a191bc",
  closedBy: null,
  openingAmount: 100000,
  closingAmount: null,
  openedAt: "2026-07-28T01:54:26.329Z",
  closedAt: null,
  notes: "Apertura de certificacion",
  movements: [],
};

const cajaCerradaDeLaApi = {
  ...cajaAbiertaDeLaApi,
  closedBy: "93532a9f-3727-474b-b3b1-979927a191bc",
  closingAmount: 135000,
  closedAt: "2026-07-26T23:10:00.000Z",
  notes: null,
};

describe("cashSessionSchema", () => {
  it("acepta una caja abierta, con closedAt en null", () => {
    const result = cashSessionSchema.safeParse(cajaAbiertaDeLaApi);

    expect(result.success).toBe(true);
  });

  it("acepta una caja cerrada, con importe y fecha de cierre", () => {
    const sesion = cashSessionSchema.parse(cajaCerradaDeLaApi);

    expect(sesion.closingAmount).toBe(135000);
    expect(sesion.closedAt).toBe("2026-07-26T23:10:00.000Z");
  });

  it("acepta una apertura sin observaciones", () => {
    const result = cashSessionSchema.safeParse({
      ...cajaAbiertaDeLaApi,
      notes: null,
    });

    expect(result.success).toBe(true);
  });

  it("conserva el importe de apertura como número", () => {
    const sesion = cashSessionSchema.parse(cajaAbiertaDeLaApi);

    expect(sesion.openingAmount).toBe(100000);
  });

  // El histórico enseña el descuadre de cada cierre, así que tiene que llegar
  // hasta la pantalla: sin él habría que restar sesión a sesión para verlo.
  it("conserva el descuadre del cierre", () => {
    const sesion = cashSessionSchema.parse({
      ...cajaCerradaDeLaApi,
      expectedTotal: 110000,
      difference: 25000,
    });

    expect(sesion.difference).toBe(25000);
    expect(sesion.expectedTotal).toBe(110000);
  });

  // Las sesiones cerradas antes de que se guardara el descuadre no lo traen, y
  // la pantalla tiene que seguir pintándolas.
  it("acepta un cierre sin descuadre informado", () => {
    const sesion = cashSessionSchema.parse(cajaCerradaDeLaApi);

    expect(sesion.difference).toBeUndefined();
  });
});

describe("cashMovementSchema", () => {
  it("acepta los movimientos que devuelve el resumen", () => {
    const resumen = {
      movements: [
        {
          id: "6c1f5c9a-1f3f-4a1e-9a2b-0b7c1d2e3f40",
          type: "IN",
          amount: 35000,
          concept: "Pago en efectivo",
          createdAt: "2026-07-28T02:10:00.000Z",
        },
      ],
    };

    const result = cashSummarySchema.safeParse(resumen);

    expect(result.success).toBe(true);
  });

  it("rechaza un tipo de movimiento fuera de IN/OUT", () => {
    const result = cashMovementSchema.safeParse({
      id: "6c1f5c9a-1f3f-4a1e-9a2b-0b7c1d2e3f40",
      type: "TRANSFER",
      amount: 35000,
      concept: "Pago",
      createdAt: "2026-07-28T02:10:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});

describe("constantes de la pantalla", () => {
  it("apunta a las rutas del gateway", () => {
    expect(ACTIVE_KEY).toBe("/payment/cash-register/active");
    expect(HISTORY_KEY).toBe("/payment/cash-register/history");
  });
});
