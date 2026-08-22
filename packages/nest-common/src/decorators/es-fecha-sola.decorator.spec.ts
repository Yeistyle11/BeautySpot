import { validate } from "class-validator";
import { EsFechaSola, EsDiaDelCalendario } from "./es-fecha-sola.decorator";

class ConsultaDeReporte {
  @EsFechaSola() from!: string;
}

/** Valida una instancia con el valor dado y devuelve los mensajes de error. */
async function errores(valor: unknown): Promise<string[]> {
  const dto = new ConsultaDeReporte();
  (dto as { from: unknown }).from = valor;
  const fallos = await validate(dto);
  return fallos.flatMap((f) => Object.values(f.constraints ?? {}));
}

describe("EsFechaSola", () => {
  it("acepta un día del calendario", async () => {
    expect(await errores("2026-02-28")).toEqual([]);
  });

  it("rechaza un día que no existe", async () => {
    const mensajes = await errores("2026-02-30");

    expect(mensajes.join(" ")).toContain("no existe en el calendario");
  });

  it("rechaza una marca de tiempo, que no es un día", async () => {
    const mensajes = await errores("2026-02-28T10:00:00Z");

    expect(mensajes.join(" ")).toContain("YYYY-MM-DD");
  });

  it("rechaza lo que ni siquiera tiene forma de fecha", async () => {
    expect(await errores("ayer")).not.toEqual([]);
    expect(await errores(20260228)).not.toEqual([]);
  });
});

describe("EsDiaDelCalendario", () => {
  const constraint = new EsDiaDelCalendario();

  it("no juzga lo que no tiene forma de fecha; de eso responde el formato", () => {
    expect(constraint.validate("ayer")).toBe(true);
    expect(constraint.validate(42)).toBe(true);
  });

  it("nombra la propiedad y el valor en el mensaje", () => {
    const mensaje = constraint.defaultMessage({
      property: "from",
      value: "2026-02-30",
    } as never);

    expect(mensaje).toContain("from");
    expect(mensaje).toContain("2026-02-30");
  });
});
