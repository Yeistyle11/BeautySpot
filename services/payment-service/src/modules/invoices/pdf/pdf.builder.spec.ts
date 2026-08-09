import { construirPdfFactura, InvoiceData } from "./pdf.builder";

jest.mock("pdfkit", () => {
  const PDFDocumentMock = jest.fn();
  return { __esModule: true, default: PDFDocumentMock };
});

/** Documento simulado que registra cada llamada de dibujo. */
function documentoSimulado() {
  return {
    on: jest.fn((evento: string, callback: (chunk?: Buffer) => void) => {
      if (evento === "data") callback(Buffer.from("pdf-data"));
      if (evento === "end") callback();
    }),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    end: jest.fn(),
    page: { height: 842 },
  };
}

/** Factura completa de ejemplo, con los campos opcionales rellenos. */
function facturaDeEjemplo(cambios: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoiceNumber: "INV-2023-001",
    invoiceDate: new Date("2023-11-15T12:00:00-05:00"),
    dueDate: new Date("2023-12-15T12:00:00-05:00"),
    business: {
      name: "Beauty Bar",
      nit: "900123456-1",
      address: "Calle 123 #45-67",
      phone: "+57 300 123 4567",
      email: "contact@beautybar.co",
    },
    client: {
      name: "Juan Pérez",
      document: "123456789",
      phone: "+57 310 987 6543",
      email: "juan@example.com",
      address: "Av. 456 #78-90",
    },
    items: [
      { name: "Corte de cabello", quantity: 1, price: 30000 },
      { name: "Barba", quantity: 1, price: 15000 },
    ],
    subtotal: 45000,
    taxRate: 0.19,
    tax: 8550,
    total: 53550,
    paymentMethod: "Efectivo",
    notes: "Gracias por su visita",
    ...cambios,
  };
}

describe("construirPdfFactura", () => {
  let doc: ReturnType<typeof documentoSimulado>;

  beforeEach(() => {
    jest.clearAllMocks();
    doc = documentoSimulado();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("pdfkit").default.mockReturnValue(doc);
  });

  it("devuelve el documento como Buffer", async () => {
    const pdf = await construirPdfFactura(facturaDeEjemplo());

    expect(pdf).toBeInstanceOf(Buffer);
    expect(doc.end).toHaveBeenCalled();
  });

  it("escribe el número de factura y el emisor", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("Beauty Bar");
    expect(escrito).toContain("Factura #INV-2023-001");
    expect(escrito).toContain("NIT: 900123456-1");
  });

  it("firma el pie con el negocio que emite, no con la plataforma", async () => {
    await construirPdfFactura(
      facturaDeEjemplo({
        business: {
          name: "Salón Aurora",
          nit: "901555222-3",
          address: "Carrera 7 #12-34",
          phone: "+57 320 000 0000",
          email: "hola@aurora.co",
        },
      })
    );

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("Salón Aurora");
    expect(escrito).toContain("NIT: 901555222-3");
    expect(escrito).toContain("Email: hola@aurora.co");
    expect(escrito).not.toContain("BeautySpot S.A.S.");
  });

  it("omite el NIT cuando el negocio no ha configurado su facturación", async () => {
    await construirPdfFactura(
      facturaDeEjemplo({
        business: { ...facturaDeEjemplo().business, nit: "" },
      })
    );

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito.some((t) => t.startsWith("NIT:"))).toBe(false);
  });

  it("imprime el tipo de impuesto que traiga la factura", async () => {
    await construirPdfFactura(facturaDeEjemplo({ taxRate: 0.05 }));

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("IVA (5%):");
  });

  it("escribe una línea por cada servicio facturado", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("Corte de cabello");
    expect(escrito).toContain("Barba");
  });

  it("formatea los importes como pesos colombianos", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito.some((t) => t.includes("45.000"))).toBe(true);
    expect(escrito.some((t) => t.includes("$"))).toBe(true);
  });

  it("formatea las fechas en español", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito.some((t) => t.includes("noviembre"))).toBe(true);
    expect(escrito.some((t) => t.includes("2023"))).toBe(true);
  });

  it("omite los datos opcionales del cliente que no vienen", async () => {
    await construirPdfFactura(
      facturaDeEjemplo({
        client: { name: "María García", document: "987654321" },
        notes: undefined,
      })
    );

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("María García");
    expect(escrito.some((t) => t.startsWith("Teléfono: +57 310"))).toBe(false);
    expect(escrito).not.toContain("Notas:");
  });

  it("propaga un fallo del renderizado", async () => {
    doc.on = jest.fn((evento: string, callback: (error?: Error) => void) => {
      if (evento === "error") callback(new Error("disco lleno"));
      return doc;
    }) as never;

    await expect(construirPdfFactura(facturaDeEjemplo())).rejects.toThrow(
      "disco lleno"
    );
  });
});
