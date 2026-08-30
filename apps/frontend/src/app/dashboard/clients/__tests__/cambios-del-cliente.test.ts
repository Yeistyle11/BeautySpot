import { cambiosDelCliente } from "../schemas";
import type { ClientForm } from "../client-form-dialog";

/**
 * Dos personas sobre la misma ficha: el formulario enviaba todos los campos,
 * asi que guardar el nombre desde una pestana vieja devolvia el telefono al
 * valor que esa pestana tenia cargado y el cambio de la otra se perdia sin
 * aviso. Enviar solo lo modificado acota el choque al mismo campo.
 */

const CARGADO: ClientForm = {
  name: "QA-Test Ana",
  email: "qa.ana@correo.local",
  phone: "3009998877",
  notes: "",
  birthDate: "1990-05-02",
};

describe("cambiosDelCliente", () => {
  it("manda solo el campo tocado", () => {
    const editado = { ...CARGADO, name: "QA-Test Ana (pestaña A)" };

    expect(cambiosDelCliente(CARGADO, editado)).toEqual({
      name: "QA-Test Ana (pestaña A)",
    });
  });

  it("no reenvía el teléfono que esta pestaña no tocó", () => {
    // Es el escenario del informe: B guardó un teléfono nuevo y A, que sigue
    // mostrando el viejo, guarda el nombre. El teléfono no debe viajar.
    const editado = { ...CARGADO, name: "Otro nombre" };

    expect(cambiosDelCliente(CARGADO, editado)).not.toHaveProperty("phone");
  });

  it("no manda nada cuando no se cambió nada", () => {
    expect(cambiosDelCliente(CARGADO, { ...CARGADO })).toEqual({});
  });

  it("vaciar la fecha de nacimiento la borra, con null", () => {
    const editado = { ...CARGADO, birthDate: "" };

    expect(cambiosDelCliente(CARGADO, editado)).toEqual({ birthDate: null });
  });

  it("vaciar un contacto lo manda como undefined, no como cadena vacía", () => {
    const editado = { ...CARGADO, phone: "" };
    const cambios = cambiosDelCliente(CARGADO, editado);

    expect(Object.keys(cambios)).toEqual(["phone"]);
    expect(cambios.phone).toBeUndefined();
  });

  it("trata las notas ausentes y las vacías como lo mismo", () => {
    const sinNotas: ClientForm = { ...CARGADO, notes: undefined };

    expect(cambiosDelCliente(sinNotas, { ...CARGADO, notes: "" })).toEqual({});
  });

  it("manda el nombre sin los espacios de los extremos", () => {
    const editado = { ...CARGADO, name: "  Ana Ruiz  " };

    expect(cambiosDelCliente(CARGADO, editado)).toEqual({ name: "Ana Ruiz" });
  });

  it("añadir espacios alrededor del nombre no es un cambio", () => {
    const editado = { ...CARGADO, name: `  ${CARGADO.name}  ` };

    expect(cambiosDelCliente(CARGADO, editado)).toEqual({});
  });
});
