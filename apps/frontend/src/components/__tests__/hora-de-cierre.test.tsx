import { render, screen } from "@testing-library/react";
import { HoraDeCierre } from "../ui/hora-de-cierre";

/** Textos de las opciones que ofrece el desplegable. */
function opciones(): string[] {
  return screen
    .getAllByRole("option")
    .map((o) => o.textContent ?? "")
    .filter(Boolean);
}

describe("HoraDeCierre", () => {
  it("avisa de que la hora elegida cae ya en la madrugada", () => {
    render(
      <HoraDeCierre value="02:00" apertura="20:00" onValueChange={jest.fn()} />
    );

    expect(opciones()).toContain("2:00 am (madrugada)");
  });

  // Con el negocio abierto desde la una de la tarde, cerrar a las dos de la
  // tarde es el mismo día; la etiqueta no debe sugerir lo contrario.
  it("no llama madrugada a una hora posterior a la apertura", () => {
    render(
      <HoraDeCierre value="14:00" apertura="13:00" onValueChange={jest.fn()} />
    );

    expect(opciones()).toContain("2:00 pm");
    expect(opciones()).not.toContain("2:00 pm (madrugada)");
  });

  // El backend acota la madrugada a las 08:00: ofrecer las 09:00 con apertura a
  // las 20:00 seria ofrecer algo que se va a rechazar al guardar.
  it("no ofrece horas que ni son del dia ni caben en la madrugada", () => {
    render(
      <HoraDeCierre value="24:00" apertura="20:00" onValueChange={jest.fn()} />
    );

    const ofrecidas = opciones();
    expect(ofrecidas).toContain("8:00 am (madrugada)");
    expect(ofrecidas).not.toContain("9:00 am");
    expect(ofrecidas).not.toContain("9:00 am (madrugada)");
  });

  // "24:00" y "00:00" son la misma hora del reloj y significan cosas opuestas:
  // el final del dia y su principio.
  it("nombra la medianoche como final del dia", () => {
    render(
      <HoraDeCierre value="24:00" apertura="09:00" onValueChange={jest.fn()} />
    );

    expect(opciones()).toContain("12:00 am (medianoche)");
  });

  // Editar un horario no puede perder lo que ya estaba guardado, aunque no
  // caiga en la rejilla de media hora.
  it("conserva el valor guardado aunque no este en la rejilla", () => {
    render(
      <HoraDeCierre value="01:45" apertura="20:00" onValueChange={jest.fn()} />
    );

    expect(screen.getByRole("combobox")).toHaveValue("01:45");
  });
});
