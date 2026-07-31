import { hrefSeguro } from "../url";

describe("hrefSeguro", () => {
  describe("protocolos que no son navegables", () => {
    it.each([
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ])("descarta %j", (entrada) => {
      expect(hrefSeguro(entrada)).toBeUndefined();
    });
  });

  describe("entradas vacias", () => {
    it.each([null, undefined, "", "   "])("descarta %j", (entrada) => {
      expect(hrefSeguro(entrada)).toBeUndefined();
    });
  });

  describe("URLs validas", () => {
    it("conserva https", () => {
      expect(hrefSeguro("https://midominio.com/perfil")).toBe(
        "https://midominio.com/perfil"
      );
    });

    it("conserva http", () => {
      expect(hrefSeguro("http://midominio.com/")).toBe("http://midominio.com/");
    });

    it("asume https cuando el negocio escribe solo el dominio", () => {
      expect(hrefSeguro("instagram.com/minegocio")).toBe(
        "https://instagram.com/minegocio"
      );
    });
  });
});
