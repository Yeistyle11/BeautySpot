import { fireEvent, render, screen } from "@testing-library/react";
import { CampoFechaDeNacimiento } from "../campo-fecha-de-nacimiento";
import { toLocalDateKey } from "@/lib/utils";

describe("CampoFechaDeNacimiento", () => {
  it("dice para qué se pide y que es opcional", () => {
    render(<CampoFechaDeNacimiento value="" onChange={jest.fn()} />);

    const campo = screen.getByLabelText("Fecha de nacimiento (opcional)");
    expect(campo).toHaveAccessibleDescription(
      "Solo la usamos para felicitarte en tu cumpleaños."
    );
  });

  it("no deja elegir un día que aún no ha llegado", () => {
    render(<CampoFechaDeNacimiento value="" onChange={jest.fn()} />);

    expect(screen.getByLabelText(/fecha de nacimiento/i)).toHaveAttribute(
      "max",
      toLocalDateKey(new Date())
    );
  });

  it("entrega la fecha elegida", () => {
    const onChange = jest.fn();
    render(<CampoFechaDeNacimiento value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/fecha de nacimiento/i), {
      target: { value: "1990-05-17" },
    });

    expect(onChange).toHaveBeenCalledWith("1990-05-17");
  });
});
