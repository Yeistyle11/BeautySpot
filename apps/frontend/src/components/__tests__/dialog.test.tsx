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

  it("el fondo queda debajo del formulario cada vez que se abre", () => {
    const dialogo = (open: boolean) => (
      <Dialog open={open} onClose={jest.fn()} title="Nuevo servicio">
        <p>Contenido</p>
      </Dialog>
    );
    const { rerender } = render(dialogo(false));

    for (let vez = 0; vez < 2; vez++) {
      rerender(dialogo(true));
      const formulario = screen.getByRole("dialog");
      const fondo = [...document.querySelectorAll('[data-state="open"]')].find(
        (nodo) => nodo !== formulario && !formulario.contains(nodo)
      );

      // Con el mismo z-index, lo que va después en el documento queda encima.
      expect(fondo).toBeDefined();
      expect(
        fondo!.compareDocumentPosition(formulario) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      rerender(dialogo(false));
    }
  });

  it("al reabrirlo no conserva lo escrito la vez anterior", () => {
    const dialogo = (open: boolean) => (
      <Dialog open={open} onClose={jest.fn()} title="Nuevo cliente">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" defaultValue="" />
      </Dialog>
    );
    const { rerender } = render(dialogo(true));
    escribirComoUsuario(screen.getByLabelText("Nombre"), "Camila");

    rerender(dialogo(false));
    rerender(dialogo(true));

    expect(screen.getByLabelText("Nombre")).toHaveValue("");
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
