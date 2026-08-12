import { PaymentMethod } from "@beautyspot/shared-types";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { CobrosListeners } from "./cobros.listeners";
import { crearEntornoDeListeners } from "./listeners.fixtures";

describe("CobrosListeners", () => {
  let listeners: CobrosListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockDataEnricher: jest.Mocked<DataEnricherService>;
  let mockNotifications: { create: jest.Mock };

  const mockInvoiceGeneratedEvent = {
    eventType: "payment.invoice.generated",
    eventId: "evt-127",
    correlationId: "corr-127",
    timestamp: new Date(),
    payload: {
      invoiceId: "invoice-123",
      number: 1001,
      clientId: "client-123",
      businessId: "business-123",
      subtotal: 67227,
      tax: 12773,
      total: 80000,
      dueDate: "2026-09-10",
      items: [{ description: "Corte", quantity: 1, total: 67227 }],
      currency: "COP",
    },
  };

  const mockPaymentRegisteredEvent = {
    eventType: "payment.payment.registered",
    eventId: "evt-128",
    correlationId: "corr-128",
    timestamp: new Date(),
    payload: {
      paymentId: "payment-123",
      invoiceId: "invoice-123",
      amount: 80000,
      method: PaymentMethod.TRANSFER,
      clientId: "client-123",
      businessId: "business-123",
    },
  };

  beforeEach(async () => {
    const entorno = await crearEntornoDeListeners();
    listeners = entorno.modulo.get(CobrosListeners);
    mockEmailService = entorno.emails;
    mockDataEnricher = entorno.enricher;
    mockNotifications = entorno.notificaciones;
  });

  describe("handleInvoiceGenerated", () => {
    it("usa el vencimiento y las líneas que emitió payment", async () => {
      await listeners.handleInvoiceGenerated(mockInvoiceGeneratedEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          dueDate: "2026-09-10",
          services: [{ name: "Corte", price: 67227 }],
        })
      );
    });

    it("no inventa un vencimiento si el evento no lo trae", async () => {
      const { dueDate: _sinVencimiento, ...payload } =
        mockInvoiceGeneratedEvent.payload;

      await listeners.handleInvoiceGenerated({
        ...mockInvoiceGeneratedEvent,
        payload,
      } as never);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ dueDate: "" })
      );
    });

    it("debería enriquecer datos del cliente y negocio", async () => {
      await listeners.handleInvoiceGenerated(mockInvoiceGeneratedEvent);

      expect(mockDataEnricher.enrichClientEmail).toHaveBeenCalledWith(
        "client-123"
      );
      expect(mockDataEnricher.enrichBusinessData).toHaveBeenCalledWith(
        "business-123"
      );
      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          invoiceNumber: "1001",
          amount: 80000,
          businessName: "EliteBarbers",
        })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichClientEmail.mockRejectedValue(new Error("Error"));

      await expect(
        listeners.handleInvoiceGenerated(mockInvoiceGeneratedEvent)
      ).rejects.toThrow();
    });
  });

  describe("handlePaymentRegistered", () => {
    /** El mismo pago, cobrado por el método indicado. */
    const pagadoCon = (method: PaymentMethod) => ({
      ...mockPaymentRegisteredEvent,
      payload: { ...mockPaymentRegisteredEvent.payload, method },
    });

    it("debería enviar recibo para pagos por transferencia", async () => {
      await listeners.handlePaymentRegistered(mockPaymentRegisteredEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          invoiceNumber: "REC-payment-123",
          amount: 80000,
          // El nombre sale del cliente resuelto, no de un literal.
          clientName: "Juan Cliente",
        })
      );
    });

    it("detalla en el recibo lo que se cobró", async () => {
      await listeners.handlePaymentRegistered({
        ...mockPaymentRegisteredEvent,
        payload: {
          ...mockPaymentRegisteredEvent.payload,
          services: [
            { serviceId: "s-1", name: "Corte", price: 30000, duration: 30 },
            { serviceId: "s-2", name: "Barba", price: 50000, duration: 20 },
          ],
        },
      });

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          services: [
            { name: "Corte", price: 30000 },
            { name: "Barba", price: 50000 },
          ],
        })
      );
    });

    // Un cobro suelto no tiene cita detrás: lo único cierto es el importe.
    it("se queda en el importe cuando el cobro no lleva cita", async () => {
      await listeners.handlePaymentRegistered(mockPaymentRegisteredEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          services: [{ name: "Servicio", price: 80000 }],
        })
      );
    });

    // Un caso por cada valor del enum, para que la condición no pueda quedar
    // colgada de un literal que el enum no produce.
    it.each([
      [PaymentMethod.CASH, true],
      [PaymentMethod.TRANSFER, true],
      [PaymentMethod.CARD, false],
      [PaymentMethod.OTHER, false],
    ])("con %s el recibo por correo sale: %s", async (method, esperado) => {
      await listeners.handlePaymentRegistered(pagadoCon(method));

      expect(mockEmailService.queueInvoice).toHaveBeenCalledTimes(
        esperado ? 1 : 0
      );
    });

    it("avisa del cobro dentro de la aplicación sea cual sea el método", async () => {
      await listeners.handlePaymentRegistered(pagadoCon(PaymentMethod.CARD));

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "PAYMENT_REGISTERED",
        })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichClientEmail.mockRejectedValue(new Error("Error"));

      await expect(
        listeners.handlePaymentRegistered(mockPaymentRegisteredEvent)
      ).rejects.toThrow();
    });
  });
});
