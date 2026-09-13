import { fireEvent, render, screen } from "@testing-library/react";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";

/** Escribir en un campo del diálogo, como haría quien lo rellena. */
function escribirComoUsuario(campo: HTMLElement, valor: string) {
  fireEvent.change(campo, { target: { value: valor } });
}

/** Diálogo con un campo dentro. */
function pintar(onClose = jest.fn()) {
  render(
    <Dialog open onClose={onClose} title="Nuevo cliente">
      <label htmlFor="nombre">Nombre</label>
      <input id="nombre" defaultValue="" />
    </Dialog>
  );
  return onClose;
}

describe("Dialog", () => {
  it("cierra sin preguntar cuando no se ha escrito nada", () => {
    const onClose = pintar();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalled();
    expect(
      screen.queryByText("¿Descartar lo escrito?")
    ).not.toBeInTheDocument();
  });

  it("pregunta antes de tirar lo que el usuario escribió", () => {
    const onClose = pintar();
    escribirComoUsuario(screen.getByLabelText("Nombre"), "Camila");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.getByText("¿Descartar lo escrito?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("«Seguir aquí» devuelve al formulario con lo escrito", () => {
    const onClose = pintar();
    escribirComoUsuario(screen.getByLabelText("Nombre"), "Camila");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Seguir aquí" }));

    expect(
      screen.queryByText("¿Descartar lo escrito?")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Camila");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("«Descartar» cierra el diálogo", () => {
    const onClose = pintar();
    escribirComoUsuario(screen.getByLabelText("Nombre"), "Camila");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("el botón del pie también pregunta antes de cerrar", () => {
    const onClose = jest.fn();
    render(
      <Dialog
        open
        onClose={onClose}
        title="Nuevo cliente"
        pie={<BotonDeCancelar />}
      >
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" defaultValue="" />
      </Dialog>
    );
    escribirComoUsuario(screen.getByLabelText("Nombre"), "Camila");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("¿Descartar lo escrito?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("no avisa cuando el diálogo pide no avisar", () => {
    const onClose = jest.fn();
    render(
      <Dialog
        open
        onClose={onClose}
        title="Eliminar bloqueo"
        sinAvisoDeDescarte
      >
        <label htmlFor="serie">Eliminar la serie</label>
        <input id="serie" type="checkbox" />
      </Dialog>
    );
    fireEvent.click(screen.getByLabelText("Eliminar la serie"));

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("no cuenta como escrito lo que llega ya puesto", () => {
    const onClose = jest.fn();
    render(
      <Dialog open onClose={onClose} title="Editar cliente">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" defaultValue="Camila" readOnly />
      </Dialog>
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalled();
  });
});
