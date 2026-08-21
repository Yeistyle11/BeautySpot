import { ConfigService } from "@nestjs/config";
import { SmtpTransport } from "./smtp.transport";

jest.mock("nodemailer");

describe("SmtpTransport", () => {
  let transport: SmtpTransport;
  let sendMail: jest.Mock;
  let nodemailer: any;

  const config = {
    get: jest.fn((clave: string, porDefecto?: string) => {
      const valores: Record<string, string> = {
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "false",
        SMTP_USER: "user@example.com",
        SMTP_PASS: "pass",
        EMAIL_FROM: "noreply@beautyspot.co",
      };
      return valores[clave] ?? porDefecto;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({ messageId: "msg-123" });
    nodemailer = require("nodemailer");
    nodemailer.createTransport = jest.fn().mockReturnValue({ sendMail });
    transport = new SmtpTransport(config);
  });

  it("abre la conexión con lo que dice la configuración", () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "user@example.com", pass: "pass" },
    });
  });

  it("entrega el mensaje y devuelve el id del servidor", async () => {
    const resultado = await transport.enviar({
      to: "ana@example.com",
      subject: "Hola",
      html: "<p>Hola Ana</p>",
    });

    expect(resultado).toEqual({ messageId: "msg-123" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@beautyspot.co",
        to: "ana@example.com",
        subject: "Hola",
      })
    );
  });

  it("deriva el texto plano del HTML cuando no se da", async () => {
    await transport.enviar({
      to: "ana@example.com",
      subject: "Hola",
      html: "<p>Hola <b>Ana</b></p>",
    });

    expect(sendMail.mock.calls[0][0].text).toBe("Hola Ana");
  });

  it("no pone la clave de adjuntos si el mensaje no los lleva", async () => {
    await transport.enviar({
      to: "ana@example.com",
      subject: "Hola",
      html: "<p>Hola</p>",
    });

    expect(sendMail.mock.calls[0][0].attachments).toBeUndefined();
  });

  it("adjunta el fichero cuando se le pasa", async () => {
    await transport.enviar({
      to: "ana@example.com",
      subject: "Factura",
      html: "<p>Factura</p>",
      attachments: [{ filename: "f.pdf", path: "/tmp/f.pdf" }],
    });

    expect(sendMail.mock.calls[0][0].attachments).toEqual([
      { filename: "f.pdf", path: "/tmp/f.pdf" },
    ]);
  });
});
