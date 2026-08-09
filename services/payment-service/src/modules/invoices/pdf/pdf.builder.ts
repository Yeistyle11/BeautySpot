import PDFDocument from "pdfkit";

/** Datos que necesita el PDF de una factura: emisor, cliente, líneas y totales. */
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  business: {
    name: string;
    nit: string;
    address: string;
    phone: string;
    email: string;
    logo?: string;
  };
  client: {
    name: string;
    document: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  /** Tipo aplicado, en tanto por uno: se imprime junto al importe del impuesto. */
  taxRate: number;
  tax: number;
  total: number;
  paymentMethod: string;
  notes?: string;
}

type Documento = InstanceType<typeof PDFDocument>;

/** Formatea un importe como moneda colombiana (COP) sin decimales. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Formatea una fecha en español de Colombia (día, mes y año). */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Dibuja el encabezado: nombre del negocio, número de factura y fechas. */
function addInvoiceHeader(doc: Documento, data: InvoiceData): void {
  const logoPath = data.business.logo;
  if (logoPath) {
    doc.fontSize(20).text(data.business.name, 50, 50, { width: 400 });
    doc.fontSize(10).text("Factura Electrónica", 50, 75);
  } else {
    doc.fontSize(24).text(data.business.name, 50, 50);
    doc.fontSize(10).text("Factura Electrónica", 50, 80);
  }

  doc
    .fontSize(16)
    .text(`Factura #${data.invoiceNumber}`, 400, 50, { align: "right" })
    .fontSize(10)
    .text(`Fecha: ${formatDate(data.invoiceDate)}`, 400, 75, {
      align: "right",
    })
    .text(`Vence: ${formatDate(data.dueDate)}`, 400, 90, {
      align: "right",
    });

  doc.moveTo(50, 110).lineTo(550, 110).stroke();
}

/** Dibuja los datos fiscales y de contacto de la empresa emisora. */
function addInvoiceInfo(doc: Documento, data: InvoiceData): void {
  doc.fontSize(10).fillColor("#666").text("Información de la Empresa", 50, 130);

  // Sin datos fiscales configurados no hay NIT que imprimir; una etiqueta
  // vacía en una factura confunde más que su ausencia.
  doc
    .fillColor("#000")
    .text(data.business.nit ? `NIT: ${data.business.nit}` : "", 50, 150);
  doc.text(`Dirección: ${data.business.address}`, 50, 165);
  doc.text(`Teléfono: ${data.business.phone}`, 50, 180);
  doc.text(`Email: ${data.business.email}`, 50, 195);
}

/** Dibuja los datos del cliente destinatario de la factura. */
function addClientInfo(doc: Documento, data: InvoiceData): void {
  doc.fontSize(10).fillColor("#666").text("Cliente", 350, 130);

  doc.fillColor("#000").text(data.client.name, 350, 150);
  doc.text(`Documento: ${data.client.document}`, 350, 165);

  if (data.client.phone) {
    doc.text(`Teléfono: ${data.client.phone}`, 350, 180);
  }

  if (data.client.email) {
    doc.text(`Email: ${data.client.email}`, 350, 195);
  }

  if (data.client.address) {
    doc.text(`Dirección: ${data.client.address}`, 350, 210);
  }
}

/** Dibuja la tabla de líneas con descripción, cantidad, precio y total. */
function addItemsTable(doc: Documento, data: InvoiceData): void {
  const startY = 250;
  const itemWidth = 280;
  const quantityWidth = 60;
  const priceWidth = 80;
  const totalWidth = 80;

  doc.moveTo(50, startY).lineTo(550, startY).stroke();

  doc.fontSize(10).fillColor("#666");
  doc.text("Descripción", 50, startY + 10, { width: itemWidth });
  doc.text("Cantidad", 350, startY + 10, { width: quantityWidth });
  doc.text("Precio", 410, startY + 10, { width: priceWidth });
  doc.text("Total", 490, startY + 10, { width: totalWidth });

  doc
    .moveTo(50, startY + 25)
    .lineTo(550, startY + 25)
    .stroke();

  let y = startY + 35;
  doc.fillColor("#000");

  for (const item of data.items) {
    const itemTotal = item.quantity * item.price;

    doc.text(item.name, 50, y, { width: itemWidth });
    doc.text(item.quantity.toString(), 350, y, { width: quantityWidth });
    doc.text(formatCurrency(item.price), 410, y, { width: priceWidth });
    doc.text(formatCurrency(itemTotal), 490, y, { width: totalWidth });

    y += 20;
  }

  doc.moveTo(50, y).lineTo(550, y).stroke();
}

/** Dibuja subtotal, IVA y total, más el método de pago y las notas. */
function addTotals(doc: Documento, data: InvoiceData): void {
  let y = 300;

  doc.fontSize(10);

  doc.text("Subtotal:", 400, y, { width: 100, align: "right" });
  doc.text(formatCurrency(data.subtotal), 505, y, {
    width: 100,
    align: "right",
  });
  y += 20;

  const porcentaje = (data.taxRate * 100).toFixed(0);
  doc.text(`IVA (${porcentaje}%):`, 400, y, { width: 100, align: "right" });
  doc.text(formatCurrency(data.tax), 505, y, {
    width: 100,
    align: "right",
  });
  y += 20;

  doc.fontSize(12).fillColor("#000");
  doc.text("TOTAL:", 400, y, { width: 100, align: "right" });
  doc.text(formatCurrency(data.total), 505, y, {
    width: 100,
    align: "right",
  });

  y += 40;

  doc.fontSize(10).fillColor("#666");
  doc.text("Método de Pago:", 50, y);
  doc.fillColor("#000").text(data.paymentMethod, 150, y);

  if (data.notes) {
    y += 20;
    doc.fillColor("#666").text("Notas:", 50, y);
    doc.fillColor("#000").text(data.notes, 150, y);
  }
}

/** Dibuja el pie con los datos legales del emisor y el mensaje de cortesía. */
function addFooter(doc: Documento, data: InvoiceData): void {
  const pageHeight = doc.page.height;

  doc
    .moveTo(50, pageHeight - 80)
    .lineTo(550, pageHeight - 80)
    .stroke();

  // El emisor es el negocio que factura, no la plataforma.
  doc.fontSize(9).fillColor("#666");
  doc.text(data.business.name, 50, pageHeight - 70);
  if (data.business.nit) {
    doc.text(`NIT: ${data.business.nit}`, 50, pageHeight - 60);
  }
  doc.text(`Teléfono: ${data.business.phone}`, 50, pageHeight - 50);
  doc.text(`Email: ${data.business.email}`, 50, pageHeight - 40);

  doc.text(
    "Gracias por su preferencia. Esta factura ha sido generada electrónicamente.",
    50,
    pageHeight - 25,
    { align: "center" }
  );
}

/**
 * Monta el PDF completo de una factura y lo devuelve como Buffer.
 *
 * No depende de Nest ni de ninguna configuración: es una función pura sobre los
 * datos recibidos, para poder ejecutarse dentro de un worker.
 */
export function construirPdfFactura(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error: Error) => reject(error));

    addInvoiceHeader(doc, data);
    addInvoiceInfo(doc, data);
    addClientInfo(doc, data);
    addItemsTable(doc, data);
    addTotals(doc, data);
    addFooter(doc, data);

    doc.end();
  });
}
