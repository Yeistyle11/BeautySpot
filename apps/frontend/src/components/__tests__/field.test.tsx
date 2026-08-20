import { render, screen } from "@testing-library/react";
import { Field } from "../ui/field";

describe("Field", () => {
  it("enlaza la etiqueta con el control", () => {
    render(
      <Field label="Cliente">
        <select defaultValue="">
          <option value="">Seleccionar...</option>
        </select>
      </Field>
    );

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
  });

  it("admite un aviso junto al control", () => {
    render(
      <Field label="Cliente">
        <select defaultValue="">
          <option value="">Seleccionar...</option>
        </select>
        <p role="status">Este cliente no se presentó 3 veces.</p>
      </Field>
    );

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 veces");
  });

  it("admite un aviso condicional que no se cumple", () => {
    const faltas = 0;

    render(
      <Field label="Cliente">
        <select defaultValue="">
          <option value="">Seleccionar...</option>
        </select>
        {faltas > 0 && <p role="status">No se presentó {faltas} veces.</p>}
      </Field>
    );

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("marca el control como invalido y le enlaza el error", () => {
    render(
      <Field label="Correo" error="No es un correo válido">
        <input type="email" />
      </Field>
    );

    const control = screen.getByLabelText("Correo");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("No es un correo válido");
  });

  it("enlaza el texto de ayuda al control", () => {
    render(
      <Field label="Teléfono" hint="Con indicativo, por ejemplo +57">
        <input />
      </Field>
    );

    expect(screen.getByLabelText("Teléfono")).toHaveAccessibleDescription(
      "Con indicativo, por ejemplo +57"
    );
  });
});
