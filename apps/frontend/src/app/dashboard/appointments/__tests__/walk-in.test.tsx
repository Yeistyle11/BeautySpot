import { fireEvent, render, screen } from "@testing-library/react";
import { WalkInDialog } from "../walk-in-dialog";
import {
  emptyWalkInForm,
  horaActual,
  walkInCompleto,
  walkInParaEnviar,
  type Client,
  type Professional,
  type Service,
} from "../schemas";

const PROFESIONALES = [
  { id: "prof-1", name: "Ana" },
] as unknown as Professional[];
const CLIENTES = [
  { id: "client-1", name: "María Gómez", noShowCount: 0 },
] as unknown as Client[];
const SERVICIOS = [
  { id: "svc-1", name: "Corte", price: 30000, duration: 30 },
  { id: "svc-2", name: "Barba", price: 20000, duration: 20 },
] as unknown as Service[];

/** Walk-in ya relleno: quien lo anota solo tiene que confirmarlo. */
const LISTO = {
  ...emptyWalkInForm,
  professionalId: "prof-1",
  clientId: "client-1",
  startTime: "14:30",
};

describe("horaActual", () => {
  it("da la hora del reloj con dos dígitos", () => {
    expect(horaActual(new Date("2026-08-30T09:05:00"))).toBe("09:05");
  });
});

describe("walkInCompleto", () => {
  it("hace falta profesional, cliente, hora y algún servicio", () => {
    expect(walkInCompleto(LISTO, ["svc-1"])).toBe(true);
    expect(walkInCompleto(LISTO, [])).toBe(false);
    expect(walkInCompleto({ ...LISTO, clientId: "" }, ["svc-1"])).toBe(false);
    expect(walkInCompleto({ ...LISTO, startTime: "" }, ["svc-1"])).toBe(false);
  });
});

describe("walkInParaEnviar", () => {
  // La fecha la pone el servicio: un walk-in solo se anota el día en que se
  // atendió, y mandarla desde el navegador abriría el pasado entero.
  it("no manda fecha", () => {
    const cuerpo = walkInParaEnviar(LISTO, ["svc-1"], {});

    expect(cuerpo).not.toHaveProperty("date");
    expect(cuerpo).toMatchObject({
      professionalId: "prof-1",
      clientId: "client-1",
      serviceIds: ["svc-1"],
      startTime: "14:30",
    });
  });

  it("lleva las asignaciones de quien no atiende el titular", () => {
    const cuerpo = walkInParaEnviar(LISTO, ["svc-1", "svc-2"], {
      "svc-2": "prof-2",
    });

    expect(cuerpo.asignaciones).toEqual([
      { serviceId: "svc-2", professionalId: "prof-2" },
    ]);
  });

  it("descarta la asignación de un servicio que ya no está en la cita", () => {
    const cuerpo = walkInParaEnviar(LISTO, ["svc-1"], { "svc-2": "prof-2" });

    expect(cuerpo.asignaciones).toBeUndefined();
  });

  it("una nota vacía no viaja", () => {
    expect(walkInParaEnviar(LISTO, ["svc-1"], {}).notes).toBeUndefined();
  });
});

describe("WalkInDialog", () => {
  function pintar(
    extra: Partial<React.ComponentProps<typeof WalkInDialog>> = {}
  ) {
    const onChange = jest.fn();
    const onToggleService = jest.fn();
    render(
      <WalkInDialog
        open
        onClose={jest.fn()}
        onSubmit={jest.fn((e: React.FormEvent) => e.preventDefault())}
        form={LISTO}
        onChange={onChange}
        professionals={PROFESIONALES}
        clients={CLIENTES}
        services={SERVICIOS}
        selectedServices={["svc-1"]}
        onToggleService={onToggleService}
        saving={false}
        {...extra}
      />
    );
    return { onChange, onToggleService };
  }

  it("explica que es para alguien ya atendido hoy", () => {
    pintar();

    expect(screen.getByText(/ya se atendió hoy sin cita/)).toBeVisible();
  });

  // Solo hacia atrás: un walk-in se anota después de atenderlo.
  it("no deja apuntar una hora que aún no ha llegado", () => {
    pintar();

    expect(screen.getByLabelText(/Hora a la que se atendió/)).toHaveAttribute(
      "max",
      horaActual()
    );
  });

  it("suma el total de lo que se eligió", () => {
    pintar({ selectedServices: ["svc-1", "svc-2"] });

    expect(screen.getByText(/\$ 50.000/)).toBeInTheDocument();
  });

  it("sin servicios no deja registrar", () => {
    pintar({ selectedServices: [] });

    expect(screen.getByRole("button", { name: /Registrar/ })).toBeDisabled();
  });

  it("el botón dice si además se va a cobrar", () => {
    pintar();
    expect(
      screen.getByRole("button", { name: "Registrar y cobrar" })
    ).toBeInTheDocument();
  });

  it("sin cobrar, ni método ni total", () => {
    pintar({ form: { ...LISTO, cobrar: false } });

    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar" })
    ).toBeInTheDocument();
  });

  it("la referencia solo se pide en transferencia", () => {
    pintar();
    expect(screen.queryByLabelText("Referencia")).not.toBeInTheDocument();

    pintar({ form: { ...LISTO, metodo: "TRANSFER" } });
    expect(screen.getAllByLabelText("Referencia")[0]).toBeInTheDocument();
  });

  it("elegir un servicio lo comunica", () => {
    const { onToggleService } = pintar();

    fireEvent.click(screen.getByRole("button", { name: /Barba/ }));

    expect(onToggleService).toHaveBeenCalledWith("svc-2");
  });

  it("enseña el motivo por el que el servicio lo rechazó", () => {
    pintar({ error: "No hay una caja abierta" });

    expect(screen.getByRole("alert")).toHaveTextContent("No hay una caja");
  });
});
