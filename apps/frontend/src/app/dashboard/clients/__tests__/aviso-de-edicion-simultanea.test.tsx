import { fireEvent, render, screen } from "@testing-library/react";
import { ClientFormDialog, emptyClientForm } from "../client-form-dialog";
import { ServiceFormDialog } from "../../services/service-form-dialog";
import { emptyForm } from "../../services/schemas";

const MOTIVO =
  "Otra persona guardó cambios mientras editabas. Recarga para ver cómo ha quedado.";

/**
 * La segunda persona en guardar tiene que enterarse. El aviso vive dentro del
 * formulario, no en uno de los que se van solos, porque hay algo que decidir; y
 * lo escrito sigue en pantalla hasta que se recarga.
 */
describe("aviso de edición simultánea", () => {
  it("la ficha de cliente lo enseña sin cerrar el formulario ni perder lo escrito", () => {
    const onRecargar = jest.fn();
    render(
      <ClientFormDialog
        open
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        form={{ ...emptyClientForm, name: "Ana Gómez", phone: "+573001112233" }}
        onChange={jest.fn()}
        title="Editar cliente"
        submitLabel="Guardar cambios"
        saving={false}
        conNotas
        conflicto={MOTIVO}
        onRecargar={onRecargar}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Otra persona guardó");
    // El teléfono que se estaba escribiendo sigue donde estaba.
    expect(screen.getByDisplayValue("+573001112233")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recargar" }));

    expect(onRecargar).toHaveBeenCalled();
  });

  it("el servicio lo enseña igual, que es donde se pisa la tarifa", () => {
    const onRecargar = jest.fn();
    render(
      <ServiceFormDialog
        open
        onClose={jest.fn()}
        modo="editar"
        form={{ ...emptyForm, name: "Corte", price: "45000" }}
        onFormChange={jest.fn()}
        onSubmit={jest.fn()}
        guardando={false}
        categorias={[]}
        conflicto={MOTIVO}
        onRecargar={onRecargar}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Otra persona guardó");
    expect(screen.getByDisplayValue("45000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recargar" }));

    expect(onRecargar).toHaveBeenCalled();
  });

  it("mientras recarga no se puede volver a pedir", () => {
    const onRecargar = jest.fn();
    render(
      <ClientFormDialog
        open
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        form={emptyClientForm}
        onChange={jest.fn()}
        title="Editar cliente"
        submitLabel="Guardar cambios"
        saving={false}
        conflicto={MOTIVO}
        onRecargar={onRecargar}
        recargando
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Recargando..." }));

    expect(onRecargar).not.toHaveBeenCalled();
  });

  it("sin conflicto no hay nada que avisar", () => {
    render(
      <ClientFormDialog
        open
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        form={emptyClientForm}
        onChange={jest.fn()}
        title="Editar cliente"
        submitLabel="Guardar cambios"
        saving={false}
        onRecargar={jest.fn()}
      />
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
