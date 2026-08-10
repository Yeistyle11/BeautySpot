import { DataSource } from "typeorm";
import { InternalHttpClient, OutboxService } from "@beautyspot/nest-common";
import { entities } from "../orm-entities";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoicesService } from "../modules/invoices/invoices.service";
import { PdfService } from "../modules/invoices/pdf/pdf.service";

const NEGOCIO_A = "11111111-1111-4111-8111-111111111111";
const NEGOCIO_B = "22222222-2222-4222-8222-222222222222";
const CLIENTE = "33333333-3333-4333-8333-333333333333";

/**
 * Comprueba contra Postgres real que cada negocio lleva su propia serie de
 * facturas y que dos altas simultáneas obtienen números distintos. Requiere la
 * infraestructura levantada (`npm run test:int`).
 */
describe("Integración: numeración de facturas por negocio", () => {
  let dataSource: DataSource;
  let facturas: InvoicesService;

  /** Factura mínima de una línea para el negocio indicado. */
  const emitir = (businessId: string) =>
    facturas.create(businessId, {
      clientId: CLIENTE,
      items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
    });

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();

    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    facturas = new InvoicesService(
      dataSource.getRepository(InvoiceEntity),
      dataSource.getRepository("invoice_items") as never,
      {} as PdfService,
      dataSource,
      outbox as unknown as OutboxService,
      // Aquí solo se emiten facturas; el PDF, que es quien consulta a core, no
      // se genera.
      // Sin serie configurada: numera con la de por defecto.
      {
        pedirONulo: jest.fn().mockResolvedValue(null),
      } as unknown as InternalHttpClient
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE "invoice_items", "invoices", "invoice_sequences" CASCADE'
    );
  });

  it("dos negocios distintos emiten su primera factura sin chocar", async () => {
    const deA = await emitir(NEGOCIO_A);
    const deB = await emitir(NEGOCIO_B);

    // Cada negocio lleva su propia serie: ambos empiezan por el número uno.
    expect(deA.number).toMatch(/^INV-\d{4}-000001$/);
    expect(deB.number).toBe(deA.number);
    expect(deA.businessId).not.toBe(deB.businessId);
  });

  it("la serie de un negocio avanza sin repetirse", async () => {
    const primera = await emitir(NEGOCIO_A);
    const segunda = await emitir(NEGOCIO_A);
    const tercera = await emitir(NEGOCIO_A);

    expect([primera.number, segunda.number, tercera.number]).toEqual([
      primera.number,
      primera.number.replace(/1$/, "2"),
      primera.number.replace(/1$/, "3"),
    ]);
  });

  it("dos altas simultáneas del mismo negocio reciben números distintos", async () => {
    const emitidas = await Promise.all([
      emitir(NEGOCIO_A),
      emitir(NEGOCIO_A),
      emitir(NEGOCIO_A),
      emitir(NEGOCIO_A),
      emitir(NEGOCIO_A),
    ]);

    const numeros = emitidas.map((f) => f.number);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it("no consume número si la factura no llega a guardarse", async () => {
    await emitir(NEGOCIO_A);

    await expect(
      facturas.create(NEGOCIO_A, {
        clientId: "no-es-un-uuid",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      })
    ).rejects.toThrow();

    // La reserva del número va en la misma transacción que la factura, así que
    // el intento fallido no deja un hueco en la serie.
    const siguiente = await emitir(NEGOCIO_A);
    expect(siguiente.number).toMatch(/000002$/);
  });
});
