import { DataSource, Repository } from "typeorm";
import { OutboxMessageEntity, OutboxService } from "@beautyspot/nest-common";
import { PaymentMethod } from "@beautyspot/shared-types";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";
import { CashRegisterService } from "../modules/cash-register/cash-register.service";
import { PaymentsService } from "../modules/payments/payments.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";

/** Fondo con el que se abre la caja al empezar el día. */
const FONDO = 100000;

/**
 * Recorre el ciclo del arqueo contra Postgres real: abrir la caja, cobrar por
 * cada metodo y cerrarla comprobando el descuadre (`npm run test:int`).
 */
describe("Integración: el arqueo de caja cuadra", () => {
  let dataSource: DataSource;
  let caja: CashRegisterService;
  let pagos: PaymentsService;
  let sesiones: Repository<CashSessionEntity>;
  let movimientos: Repository<CashMovementEntity>;

  /** Cobra sin cita detrás, que es el caso del mostrador. */
  const cobrar = (amount: number, method: PaymentMethod) =>
    pagos.create(NEGOCIO, {
      clientId: CLIENTE,
      amount,
      method,
      registeredBy: USUARIO,
    });

  const abrir = () =>
    caja.openSession(NEGOCIO, USUARIO, { openingAmount: FONDO } as never);

  /** Cierra la caja, con un motivo por defecto para el descuadre. */
  const cerrar = (
    sessionId: string,
    closingAmount: number,
    notes = "Arqueo de la prueba"
  ) =>
    caja.closeSession(sessionId, NEGOCIO, USUARIO, {
      closingAmount,
      notes,
    } as never);

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: [
        PaymentEntity,
        InvoiceEntity,
        InvoiceItemEntity,
        CashSessionEntity,
        CashMovementEntity,
        OutboxMessageEntity,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    sesiones = dataSource.getRepository(CashSessionEntity);
    movimientos = dataSource.getRepository(CashMovementEntity);
    const outbox = new OutboxService();

    caja = new CashRegisterService(
      sesiones,
      movimientos,
      dataSource,
      outbox,
      // El nombre del cliente es un dato de apoyo del listado: sin core, los
      // movimientos salen igual, solo que sin nombre.
      { pedirONulo: jest.fn().mockResolvedValue(null) } as never
    );
    pagos = new PaymentsService(
      dataSource.getRepository(PaymentEntity),
      dataSource,
      outbox,
      { de: jest.fn().mockResolvedValue("America/Bogota") } as never,
      // Sin cita que validar: estos cobros no consultan a booking.
      { pedir: jest.fn() } as never
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "cash_movements", "cash_sessions", "payments", "outbox_messages" CASCADE'
    );
  });

  it("el efectivo cobrado entra en la caja abierta", async () => {
    const sesion = await abrir();

    await cobrar(30000, PaymentMethod.CASH);

    const anotados = await movimientos.find({
      where: { cashSessionId: sesion.id },
    });
    expect(anotados).toHaveLength(1);
    expect(Number(anotados[0].amount)).toBe(30000);
  });

  // La tarjeta se anota igual, porque el cierre Z desglosa por metodo, pero
  // no cuenta como efectivo del cajon.
  it("la tarjeta se anota, pero no cuenta como efectivo", async () => {
    const sesion = await abrir();

    await cobrar(50000, PaymentMethod.CARD);

    const anotados = await movimientos.find({
      where: { cashSessionId: sesion.id },
    });
    expect(anotados).toHaveLength(1);
    expect(anotados[0].method).toBe(PaymentMethod.CARD);

    const cerrada = await cerrar(sesion.id, FONDO);
    expect(Number(cerrada.expectedTotal)).toBe(FONDO);
    expect(Number(cerrada.difference)).toBe(0);
  });

  it("lo esperado es el fondo más el efectivo, y nada más", async () => {
    const sesion = await abrir();
    await cobrar(30000, PaymentMethod.CASH);
    await cobrar(20000, PaymentMethod.CASH);
    // Ni la tarjeta ni la transferencia pasan por el cajón.
    await cobrar(50000, PaymentMethod.CARD);
    await cobrar(70000, PaymentMethod.TRANSFER);

    const cerrada = await cerrar(sesion.id, FONDO + 50000);

    expect(Number(cerrada.expectedTotal)).toBe(FONDO + 50000);
    expect(Number(cerrada.difference)).toBe(0);
  });

  // El descuadre es el dato que importa del arqueo: es lo que dice si falta
  // dinero en el cajón.
  it("registra el descuadre cuando falta dinero", async () => {
    const sesion = await abrir();
    await cobrar(30000, PaymentMethod.CASH);

    const cerrada = await cerrar(sesion.id, FONDO + 25000);

    expect(Number(cerrada.expectedTotal)).toBe(FONDO + 30000);
    expect(Number(cerrada.difference)).toBe(-5000);
  });

  it("registra el sobrante igual que el faltante", async () => {
    const sesion = await abrir();
    await cobrar(30000, PaymentMethod.CASH);

    const cerrada = await cerrar(sesion.id, FONDO + 32000);

    expect(Number(cerrada.difference)).toBe(2000);
  });

  // El arqueo solo controla algo si el descuadre obliga a explicarse en el
  // momento; después, nadie recuerda por qué faltaban cinco mil pesos.
  it("no deja cerrar con descuadre y sin motivo", async () => {
    const sesion = await abrir();
    await cobrar(30000, PaymentMethod.CASH);

    await expect(
      caja.closeSession(sesion.id, NEGOCIO, USUARIO, {
        closingAmount: FONDO + 25000,
      } as never)
    ).rejects.toThrow(/anota el motivo/i);

    // Y la caja sigue abierta, no a medio cerrar.
    const viva = await sesiones.findOne({ where: { id: sesion.id } });
    expect(viva?.closedAt).toBeNull();
  });

  it("el cierre publica el arqueo por el outbox", async () => {
    const sesion = await abrir();
    await cobrar(30000, PaymentMethod.CASH);
    await cobrar(50000, PaymentMethod.CARD);

    await cerrar(sesion.id, FONDO + 30000);

    const [evento] = await dataSource
      .getRepository(OutboxMessageEntity)
      .find({ where: { aggregateId: sesion.id } });

    expect(evento.payload).toMatchObject({
      // Lo esperado en el cajón sale solo del efectivo; el desglose por método
      // va aparte, para el cierre Z.
      expectedTotal: FONDO + 30000,
      difference: 0,
      totalIn: 80000,
      movementCount: 2,
    });
  });

  it("no deja cerrar dos veces la misma caja", async () => {
    const sesion = await abrir();
    await cerrar(sesion.id, FONDO);

    await expect(cerrar(sesion.id, FONDO)).rejects.toThrow(/ya está cerrada/i);
  });

  // Cobrar en efectivo sin caja abierta dejaría el dinero fuera del arqueo, y
  // el cierre no cuadraría nunca.
  it("rechaza el efectivo si no hay caja abierta", async () => {
    await expect(cobrar(30000, PaymentMethod.CASH)).rejects.toThrow(
      /caja abierta/i
    );
  });

  it("deja cobrar con tarjeta sin caja abierta", async () => {
    await expect(cobrar(50000, PaymentMethod.CARD)).resolves.toBeDefined();
  });
});
