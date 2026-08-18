import { ETIQUETAS_DE_METODO, nombreDelMetodo } from "@/lib/metodos-de-pago";

describe("nombreDelMetodo", () => {
  // El mismo metodo se llamaba "Tarjeta" en el filtro y "Datafono" en el
  // formulario de la misma seccion, y tocaba deducir que eran lo mismo.
  it("nombra la tarjeta con el término del mostrador", () => {
    expect(nombreDelMetodo("CARD")).toBe("Datáfono");
  });

  it("nombra los demás métodos que acepta el cobro", () => {
    expect(nombreDelMetodo("CASH")).toBe("Efectivo");
    expect(nombreDelMetodo("TRANSFER")).toBe("Transferencia");
    expect(nombreDelMetodo("OTHER")).toBe("Otro");
  });

  // Un método nuevo en el backend no debe dejar la celda en blanco.
  it("devuelve el código tal cual si no lo conoce", () => {
    expect(nombreDelMetodo("CRIPTO")).toBe("CRIPTO");
  });

  it("nombra todos los métodos del catálogo", () => {
    for (const codigo of Object.keys(ETIQUETAS_DE_METODO)) {
      expect(nombreDelMetodo(codigo)).not.toBe(codigo);
    }
  });
});
