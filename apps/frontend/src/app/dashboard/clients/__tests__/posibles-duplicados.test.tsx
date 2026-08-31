import { fireEvent, render, screen } from "@testing-library/react";
import { ClientFormDialog, emptyClientForm } from "../client-form-dialog";
import {
  clavePosiblesDuplicados,
  POSIBLES_DUPLICADOS,
  type Client,
} from "../schemas";

const ANA = {
  id: "c-1",
  name: "Ana Gómez",
  phone: "+573001112233",
  email: null,
} as Client;

describe("clavePosiblesDuplicados", () => {
  it("no busca con dos letras: cualquier cosa se parecería", () => {
    expect(clavePosiblesDuplicados("An")).toBeNull();
    expect(clavePosiblesDuplicados("  a  ")).toBeNull();
  });

  it("busca por el nombre tecleado, acotando el resultado", () => {
    const clave = clavePosiblesDuplicados("Ana");

    expect(clave).toContain("search=Ana");
    expect(clave).toContain(`limit=${POSIBLES_DUPLICADOS}`);
  });

  it("escapa lo que se teclee, que va en la URL", () => {
    expect(clavePosiblesDuplicados("Ana & Co")).toContain("Ana%20%26%20Co");
  });

  it("no cuenta los espacios de los extremos", () => {
    expect(clavePosiblesDuplicados("  Ana  ")).toContain("search=Ana");
  });
});

describe("ClientFormDialog: aviso de duplicado", () => {
  function pintar(
    extra: Partial<React.ComponentProps<typeof ClientFormDialog>> = {}
  ) {
    const onAbrirFicha = jest.fn();
    render(
      <ClientFormDialog
        open
        onClose={jest.fn()}
        onSubmit={jest.fn((e: React.FormEvent) => e.preventDefault())}
        form={{ ...emptyClientForm, name: "Ana Gomez" }}
        onChange={jest.fn()}
        title="Nuevo cliente"
        submitLabel="Crear cliente"
        saving={false}
        posiblesDuplicados={[ANA]}
        onAbrirFicha={onAbrirFicha}
        {...extra}
      />
    );
    return onAbrirFicha;
  }

  it("avisa de la ficha parecida, con su contacto", () => {
    pintar();

    expect(screen.getByText("Ya hay una ficha parecida")).toBeVisible();
    expect(screen.getByText(/Ana Gómez/)).toBeInTheDocument();
    expect(screen.getByText(/\+573001112233/)).toBeInTheDocument();
  });

  it("con varias, lo dice en plural", () => {
    pintar({
      posiblesDuplicados: [ANA, { ...ANA, id: "c-2", name: "Ana Gomes" }],
    });

    expect(screen.getByText("Ya hay 2 fichas parecidas")).toBeVisible();
  });

  // Avisar sin dar la salida sería solo un estorbo: lo útil es poder abrir la
  // ficha que ya existe en vez de crear la segunda.
  it("deja abrir la ficha existente en vez de crear otra", () => {
    const onAbrirFicha = pintar();

    fireEvent.click(screen.getByRole("button", { name: "Abrir esta" }));

    expect(onAbrirFicha).toHaveBeenCalledWith(ANA);
  });

  it("sin parecidas no estorba con nada", () => {
    pintar({ posiblesDuplicados: [] });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // El aviso no bloquea: dos personas pueden llamarse igual.
  it("el aviso no impide crear la ficha", () => {
    pintar();

    expect(
      screen.getByRole("button", { name: "Crear cliente" })
    ).not.toBeDisabled();
  });
});
