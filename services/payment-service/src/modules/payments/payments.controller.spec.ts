import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CitasCobradasDto, PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";

/** El DTO tal y como lo arma el ValidationPipe a partir del query string. */
function desdeLaQuery(appointmentIds: unknown): CitasCobradasDto {
  return plainToInstance(CitasCobradasDto, { appointmentIds });
}

const UNA = "11111111-1111-4111-8111-111111111111";
const OTRA = "22222222-2222-4222-8222-222222222222";

describe("CitasCobradasDto", () => {
  it("parte la lista separada por comas", async () => {
    const dto = desdeLaQuery(`${UNA},${OTRA}`);

    expect(dto.appointmentIds).toEqual([UNA, OTRA]);
    expect(await validate(dto)).toEqual([]);
  });

  it("tolera espacios y elementos vacíos", async () => {
    const dto = desdeLaQuery(` ${UNA} , , ${OTRA} `);

    expect(dto.appointmentIds).toEqual([UNA, OTRA]);
  });

  // Sin tope, un `?appointmentIds=` largo arma un IN (...) de miles de
  // elementos con una sola petición.
  it("acota la lista a cien citas", () => {
    const muchas = Array.from({ length: 150 }, () => UNA).join(",");

    expect(desdeLaQuery(muchas).appointmentIds).toHaveLength(100);
  });

  it("sin parámetro responde una lista vacía", () => {
    expect(desdeLaQuery(undefined).appointmentIds).toEqual([]);
  });

  it("rechaza lo que no sea un UUID", async () => {
    const errores = await validate(desdeLaQuery("no-es-un-uuid"));

    expect(errores).not.toEqual([]);
  });
});

/**
 * Comprueba que el negocio, la sede y el usuario salen del token o de la
 * cabecera del gateway, nunca del cuerpo.
 */
describe("PaymentsController", () => {
  const NEGOCIO = "business-123";
  const SEDE = "branch-1";
  const CAJERO = "user-1";

  let service: jest.Mocked<PaymentsService>;
  let controller: PaymentsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: "pay-1" }),
      findByBusiness: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      citasYaCobradas: jest.fn().mockResolvedValue([UNA]),
      getDailySummary: jest.fn().mockResolvedValue({ total: 0 }),
      findById: jest.fn().mockResolvedValue({ id: "pay-1" }),
      updateStatus: jest.fn().mockResolvedValue({ id: "pay-1" }),
      refundPayment: jest.fn().mockResolvedValue({ id: "pay-1" }),
    } as unknown as jest.Mocked<PaymentsService>;

    controller = new PaymentsController(service);
  });

  it("registra el cobro en el negocio y la sede del token", async () => {
    const dto = {
      clientId: "cli-1",
      amount: 30000,
      method: PaymentMethod.CARD,
    } as never;

    await controller.create(NEGOCIO, SEDE, CAJERO, dto);

    expect(service.create).toHaveBeenCalledWith(NEGOCIO, {
      clientId: "cli-1",
      amount: 30000,
      method: PaymentMethod.CARD,
      branchId: SEDE,
      registeredBy: CAJERO,
    });
  });

  it("lista los cobros con los filtros de la query", async () => {
    await controller.findAll(NEGOCIO, SEDE, {
      method: PaymentMethod.CASH,
      from: "2026-08-01",
      to: "2026-08-31",
      limit: "50",
    });

    expect(service.findByBusiness).toHaveBeenCalledWith(
      NEGOCIO,
      expect.objectContaining({
        method: PaymentMethod.CASH,
        from: "2026-08-01",
        to: "2026-08-31",
        branchId: SEDE,
      }),
      expect.objectContaining({ limit: 50 })
    );
  });

  // El negocio sale del token, nunca de la query: es lo que impide preguntar
  // por las citas de otro.
  it("consulta las citas cobradas del negocio del token", async () => {
    const cobradas = await controller.cobradas(
      NEGOCIO,
      desdeLaQuery(`${UNA},${OTRA}`)
    );

    expect(cobradas).toEqual([UNA]);
    expect(service.citasYaCobradas).toHaveBeenCalledWith(NEGOCIO, [UNA, OTRA]);
  });

  it("pide el resumen del día de la sede en la que se está", async () => {
    await controller.dailySummary(NEGOCIO, SEDE, { date: "2026-08-13" });

    expect(service.getDailySummary).toHaveBeenCalledWith(
      NEGOCIO,
      "2026-08-13",
      SEDE
    );
  });

  it("busca un cobro acotado al negocio", async () => {
    await controller.findById("pay-1", NEGOCIO);

    expect(service.findById).toHaveBeenCalledWith("pay-1", NEGOCIO);
  });

  it("cambia el estado dentro del negocio", async () => {
    await controller.updateStatus("pay-1", NEGOCIO, {
      status: PaymentStatus.CANCELLED,
    } as never);

    expect(service.updateStatus).toHaveBeenCalledWith(
      "pay-1",
      NEGOCIO,
      PaymentStatus.CANCELLED
    );
  });

  // Quién devolvió el dinero se toma del token: una devolución sin autor
  // señalado no se le puede reclamar a nadie.
  it("firma la devolución con el usuario del token", async () => {
    await controller.refund("pay-1", NEGOCIO, CAJERO, {
      reason: "Cliente insatisfecho",
      refundAmount: 10000,
    });

    expect(service.refundPayment).toHaveBeenCalledWith("pay-1", NEGOCIO, {
      reason: "Cliente insatisfecho",
      refundAmount: 10000,
      refundedBy: CAJERO,
    });
  });
});
