import { DataSource, Repository } from "typeorm";
import { OutboxMessageEntity, OutboxService } from "@beautyspot/nest-common";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";
import { PaymentsService } from "../modules/payments/payments.service";

/** Código de error de Postgres para violación de restricción única. */
const UNIQUE_VIOLATION = "23505";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";
const CITA = "44444444-4444-4444-8444-444444444444";

/** Lo que booking responde sobre la cita que se está cobrando. */
const CITA_DE_100 = {
  clientId: CLIENTE,
  totalAmount: 100,
  status: "CONFIRMED",
  services: [{ serviceId: "s-1", name: "Corte", price: 100, duration: 30 }],
};

/**
 * Comprueba contra Postgres real que una cita no se cobra dos veces, ni en
 * secuencia ni con dos cajeros a la vez. Requiere la infraestructura levantada
 * (`npm run test:int`).
 */
describe("Integración: una cita se cobra una sola vez", () => {
  let dataSource: DataSource;
  let pagos: PaymentsService;
  let repo: Repository<PaymentEntity>;

  /** Cobro con tarjeta, que no toca la caja y deja ver solo lo del pago. */
  const cobrar = () =>
    pagos.create(NEGOCIO, {
      appointmentId: CITA,
      clientId: CLIENTE,
      amount: 100,
      method: PaymentMethod.CARD,
      registeredBy: USUARIO,
    });

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
    repo = dataSource.getRepository(PaymentEntity);

    pagos = new PaymentsService(
      repo,
      dataSource,
      new OutboxService(),
      { de: jest.fn().mockResolvedValue("America/Bogota") } as never,
      // booking siempre responde la misma cita de 100, y tarda: la consulta es
      // una llamada HTTP entre servicios. Sin esa espera los dos cobros
      // simultáneos se serializan solos en el bucle de eventos y el test daría
      // por buena una carrera que en producción sí ocurre.
      {
        pedir: jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolver) =>
                setTimeout(() => resolver(CITA_DE_100), 20)
              )
          ),
      } as never
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

  it("acepta el primer cobro de la cita", async () => {
    await expect(cobrar()).resolves.toBeDefined();
    await expect(repo.count()).resolves.toBe(1);
  });

  it("rechaza un segundo cobro secuencial de la misma cita", async () => {
    await cobrar();

    await expect(cobrar()).rejects.toThrow(/ya tiene un pago registrado/i);
    await expect(repo.count()).resolves.toBe(1);
  });

  // El mismo patrón que el doble-booking, pero con dinero: dos cajeros
  // cobrando la misma cita a la vez pasan los dos por la comprobación previa
  // antes de que ninguno haya escrito.
  it("con dos cobros simultáneos de la misma cita, solo uno prospera", async () => {
    const resultados = await Promise.allSettled([cobrar(), cobrar()]);

    const aceptados = resultados.filter((r) => r.status === "fulfilled");
    expect(aceptados).toHaveLength(1);
    await expect(repo.count()).resolves.toBe(1);
  });

  // La comprobación del servicio y la escritura son dos pasos, así que quien
  // garantiza esto es el índice, no el orden en que se resuelvan las promesas.
  // Este test escribe saltándose el servicio, que es la única forma de
  // comprobar la garantía y no la suerte.
  it("la base rechaza un segundo cobro vivo de la misma cita", async () => {
    await cobrar();

    await expect(
      repo.save(
        repo.create({
          businessId: NEGOCIO,
          appointmentId: CITA,
          clientId: CLIENTE,
          amount: 100,
          method: PaymentMethod.CARD,
          status: PaymentStatus.COMPLETED,
          registeredBy: USUARIO,
        })
      )
    ).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it("el índice no estorba a los cobros sin cita", async () => {
    const suelto = {
      businessId: NEGOCIO,
      clientId: CLIENTE,
      amount: 50,
      method: PaymentMethod.CASH,
      status: PaymentStatus.COMPLETED,
      registeredBy: USUARIO,
    };

    await repo.save(repo.create(suelto));
    await expect(repo.save(repo.create(suelto))).resolves.toBeDefined();
  });

  it("deja volver a cobrar si el primer pago se anuló", async () => {
    const primero = await cobrar();
    await repo.update({ id: primero.id }, { status: PaymentStatus.CANCELLED });

    await expect(cobrar()).resolves.toBeDefined();
    await expect(repo.count()).resolves.toBe(2);
  });

  it("no estorba al cobro de otra cita del mismo cliente", async () => {
    await cobrar();

    await expect(
      pagos.create(NEGOCIO, {
        appointmentId: "55555555-5555-4555-8555-555555555555",
        clientId: CLIENTE,
        amount: 100,
        method: PaymentMethod.CARD,
        registeredBy: USUARIO,
      })
    ).resolves.toBeDefined();
  });
});
