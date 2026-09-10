import {
  cambiosDeTarifas,
  filasDeTarifas,
  type FilaDeTarifa,
  type ServicioDelCatalogo,
} from "../schemas";

const CORTE = "svc-corte";
const TINTE = "svc-tinte";

const CATALOGO: ServicioDelCatalogo[] = [
  { id: CORTE, name: "Corte", price: 30000, duration: 30, active: true },
  { id: TINTE, name: "Tinte", price: 120000, duration: 90, active: true },
];

/** Fila tal como sale del catálogo cuando el profesional no presta el servicio. */
const sinPrestar = (serviceId: string): FilaDeTarifa => ({
  serviceId,
  presta: false,
  precio: "",
  duracion: "",
});

describe("filasDeTarifas", () => {
  it("marca lo que el profesional ya tiene asignado", () => {
    const filas = filasDeTarifas(CATALOGO, [{ serviceId: CORTE }]);

    expect(filas).toEqual([
      { serviceId: CORTE, presta: true, precio: "", duracion: "" },
      sinPrestar(TINTE),
    ]);
  });

  it("trae la tarifa propia como texto, que es lo que edita el formulario", () => {
    const filas = filasDeTarifas(CATALOGO, [
      { serviceId: CORTE, customPrice: 45000, customDuration: 45 },
    ]);

    expect(filas[0]).toMatchObject({ precio: "45000", duracion: "45" });
  });

  // Prestar el servicio y cobrarlo como el catálogo son cosas distintas: sin
  // tarifa propia las columnas vienen a null, y eso no es «no lo presta».
  it("distingue prestarlo sin tarifa propia de no prestarlo", () => {
    const filas = filasDeTarifas(CATALOGO, [
      { serviceId: CORTE, customPrice: null, customDuration: null },
    ]);

    expect(filas[0]).toMatchObject({ presta: true, precio: "", duracion: "" });
    expect(filas[1].presta).toBe(false);
  });

  it("sin nada asignado, ninguna fila queda marcada", () => {
    expect(filasDeTarifas(CATALOGO, []).every((f) => !f.presta)).toBe(true);
  });
});

describe("cambiosDeTarifas", () => {
  const cargado = filasDeTarifas(CATALOGO, [
    { serviceId: CORTE, customPrice: 45000, customDuration: null },
  ]);

  it("no manda nada cuando no se tocó nada", () => {
    expect(cambiosDeTarifas(cargado, [...cargado])).toEqual({
      asignar: [],
      quitar: [],
    });
  });

  it("asigna el servicio que se acaba de marcar", () => {
    const actual = cargado.map((f) =>
      f.serviceId === TINTE ? { ...f, presta: true } : f
    );

    expect(cambiosDeTarifas(cargado, actual)).toEqual({
      asignar: [
        { serviceId: TINTE, customPrice: undefined, customDuration: undefined },
      ],
      quitar: [],
    });
  });

  it("quita el que se desmarcó", () => {
    const actual = cargado.map((f) =>
      f.serviceId === CORTE ? sinPrestar(CORTE) : f
    );

    expect(cambiosDeTarifas(cargado, actual)).toEqual({
      asignar: [],
      quitar: [CORTE],
    });
  });

  // Reasignar con otra tarifa es lo habitual: subir el precio del senior.
  it("reasigna el servicio cuya tarifa cambió", () => {
    const actual = cargado.map((f) =>
      f.serviceId === CORTE ? { ...f, precio: "50000" } : f
    );

    expect(cambiosDeTarifas(cargado, actual).asignar).toEqual([
      { serviceId: CORTE, customPrice: 50000, customDuration: undefined },
    ]);
  });

  // Vaciar el campo es cómo se dice «cóbralo como el catálogo».
  it("vaciar la tarifa la manda sin valor, no la deja como estaba", () => {
    const actual = cargado.map((f) =>
      f.serviceId === CORTE ? { ...f, precio: "" } : f
    );

    expect(cambiosDeTarifas(cargado, actual).asignar).toEqual([
      { serviceId: CORTE, customPrice: undefined, customDuration: undefined },
    ]);
  });

  it("no cuenta como cambio un espacio de más", () => {
    const actual = cargado.map((f) =>
      f.serviceId === CORTE ? { ...f, precio: " 45000 " } : f
    );

    expect(cambiosDeTarifas(cargado, actual).asignar).toEqual([]);
  });

  it("descarta un importe que no es un número", () => {
    const actual = cargado.map((f) =>
      f.serviceId === CORTE ? { ...f, precio: "carísimo" } : f
    );

    expect(cambiosDeTarifas(cargado, actual).asignar).toEqual([
      { serviceId: CORTE, customPrice: undefined, customDuration: undefined },
    ]);
  });

  it("desmarcar lo que nunca estuvo no manda nada", () => {
    const actual = cargado.map((f) =>
      f.serviceId === TINTE ? sinPrestar(TINTE) : f
    );

    expect(cambiosDeTarifas(cargado, actual)).toEqual({
      asignar: [],
      quitar: [],
    });
  });
});
