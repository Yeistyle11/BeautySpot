import { contieneTexto } from "./busqueda.helper";

describe("contieneTexto", () => {
  it("compara la columna con el mismo criterio que el texto", () => {
    const sql = contieneTexto("Pérez").getSql?.("cliente.name");

    expect(sql).toContain("translate(lower(cliente.name)");
    expect(sql).toContain("LIKE :patron");
  });

  it("busca el texto ya sin tildes y en minúsculas", () => {
    expect(contieneTexto("Pérez").objectLiteralParameters).toEqual({
      patron: "%perez%",
    });
    expect(contieneTexto("PEREZ").objectLiteralParameters).toEqual({
      patron: "%perez%",
    });
  });

  it("escapa los comodines de LIKE que vengan tecleados", () => {
    expect(contieneTexto("100%").objectLiteralParameters).toEqual({
      patron: "%100\\%%",
    });
  });
});
