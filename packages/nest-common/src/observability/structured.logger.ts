import { ConsoleLogger, LogLevel } from "@nestjs/common";
import { requestIdActual } from "./request-context";

/** Línea de log en producción: un JSON por evento. */
interface LineaEstructurada {
  nivel: LogLevel;
  hora: string;
  contexto?: string;
  mensaje: string;
  requestId?: string;
  stack?: string;
}

/**
 * Logger que añade el identificador de la petición: JSON por línea en
 * producción, formato de Nest con el identificador como prefijo en desarrollo.
 */
export class StructuredLogger extends ConsoleLogger {
  private readonly enProduccion = process.env.NODE_ENV === "production";

  log(mensaje: unknown, ...resto: unknown[]): void {
    if (this.estructurar("log", mensaje, resto)) return;
    super.log(this.conPrefijo(mensaje), ...(resto as string[]));
  }

  error(mensaje: unknown, ...resto: unknown[]): void {
    if (this.estructurar("error", mensaje, resto)) return;
    super.error(this.conPrefijo(mensaje), ...(resto as string[]));
  }

  warn(mensaje: unknown, ...resto: unknown[]): void {
    if (this.estructurar("warn", mensaje, resto)) return;
    super.warn(this.conPrefijo(mensaje), ...(resto as string[]));
  }

  debug(mensaje: unknown, ...resto: unknown[]): void {
    if (this.estructurar("debug", mensaje, resto)) return;
    super.debug(this.conPrefijo(mensaje), ...(resto as string[]));
  }

  verbose(mensaje: unknown, ...resto: unknown[]): void {
    if (this.estructurar("verbose", mensaje, resto)) return;
    super.verbose(this.conPrefijo(mensaje), ...(resto as string[]));
  }

  /**
   * Emite la línea en JSON si estamos en producción.
   *
   * @returns true si ya se ha emitido y quien llama no debe hacer nada más.
   */
  private estructurar(
    nivel: LogLevel,
    mensaje: unknown,
    resto: unknown[]
  ): boolean {
    if (!this.enProduccion) return false;

    const { contexto, stack } = this.separarArgumentos(resto);
    const linea: LineaEstructurada = {
      nivel,
      hora: new Date().toISOString(),
      contexto: contexto ?? this.context,
      mensaje: this.texto(mensaje),
      requestId: requestIdActual(),
      stack,
    };

    process.stdout.write(`${JSON.stringify(linea)}\n`);
    return true;
  }

  /** Antepone el identificador abreviado para poder seguir una petición a ojo. */
  private conPrefijo(mensaje: unknown): unknown {
    const requestId = requestIdActual();
    if (!requestId || typeof mensaje !== "string") return mensaje;
    return `[${requestId.slice(0, 8)}] ${mensaje}`;
  }

  /** Separa el contexto y la traza de los argumentos sueltos que pasa Nest. */
  private separarArgumentos(resto: unknown[]): {
    contexto?: string;
    stack?: string;
  } {
    const textos = resto.filter((a): a is string => typeof a === "string");
    if (textos.length === 0) return {};
    if (textos.length === 1) return { contexto: textos[0] };
    return { stack: textos[0], contexto: textos[textos.length - 1] };
  }

  private texto(mensaje: unknown): string {
    if (typeof mensaje === "string") return mensaje;
    if (mensaje instanceof Error) return mensaje.message;
    try {
      return JSON.stringify(mensaje);
    } catch {
      return String(mensaje);
    }
  }
}
