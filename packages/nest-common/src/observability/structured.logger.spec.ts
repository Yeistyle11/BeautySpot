import { conContextoPeticion } from "./request-context";
import { StructuredLogger } from "./structured.logger";

/** Captura lo que el logger escribe en stdout en modo producción. */
function capturarSalida(): { lineas: string[]; restaurar: () => void } {
  const lineas: string[] = [];
  const original = process.stdout.write;
  process.stdout.write = ((texto: string) => {
    lineas.push(texto);
    return true;
  }) as typeof process.stdout.write;
  return { lineas, restaurar: () => (process.stdout.write = original) };
}

describe("StructuredLogger", () => {
  const entornoOriginal = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = entornoOriginal;
  });

  describe("en producción", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("emite una línea de JSON por evento", () => {
      const { lineas, restaurar } = capturarSalida();
      new StructuredLogger("Pagos").log("Cobro registrado");
      restaurar();

      expect(lineas).toHaveLength(1);
      expect(JSON.parse(lineas[0])).toMatchObject({
        nivel: "log",
        mensaje: "Cobro registrado",
        contexto: "Pagos",
      });
    });

    // Es el objetivo de todo esto: poder filtrar por requestId en el agregador
    // sin depender de una expresión regular sobre el texto del mensaje.
    it("incluye el identificador de la petición en curso", () => {
      const { lineas, restaurar } = capturarSalida();
      conContextoPeticion({ requestId: "req-123" }, () => {
        new StructuredLogger("Citas").log("Cita creada");
      });
      restaurar();

      expect(JSON.parse(lineas[0]).requestId).toBe("req-123");
    });

    it("separa la traza del contexto en los errores", () => {
      const { lineas, restaurar } = capturarSalida();
      new StructuredLogger().error("Falló el cobro", "Error: boom", "Pagos");
      restaurar();

      expect(JSON.parse(lineas[0])).toMatchObject({
        nivel: "error",
        mensaje: "Falló el cobro",
        stack: "Error: boom",
        contexto: "Pagos",
      });
    });

    it("serializa un mensaje que no es texto", () => {
      const { lineas, restaurar } = capturarSalida();
      new StructuredLogger().log({ cita: "abc" });
      restaurar();

      expect(JSON.parse(lineas[0]).mensaje).toBe('{"cita":"abc"}');
    });

    it("emite una hora en formato ISO", () => {
      const { lineas, restaurar } = capturarSalida();
      new StructuredLogger().warn("Cuidado");
      restaurar();

      const { hora } = JSON.parse(lineas[0]);
      expect(new Date(hora).toISOString()).toBe(hora);
    });
  });

  describe("en desarrollo", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("no emite JSON: delega en el logger legible de Nest", () => {
      const { lineas, restaurar } = capturarSalida();
      const logger = new StructuredLogger();
      const spy = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)), "log")
        .mockImplementation(() => undefined);

      logger.log("Hola");
      restaurar();

      expect(lineas).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
