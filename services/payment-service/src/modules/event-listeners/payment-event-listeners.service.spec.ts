import { Test } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PaymentEventListeners } from "./payment-event-listeners.service";
import { PaymentEntity } from "../payments/payment.entity";
import { InvoiceEntity } from "../invoices/invoice.entity";

describe("PaymentEventListeners", () => {
  let service: PaymentEventListeners;
  let mockPaymentRepo: { update: jest.Mock };
  let mockInvoiceRepo: { update: jest.Mock };

  /** El evento de fusión tal como lo publica core. */
  const fusion = {
    eventId: "evt-fusion",
    payload: {
      businessId: "biz-1",
      supervivienteId: "c-buena",
      absorbidoId: "c-duplicada",
    },
  } as never;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    mockPaymentRepo = { update: jest.fn().mockResolvedValue({ affected: 2 }) };
    mockInvoiceRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };

    const module = await Test.createTestingModule({
      providers: [
        PaymentEventListeners,
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(InvoiceEntity),
          useValue: mockInvoiceRepo,
        },
      ],
    }).compile();

    service = module.get(PaymentEventListeners);
  });

  // Sin esto, el dinero que esa persona dejó en el negocio se queda colgando de
  // una ficha que ya no se lista.
  it("los cobros de la ficha absorbida pasan a la que sobrevive", async () => {
    await service.handleClientMerged(fusion);

    expect(mockPaymentRepo.update).toHaveBeenCalledWith(
      { businessId: "biz-1", clientId: "c-duplicada" },
      { clientId: "c-buena" }
    );
  });

  it("y sus facturas también", async () => {
    await service.handleClientMerged(fusion);

    expect(mockInvoiceRepo.update).toHaveBeenCalledWith(
      { businessId: "biz-1", clientId: "c-duplicada" },
      { clientId: "c-buena" }
    );
  });

  it("acota al negocio del evento", async () => {
    await service.handleClientMerged(fusion);

    const [criterio] = mockPaymentRepo.update.mock.calls[0];
    expect(criterio).toHaveProperty("businessId", "biz-1");
  });

  // Una reentrega no debe fallar: ya no encuentra nada que mover.
  it("una reentrega no rompe nada", async () => {
    mockPaymentRepo.update.mockResolvedValue({ affected: 0 });
    mockInvoiceRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.handleClientMerged(fusion)).resolves.toBeUndefined();
  });
});
