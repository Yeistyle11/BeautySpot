import { fireEvent, render, screen } from "@testing-library/react";
import { Edit, Trash2 } from "lucide-react";
import { AccionesDeFila } from "@/components/ui/acciones-de-fila";

/**
 * Abre el menú «⋯». Se abre con teclado porque jsdom no tiene PointerEvent y
 * Radix descarta el pointerdown sin botón.
 */
function abrirMenu(nombre: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: nombre }), {
    key: "Enter",
  });
}

describe("AccionesDeFila", () => {
  it("con una sola acción no pinta menú: el icono basta", () => {
    const alEditar = jest.fn();
    render(
      <AccionesDeFila
        sobre="Corte"
        acciones={[
          {
            etiqueta: "Editar",
            descripcion: "Editar Corte",
            icono: Edit,
            alElegir: alEditar,
          },
        ]}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Acciones de Corte" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Corte" }));
    expect(alEditar).toHaveBeenCalled();
  });

  it("en el menú dice cada acción con palabras y la ejecuta al elegirla", () => {
    const alBorrar = jest.fn();
    render(
      <AccionesDeFila
        sobre="Corte"
        acciones={[
          {
            etiqueta: "Editar",
            descripcion: "Editar Corte",
            icono: Edit,
            alElegir: jest.fn(),
          },
          {
            etiqueta: "Eliminar",
            descripcion: "Eliminar Corte",
            icono: Trash2,
            tono: "destructivo",
            alElegir: alBorrar,
          },
        ]}
      />
    );

    abrirMenu("Acciones de Corte");
    fireEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    expect(alBorrar).toHaveBeenCalled();
  });

  it("deja fuera del menú las acciones que no aplican", () => {
    render(
      <AccionesDeFila
        sobre="Corte"
        acciones={[
          {
            etiqueta: "Editar",
            descripcion: "Editar Corte",
            icono: Edit,
            alElegir: jest.fn(),
          },
          {
            etiqueta: "Reagendar",
            descripcion: "Reagendar Corte",
            icono: Edit,
            alElegir: jest.fn(),
            visible: false,
          },
          false,
          {
            etiqueta: "Eliminar",
            descripcion: "Eliminar Corte",
            icono: Trash2,
            alElegir: jest.fn(),
          },
        ]}
      />
    );

    abrirMenu("Acciones de Corte");

    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Editar",
      "Eliminar",
    ]);
  });

  it("una acción deshabilitada no se ejecuta desde el menú", () => {
    const alBorrar = jest.fn();
    render(
      <AccionesDeFila
        sobre="Corte"
        acciones={[
          {
            etiqueta: "Editar",
            descripcion: "Editar Corte",
            icono: Edit,
            alElegir: jest.fn(),
          },
          {
            etiqueta: "Eliminar",
            descripcion: "Eliminar Corte",
            icono: Trash2,
            alElegir: alBorrar,
            deshabilitada: true,
          },
        ]}
      />
    );

    abrirMenu("Acciones de Corte");
    fireEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    expect(alBorrar).not.toHaveBeenCalled();
  });
});
