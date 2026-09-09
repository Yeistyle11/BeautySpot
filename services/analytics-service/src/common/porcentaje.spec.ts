import { porcentaje } from "./porcentaje";

describe("porcentaje", () => {
  it("conserva un decimal", () => {
    expect(porcentaje(1, 15)).toBe(6.7);
    expect(porcentaje(1, 14)).toBe(7.1);
  });

  // Con redondeo a entero las dos daban 7 y la tasa no se movia al crecer el
  // denominador, que es como se detecto el defecto.
  it("distingue tasas que el entero aplastaba", () => {
    expect(porcentaje(1, 15)).not.toBe(porcentaje(1, 14));
  });

  it("no inventa decimales cuando la division es exacta", () => {
    expect(porcentaje(1, 2)).toBe(50);
    expect(porcentaje(3, 3)).toBe(100);
  });

  it("un total de cero no es una tasa", () => {
    expect(porcentaje(0, 0)).toBe(0);
    expect(porcentaje(5, -1)).toBe(0);
  });

  it("no pierde una tasa pequena en el redondeo", () => {
    expect(porcentaje(1, 1000)).toBe(0.1);
  });
});
