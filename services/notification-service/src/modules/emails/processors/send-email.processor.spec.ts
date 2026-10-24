import { Job } from "bullmq";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { EmailService } from "../email.service";
import { EmailJobData, SendEmailProcessor } from "./send-email.processor";

describe("SendEmailProcessor", () => {
  const emails = {
    sendEmail: jest.fn().mockResolvedValue({ messageId: "msg-1" }),
  } as unknown as jest.Mocked<EmailService>;
  const amqp = { publish: jest.fn() } as unknown as AmqpConnection;
  const processor = new SendEmailProcessor(emails, amqp);
  jest.spyOn(processor["logger"], "log").mockImplementation(() => undefined);

  const ADJUNTO = { invoiceId: "f-1", businessId: "b-1", nombre: "F.pdf" };

  /** Un trabajo de la cola en el intento indicado (0 es el primero). */
  function trabajo(intentosHechos: number): Job<EmailJobData> {
    return {
      id: "job-1",
      attemptsMade: intentosHechos,
      opts: { attempts: 3 },
      data: {
        to: "p@example.com",
        subject: "Tu factura",
        template: "invoice-generated",
        context: { subject: "Tu factura" },
        adjunto: ADJUNTO,
      },
    } as unknown as Job<EmailJobData>;
  }

  beforeEach(() => jest.clearAllMocks());

  it("en los primeros intentos exige el PDF de la factura", async () => {
    await processor.process(trabajo(0));

    expect(emails.sendEmail).toHaveBeenCalledWith(
      "p@example.com",
      "invoice-generated",
      { subject: "Tu factura" },
      ADJUNTO,
      false
    );
  });

  it("en el último intento deja salir la factura sin él", async () => {
    await processor.process(trabajo(2));

    expect(emails.sendEmail).toHaveBeenCalledWith(
      "p@example.com",
      "invoice-generated",
      { subject: "Tu factura" },
      ADJUNTO,
      true
    );
  });
});
