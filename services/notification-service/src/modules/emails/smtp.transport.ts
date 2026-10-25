import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

/** Correo listo para salir: a quién, con qué asunto y qué cuerpo. */
export interface MensajeSmtp {
  to: string;
  subject: string;
  html: string;
  /** Alternativa en texto plano; si no se da, se deriva del HTML. */
  text?: string;
  /** Adjuntos, desde un fichero (`path`) o ya en memoria (`content`). */
  attachments?: {
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }[];
  /** Nombre con el que firma, sobre la dirección de `EMAIL_FROM` («X vía BeautySpot»). */
  remitente?: string;
}

/** La dirección de `EMAIL_FROM`, venga sola o como «Nombre <dirección>». */
export function direccionDe(remitente: string): string {
  return /<([^>]+)>/.exec(remitente)?.[1] ?? remitente.trim();
}

/**
 * Salida SMTP del servicio: lo único que habla con el servidor de correo. Está
 * aparte de quien compone los mensajes para que cambiar de proveedor o añadir
 * un adjunto no toque los veinticinco correos del producto.
 */
@Injectable()
export class SmtpTransport {
  private readonly transporter: nodemailer.Transporter;
  private readonly remitente?: string;

  constructor(configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get<string>("SMTP_HOST"),
      port: parseInt(configService.get<string>("SMTP_PORT", "587")),
      secure: configService.get<string>("SMTP_SECURE", "false") === "true",
      auth: {
        user: configService.get<string>("SMTP_USER"),
        pass: configService.get<string>("SMTP_PASS"),
      },
    });
    this.remitente = configService.get<string>("EMAIL_FROM");
  }

  /** Entrega el mensaje y devuelve el identificador que dio el servidor. */
  async enviar(mensaje: MensajeSmtp): Promise<{ messageId: string }> {
    const from =
      mensaje.remitente && this.remitente
        ? {
            name: `${mensaje.remitente} vía BeautySpot`,
            address: direccionDe(this.remitente),
          }
        : this.remitente;
    const info = await this.transporter.sendMail({
      from,
      to: mensaje.to,
      subject: mensaje.subject,
      html: mensaje.html,
      text: mensaje.text ?? mensaje.html.replace(/<[^>]*>/g, "").trim(),
      ...(mensaje.attachments ? { attachments: mensaje.attachments } : {}),
    });

    return { messageId: info.messageId };
  }
}
