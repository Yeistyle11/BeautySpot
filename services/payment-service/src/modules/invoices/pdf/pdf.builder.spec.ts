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
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    heightOfString: jest.fn(() => 12),
    fillColor: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    end: jest.fn(),
    page: { height: 842, margins: { bottom: 50 } },
  };
}

/** Genera la factura con el pdfkit real y devuelve el PDF como texto latin1. */
async function pdfReal(data: InvoiceData): Promise<string> {
  const PDFDocumentReal = jest.requireActual("pdfkit");
  require("pdfkit").default.mockImplementation(
    (opciones: object) => new PDFDocumentReal({ ...opciones, compress: false })
  );
  return (await construirPdfFactura(data)).toString("latin1");
}

/** Número de páginas del PDF. */
function paginas(pdf: string): number {
  return pdf.match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;
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

  it("omite las etiquetas sin dato en vez de dejarlas vacías", async () => {
    await construirPdfFactura(
      facturaDeEjemplo({
        business: { ...facturaDeEjemplo().business, nit: "" },
        client: { name: "Elena Pardo", document: "" },
        paymentMethod: undefined,
      })
    );

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("Elena Pardo");
    expect(escrito.some((t) => t.startsWith("Documento:"))).toBe(false);
    expect(escrito).not.toContain("Método de Pago:");
    expect(escrito).not.toContain("");
  });

  it("escribe el método de pago cuando la factura lo trae", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    const escrito = doc.text.mock.calls.map((c) => String(c[0]));
    expect(escrito).toContain("Método de Pago:");
    expect(escrito).toContain("Efectivo");
  });

  it("no dibuja nada más allá del margen derecho", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    for (const [, x, , opciones] of doc.text.mock.calls) {
      expect(x + (opciones?.width ?? 0)).toBeLessThanOrEqual(545);
    }
    for (const [x] of doc.lineTo.mock.calls) {
      expect(x).toBeLessThanOrEqual(545);
    }
  });

  it("coloca los totales debajo de la última línea de la tabla", async () => {
    await construirPdfFactura(facturaDeEjemplo());

    const yDe = (texto: string) =>
      doc.text.mock.calls.find((c) => c[0] === texto)?.[2] as number;
    expect(yDe("Subtotal:")).toBeGreaterThan(yDe("Barba"));
    expect(yDe("TOTAL:")).toBeGreaterThan(yDe("IVA (19%):"));
  });

  it("pasa a otra página cuando las líneas no caben", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Servicio ${i}`,
      quantity: 1,
      price: 1000,
    }));

    await construirPdfFactura(facturaDeEjemplo({ items }));

    expect(doc.addPage).toHaveBeenCalled();
  });

  describe("con pdfkit real", () => {
    it("cabe en una sola página", async () => {
      const pdf = await pdfReal(facturaDeEjemplo());

      expect(paginas(pdf)).toBe(1);
    });

    it("sigue en una página sin NIT, documento ni método de pago", async () => {
      const pdf = await pdfReal(
        facturaDeEjemplo({
          business: { ...facturaDeEjemplo().business, nit: "" },
          client: { name: "Elena Pardo", document: "" },
          paymentMethod: undefined,
          notes: undefined,
        })
      );

      expect(paginas(pdf)).toBe(1);
    });
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
