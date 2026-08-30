import { fireEvent, render, screen } from "@testing-library/react";
import { ServicesDialog } from "../services-dialog";
import {
  filasDeTarifas,
  type Professional,
  type ServicioDelCatalogo,
} from "../schemas";

const CORTE = "svc-corte";

const CATALOGO: ServicioDelCatalogo[] = [
  { id: CORTE, name: "Corte", price: 30000, duration: 30, active: true },
];

const ANA = { id: "pro-1", name: "Ana Restrepo" } as Professional;

/** Pinta el diálogo con las filas que se le pasen y devuelve el onChange. */
function pintar(extra: Record<string, unknown> = {}) {
  const onChange = jest.fn();
  render(
    <ServicesDialog
      open
      onClose={jest.fn()}
      onSave={jest.fn()}
      professional={ANA}
      servicios={CATALOGO}
      filas={filasDeTarifas(CATALOGO, [])}
      onChange={onChange}
      saving={false}
      cargando={false}
      {...extra}
    />
  );
  return onChange;
}

describe("ServicesDialog", () => {
  it("enseña el precio del catálogo como referencia", () => {
    pintar();

    expect(screen.getByText(/Catálogo: \$ 30.000 · 30 min/)).toBeVisible();
  });

  // Sin prestar el servicio, su tarifa no tiene sentido y no se pide.
  it("los campos de tarifa solo salen si presta el servicio", () => {
    pintar();

    expect(
      screen.queryByLabelText("Precio propio de Corte")
    ).not.toBeInTheDocument();
  });

  it("marcar el servicio lo deja como prestado", () => {
    const onChange = pintar();

    fireEvent.click(screen.getByLabelText("Corte: lo presta"));

    expect(onChange).toHaveBeenCalledWith([
      { serviceId: CORTE, presta: true, precio: "", duracion: "" },
    ]);
  });

  it("con el servicio prestado se puede fijar su tarifa", () => {
    const onChange = pintar({
      filas: filasDeTarifas(CATALOGO, [{ serviceId: CORTE }]),
    });

    fireEvent.change(screen.getByLabelText("Precio propio de Corte"), {
      target: { value: "45000" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { serviceId: CORTE, presta: true, precio: "45000", duracion: "" },
    ]);
  });

  // El campo en blanco es «lo que diga el catálogo», que es lo que hay que
  // poder decir sin borrar la asignación.
  it("el precio del catálogo es el marcador de posición", () => {
    pintar({ filas: filasDeTarifas(CATALOGO, [{ serviceId: CORTE }]) });

    expect(screen.getByLabelText("Precio propio de Corte")).toHaveAttribute(
      "placeholder",
      "30000"
    );
  });

  it("dejar de prestarlo también borra la tarifa que tenía", () => {
    const onChange = pintar({
      filas: filasDeTarifas(CATALOGO, [
        { serviceId: CORTE, customPrice: 45000, customDuration: 45 },
      ]),
    });

    fireEvent.click(screen.getByLabelText("Corte: lo presta"));

    expect(onChange).toHaveBeenCalledWith([
      { serviceId: CORTE, presta: false, precio: "", duracion: "" },
    ]);
  });

  it("lo dice cuando el negocio no tiene servicios que asignar", () => {
    pintar({ servicios: [], filas: [] });

    expect(screen.getByText(/no tiene servicios en el catálogo/)).toBeVisible();
  });

  it("no deja guardar mientras carga", () => {
    pintar({ cargando: true });

    expect(
      screen.getByRole("button", { name: "Guardar servicios" })
    ).toBeDisabled();
  });
});
