import PDFDocument from "pdfkit";
import { formatearDinero } from "@beautyspot/shared-utils";

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
  paymentMethod?: string;
  notes?: string;
}

type Documento = InstanceType<typeof PDFDocument>;
type Opciones = PDFKit.Mixins.TextOptions;

const IZQUIERDA = 50;
const DERECHA = 545;
const ANCHO = DERECHA - IZQUIERDA;
const COLUMNA_DERECHA = 330;
const ANCHO_DERECHA = DERECHA - COLUMNA_DERECHA;
const ANCHO_IZQUIERDA = COLUMNA_DERECHA - IZQUIERDA - 20;
const GRIS = "#666";
const NEGRO = "#000";
const NORMAL = "Helvetica";
const NEGRITA = "Helvetica-Bold";

/** Columnas de la tabla de líneas: descripción, cantidad, precio y total. */
const COLUMNAS: { x: number; width: number; align: "left" | "right" }[] = [
  { x: IZQUIERDA, width: 235, align: "left" },
  { x: 290, width: 50, align: "right" },
  { x: 345, width: 95, align: "right" },
  { x: 445, width: 100, align: "right" },
];

/** Espacio que necesitan los totales y el pie bajo la última línea. */
const RESERVA_FINAL = 220;

/** Formatea un día en español de Colombia; llega como medianoche UTC. */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Escribe un texto en (x, y) y devuelve la `y` donde termina. */
function escribir(
  doc: Documento,
  texto: string,
  x: number,
  y: number,
  opciones: Opciones
): number {
  doc.text(texto, x, y, opciones);
  return y + doc.heightOfString(texto, opciones);
}

/** Traza una línea horizontal hasta el margen derecho. */
function linea(doc: Documento, y: number, desde = IZQUIERDA): void {
  doc.strokeColor("#999").lineWidth(0.7);
  doc.moveTo(desde, y).lineTo(DERECHA, y).stroke();
}

/** Deja solo las líneas que tienen dato. */
function conDato(lineas: (string | false | undefined)[]): string[] {
  return lineas.filter((l): l is string => Boolean(l));
}

/** Dibuja el encabezado y devuelve la `y` de la línea que lo cierra. */
function addInvoiceHeader(doc: Documento, data: InvoiceData): number {
  const izquierda: Opciones = { width: ANCHO_IZQUIERDA };
  doc.font(NEGRITA).fontSize(20).fillColor(NEGRO);
  let finIzquierda = escribir(
    doc,
    data.business.name,
    IZQUIERDA,
    50,
    izquierda
  );
  doc.font(NORMAL).fontSize(10).fillColor(GRIS);
  finIzquierda = escribir(
    doc,
    "Factura Electrónica",
    IZQUIERDA,
    finIzquierda + 4,
    izquierda
  );

  const derecha: Opciones = { width: ANCHO_DERECHA, align: "right" };
  doc.font(NEGRITA).fontSize(13).fillColor(NEGRO);
  let finDerecha = escribir(
    doc,
    `Factura #${data.invoiceNumber}`,
    COLUMNA_DERECHA,
    52,
    derecha
  );
  doc.font(NORMAL).fontSize(10);
  finDerecha = escribir(
    doc,
    `Fecha: ${formatDate(data.invoiceDate)}`,
    COLUMNA_DERECHA,
    finDerecha + 6,
    derecha
  );
  finDerecha = escribir(
    doc,
    `Vence: ${formatDate(data.dueDate)}`,
    COLUMNA_DERECHA,
    finDerecha + 2,
    derecha
  );

  const fin = Math.max(finIzquierda, finDerecha) + 12;
  linea(doc, fin);
  return fin;
}

/** Dibuja un título gris seguido de sus líneas y devuelve dónde termina. */
function bloque(
  doc: Documento,
  titulo: string,
  lineas: string[],
  x: number,
  y: number,
  width: number
): number {
  doc.font(NORMAL).fontSize(10).fillColor(GRIS);
  let fin = escribir(doc, titulo, x, y, { width }) + 6;
  doc.fillColor(NEGRO);
  for (const texto of lineas) {
    fin = escribir(doc, texto, x, fin, { width }) + 3;
  }
  return fin;
}

/** Dibuja emisor y cliente en dos columnas y devuelve dónde termina. */
function addParties(doc: Documento, data: InvoiceData, inicio: number): number {
  const { business, client } = data;
  const y = inicio + 20;

  const finEmpresa = bloque(
    doc,
    "Información de la Empresa",
    conDato([
      business.nit && `NIT: ${business.nit}`,
      business.address && `Dirección: ${business.address}`,
      business.phone && `Teléfono: ${business.phone}`,
      business.email && `Email: ${business.email}`,
    ]),
    IZQUIERDA,
    y,
    ANCHO_IZQUIERDA
  );

  const finCliente = bloque(
    doc,
    "Cliente",
    conDato([
      client.name,
      client.document && `Documento: ${client.document}`,
      client.phone && `Teléfono: ${client.phone}`,
      client.email && `Email: ${client.email}`,
      client.address && `Dirección: ${client.address}`,
    ]),
    COLUMNA_DERECHA,
    y,
    ANCHO_DERECHA
  );

  return Math.max(finEmpresa, finCliente) + 20;
}

/** Escribe una fila de la tabla y devuelve dónde termina su celda más alta. */
function fila(doc: Documento, celdas: string[], y: number): number {
  return Math.max(
    ...celdas.map((texto, i) => {
      const { x, width, align } = COLUMNAS[i];
      return escribir(doc, texto, x, y, { width, align });
    })
  );
}

/** Dibuja la tabla de líneas y devuelve la `y` de su línea de cierre. */
function addItemsTable(
  doc: Documento,
  data: InvoiceData,
  inicio: number
): number {
  linea(doc, inicio);
  doc.font(NORMAL).fontSize(10).fillColor(GRIS);
  let y = fila(doc, ["Descripción", "Cantidad", "Precio", "Total"], inicio + 8);
  y += 6;
  linea(doc, y);
  y += 8;

  doc.fillColor(NEGRO);
  for (const item of data.items) {
    if (y > doc.page.height - RESERVA_FINAL) {
      doc.addPage();
      y = 50;
    }
    y =
      fila(
        doc,
        [
          item.name,
          item.quantity.toString(),
          formatearDinero(item.price),
          formatearDinero(item.quantity * item.price),
        ],
        y
      ) + 8;
  }

  linea(doc, y);
  return y;
}

/** Escribe una etiqueta de total con su importe y devuelve dónde termina. */
function importe(
  doc: Documento,
  etiqueta: string,
  cantidad: number,
  y: number
): number {
  doc.text(etiqueta, 300, y, { width: 130, align: "right" });
  return escribir(doc, formatearDinero(cantidad), 435, y, {
    width: 110,
    align: "right",
  });
}

/** Dibuja subtotal, IVA y total bajo la tabla y devuelve dónde terminan. */
function addTotals(doc: Documento, data: InvoiceData, inicio: number): number {
  doc.font(NORMAL).fontSize(10).fillColor(NEGRO);
  let y = importe(doc, "Subtotal:", data.subtotal, inicio + 12) + 4;

  const porcentaje = (data.taxRate * 100).toFixed(0);
  y = importe(doc, `IVA (${porcentaje}%):`, data.tax, y) + 6;

  linea(doc, y, 300);
  doc.font(NEGRITA).fontSize(12);
  y = importe(doc, "TOTAL:", data.total, y + 6);
  doc.font(NORMAL);

  return y + 25;
}

/** Escribe una etiqueta gris con su valor y devuelve dónde termina. */
function detalle(
  doc: Documento,
  etiqueta: string,
  valor: string,
  y: number
): number {
  doc.fontSize(10).fillColor(GRIS);
  doc.text(etiqueta, IZQUIERDA, y, { width: 95 });
  doc.fillColor(NEGRO);
  return escribir(doc, valor, 150, y, { width: DERECHA - 150 }) + 6;
}

/** Dibuja el método de pago y las notas que traiga la factura. */
function addDetalles(doc: Documento, data: InvoiceData, inicio: number): void {
  let y = inicio;
  if (data.paymentMethod) {
    y = detalle(doc, "Método de Pago:", data.paymentMethod, y);
  }
  if (data.notes) {
    detalle(doc, "Notas:", data.notes, y);
  }
}

/** Dibuja el pie con los datos legales del emisor y el mensaje de cortesía. */
function addFooter(doc: Documento, data: InvoiceData): void {
  const alto = doc.page.height;
  const { business } = data;

  // El pie ocupa el margen inferior, que se anula mientras se escribe.
  const margen = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  linea(doc, alto - 100);
  doc.font(NORMAL).fontSize(9).fillColor(GRIS);
  let y = alto - 90;
  for (const texto of conDato([
    business.name,
    business.nit && `NIT: ${business.nit}`,
    business.phone && `Teléfono: ${business.phone}`,
    business.email && `Email: ${business.email}`,
  ])) {
    y = escribir(doc, texto, IZQUIERDA, y, { width: ANCHO });
  }

  doc.text(
    "Gracias por su preferencia. Esta factura ha sido generada electrónicamente.",
    IZQUIERDA,
    alto - 38,
    { width: ANCHO, align: "center" }
  );

  doc.page.margins.bottom = margen;
}

/**
 * Monta el PDF completo de una factura y lo devuelve como Buffer. No depende de
 * Nest ni de configuración: es una función pura sobre los datos recibidos, para
 * poder ejecutarse dentro de un worker.
 */
export function construirPdfFactura(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (error: Error) => reject(error));

    const finEncabezado = addInvoiceHeader(doc, data);
    const finPartes = addParties(doc, data, finEncabezado);
    const finTabla = addItemsTable(doc, data, finPartes);
    addDetalles(doc, data, addTotals(doc, data, finTabla));
    addFooter(doc, data);

    doc.end();
  });
}
