import { fireEvent, render, screen } from "@testing-library/react";
import { MergeDialog } from "../merge-dialog";
import type { Client } from "../schemas";

/** Ficha mínima de la cartera. */
const ficha = (extra: Partial<Client>): Client =>
  ({
    id: "c-1",
    name: "Ana Gómez",
    email: null,
    phone: null,
    loyaltyPoints: 0,
    notes: null,
    birthDate: null,
    active: true,
    ficha: null,
    anonymizedAt: null,
    ...extra,
  }) as Client;

const SUPERVIVIENTE = ficha({
  id: "c-1",
  name: "Ana Gómez",
  phone: "+573001112233",
});
const DUPLICADA = ficha({
  id: "c-2",
  name: "Ana Gomez",
  email: "ana.trabajo@correo.co",
});

function pintar(extra: Partial<React.ComponentProps<typeof MergeDialog>> = {}) {
  const onFusionar = jest.fn();
  const onAbsorbidoChange = jest.fn();
  render(
    <MergeDialog
      open
      onClose={jest.fn()}
      onFusionar={onFusionar}
      superviviente={SUPERVIVIENTE}
      candidatos={[DUPLICADA]}
      absorbidoId=""
      onAbsorbidoChange={onAbsorbidoChange}
      saving={false}
      {...extra}
    />
  );
  return { onFusionar, onAbsorbidoChange };
}

describe("MergeDialog", () => {
  it("identifica las fichas por su contacto, que es lo que las distingue", () => {
    pintar();

    expect(
      screen.getByRole("option", { name: /Ana Gomez · ana.trabajo@correo.co/ })
    ).toBeInTheDocument();
  });

  it("dice qué se queda la ficha que sobrevive", () => {
    pintar({ absorbidoId: "c-2" });

    expect(screen.getByText(/citas, los cobros, las facturas/)).toBeVisible();
    expect(screen.getByText(/puntos de fidelidad sumados/)).toBeVisible();
  });

  // Que sea irreversible se dice antes de pulsar, no en el mensaje de error.
  it("avisa de que no se puede deshacer", () => {
    pintar();

    expect(screen.getByText("No se puede deshacer.")).toBeVisible();
  });

  it("sin elegir la duplicada no deja fusionar", () => {
    pintar();

    expect(screen.getByRole("button", { name: "Fusionar" })).toBeDisabled();
  });

  it("con la duplicada elegida, fusiona", () => {
    const { onFusionar } = pintar({ absorbidoId: "c-2" });

    fireEvent.click(screen.getByRole("button", { name: "Fusionar" }));

    expect(onFusionar).toHaveBeenCalled();
  });

  it("enseña hacia dónde va el historial", () => {
    pintar({ absorbidoId: "c-2" });

    // La duplicada y la superviviente, en ese orden.
    expect(screen.getAllByText(/Ana G[oó]mez/).length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("enseña el motivo por el que el servicio la rechazó", () => {
    pintar({ error: "Cada ficha está vinculada a una cuenta distinta" });

    expect(screen.getByRole("alert")).toHaveTextContent("cuenta distinta");
  });
});
