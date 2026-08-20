import { render, screen } from "@testing-library/react";
import { AppointmentForm } from "../appointment-form";
import { emptyForm } from "../schemas";
import type { Client, Professional, Service } from "../schemas";

const PROFESIONALES = [
  { id: "prof-1", name: "Ana Restrepo" },
] as unknown as Professional[];

const SERVICIOS = [
  { id: "srv-1", name: "Corte clásico", price: 30000, duration: 45 },
] as unknown as Service[];

/** Cliente con las faltas que se indiquen, que es lo que dispara el aviso. */
const clientes = (noShowCount: number) =>
  [{ id: "cli-1", name: "Carlos Pérez", noShowCount }] as unknown as Client[];

/** El formulario con lo mínimo, y el cliente ya elegido. */
function pintar(clients: Client[]) {
  return render(
    <AppointmentForm
      form={{ ...emptyForm, clientId: "cli-1" }}
      onChange={jest.fn()}
      onSubmit={jest.fn()}
      professionals={PROFESIONALES}
      clients={clients}
      services={SERVICIOS}
      selectedServices={[]}
      onToggleService={jest.fn()}
      asignaciones={{}}
      onAsignar={jest.fn()}
      submitting={false}
      error=""
    />
  );
}

describe("AppointmentForm", () => {
  it("se pinta con sus campos", () => {
    pintar(clientes(0));

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Profesional")).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha")).toBeInTheDocument();
  });

  it("avisa de las faltas del cliente elegido", () => {
    pintar(clientes(3));

    expect(screen.getByRole("status")).toHaveTextContent(
      "no se presentó 3 veces"
    );
  });

  it("no dice nada del cliente que nunca ha faltado", () => {
    pintar(clientes(0));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
