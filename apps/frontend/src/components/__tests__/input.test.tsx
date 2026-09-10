import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "../ui/input";

describe("Input", () => {
  it("suelta el foco de un campo numerico al girar la rueda", () => {
    render(<Input type="number" aria-label="Monto" defaultValue="45000" />);
    const campo = screen.getByLabelText("Monto");

    campo.focus();
    expect(campo).toHaveFocus();

    fireEvent.wheel(campo);

    expect(campo).not.toHaveFocus();
    expect(campo).toHaveValue(45000);
  });

  it("no toca el foco de un campo de texto", () => {
    render(<Input type="text" aria-label="Nombre" />);
    const campo = screen.getByLabelText("Nombre");

    campo.focus();
    fireEvent.wheel(campo);

    expect(campo).toHaveFocus();
  });

  it("respeta el onWheel que le pasen", () => {
    const alGirar = jest.fn();
    render(<Input type="number" aria-label="Propina" onWheel={alGirar} />);
    const campo = screen.getByLabelText("Propina");

    campo.focus();
    fireEvent.wheel(campo);

    expect(alGirar).toHaveBeenCalledTimes(1);
    expect(campo).not.toHaveFocus();
  });
});
