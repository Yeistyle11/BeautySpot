import { fireEvent, render, screen } from "@testing-library/react";
import { DayView, repartirSolapes } from "../day-view";
import type { Appointment } from "@/app/dashboard/appointments/schemas";

const DIA = "2026-08-20";

const PROFESIONALES = [
  { id: "prof-1", name: "Ana" },
  { id: "prof-2", name: "Luis" },
];

/** Cita de una hora, con su única línea de servicio. */
const cita = {
  id: "appt-1",
  businessId: "business-1",
  clientId: "client-1",
  professionalId: "prof-1",
  date: DIA,
  startTime: "10:00",
  endTime: "11:00",
  ocupadoHasta: null,
  totalAmount: 50000,
  status: "CONFIRMED",
  appointmentServices: [
    {
      serviceName: "Corte",
      duration: 60,
      orden: 0,
      procesadoDesde: null,
      procesadoMinutos: null,
      bufferDespues: null,
      professionalId: null,
    },
  ],
} as unknown as Appointment;

/** Props mínimos: cada test cambia solo lo que le interesa. */
function pintar(extra: Record<string, unknown> = {}) {
  return render(
    <DayView
      appointments={[cita]}
      professionals={PROFESIONALES}
      date={DIA}
      onDateChange={jest.fn()}
      onComplete={jest.fn()}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      onNoShow={jest.fn()}
      canConfirm
      canCancel
      clientNames={{ "client-1": "María" }}
      {...extra}
    />
  );
}

describe("DayView", () => {
  it("sin permiso para bloquear, la rejilla no es pulsable", () => {
    pintar();

    expect(
      screen.queryByRole("button", { name: /^Bloquear/ })
    ).not.toBeInTheDocument();
  });

  it("al pulsar un hueco propone bloquear esa media hora de ese profesional", () => {
    const onBloquearHueco = jest.fn();
    pintar({ onBloquearHueco });

    fireEvent.click(
      screen.getByRole("button", { name: "Bloquear 9:00 am de Luis" })
    );

    expect(onBloquearHueco).toHaveBeenCalledWith("prof-2", "09:00");
  });

  it("cada hora se parte en dos huecos de media hora", () => {
    const onBloquearHueco = jest.fn();
    pintar({ onBloquearHueco });

    fireEvent.click(
      screen.getByRole("button", { name: "Bloquear 9:30 am de Ana" })
    );

    expect(onBloquearHueco).toHaveBeenCalledWith("prof-1", "09:30");
  });

  it("pinta los bloqueos del dia con su motivo", () => {
    pintar({
      bloqueos: [
        {
          id: "block-1",
          professionalId: "prof-1",
          startTime: "13:00",
          endTime: "14:00",
          reason: "Almuerzo",
        },
      ],
    });

    expect(screen.getByText("Almuerzo")).toBeInTheDocument();
  });

  it("un bloqueo sin motivo se pinta igualmente", () => {
    pintar({
      bloqueos: [
        {
          id: "block-1",
          professionalId: "prof-1",
          startTime: "13:00",
          endTime: "14:00",
          reason: null,
        },
      ],
    });

    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
  });

  it("la rejilla se estira para que quepa un bloqueo de madrugada", () => {
    pintar({
      bloqueos: [
        {
          id: "block-1",
          professionalId: "prof-1",
          startTime: "01:00",
          endTime: "02:00",
          reason: "Cierre nocturno",
        },
      ],
    });

    // Sin estirarse, la rejilla arrancaría a las 7 y la 1 de la mañana no
    // tendría fila.
    expect(screen.getByText("1:00 am")).toBeInTheDocument();
  });

  it("pinta la cita que termina pasada la medianoche", () => {
    pintar({
      appointments: [
        {
          ...cita,
          id: "appt-noche",
          startTime: "23:30",
          endTime: "00:30",
        } as unknown as Appointment,
      ],
    });

    // La rejilla llega hasta la fila de la medianoche, que es donde acaba.
    expect(screen.getByText("11:00 pm")).toBeInTheDocument();
    expect(screen.getByText("12:00 am")).toBeInTheDocument();
  });

  // El solape legitimo es lo que hace valioso el tiempo de procesado: vender el
  // hueco del tinte a otra clienta. La agenda lo volvia ilegible.
  it("las citas que se solapan se reparten el ancho de la columna", () => {
    const segunda = {
      ...cita,
      id: "appt-2",
      clientId: "client-2",
      startTime: "10:15",
      endTime: "10:45",
      appointmentServices: [{ ...cita.appointmentServices[0], duration: 30 }],
    } as unknown as Appointment;

    pintar({
      appointments: [cita, segunda],
      clientNames: { "client-1": "María", "client-2": "Carlos" },
    });

    const primera = screen.getByText("María").closest("button")!;
    const otra = screen.getByText("Carlos").closest("button")!;

    expect(primera.style.width).toBe("calc(50% - 4px)");
    expect(otra.style.width).toBe("calc(50% - 4px)");
    // Una a cada lado: es lo que impide que la segunda tape a la primera.
    expect(primera.style.left).not.toBe(otra.style.left);
  });

  it("una cita sola sigue ocupando la columna entera", () => {
    pintar();

    const unica = screen.getByText("María").closest("button")!;
    expect(unica.style.width).toBe("calc(100% - 4px)");
    expect(unica.style.left).toBe("calc(0% + 2px)");
  });

  it("dice que el negocio está cerrado ese día", () => {
    // El 20 de agosto de 2026 es jueves (4); el negocio solo abre en semana.
    pintar({ diasAbiertos: [1, 2, 3] });

    expect(screen.getByText("Cerrado")).toBeInTheDocument();
  });

  it("sin horario cargado no afirma que esté cerrado", () => {
    pintar();

    expect(screen.queryByText("Cerrado")).not.toBeInTheDocument();
  });
});

describe("repartirSolapes", () => {
  /** Bloque mínimo con las horas que decide el reparto. */
  const bloque = (id: string, inicio: string, fin: string) =>
    ({
      appt: { id },
      professionalId: "prof-1",
      inicio,
      fin,
      ocupados: [{ inicio, fin }],
      finDeCliente: fin,
      compartida: false,
    }) as never;

  it("deja en una sola columna las citas que no se pisan", () => {
    const reparto = repartirSolapes([
      bloque("a", "10:00", "11:00"),
      bloque("b", "11:00", "12:00"),
    ]);

    expect(reparto.map((r) => r.columnas)).toEqual([1, 1]);
    expect(reparto.map((r) => r.columna)).toEqual([0, 0]);
  });

  it("parte en dos las que se solapan", () => {
    const reparto = repartirSolapes([
      bloque("a", "10:00", "11:00"),
      bloque("b", "10:15", "10:45"),
    ]);

    expect(reparto.map((r) => r.columnas)).toEqual([2, 2]);
    expect(reparto.map((r) => r.columna)).toEqual([0, 1]);
  });

  it("reutiliza la columna que ya ha quedado libre", () => {
    const reparto = repartirSolapes([
      bloque("a", "10:00", "11:00"),
      bloque("b", "10:15", "10:45"),
      bloque("c", "10:45", "11:00"),
    ]);

    // La tercera cabe donde termino la segunda: siguen bastando dos columnas.
    expect(reparto.map((r) => r.columnas)).toEqual([2, 2, 2]);
    expect(reparto[2].columna).toBe(1);
  });

  it("un grupo nuevo vuelve a empezar de cero", () => {
    const reparto = repartirSolapes([
      bloque("a", "10:00", "11:00"),
      bloque("b", "10:15", "10:45"),
      bloque("c", "12:00", "13:00"),
    ]);

    expect(reparto[2]).toMatchObject({ columna: 0, columnas: 1 });
  });

  it("no pierde ninguna cita", () => {
    const reparto = repartirSolapes([
      bloque("a", "10:00", "11:00"),
      bloque("b", "10:15", "10:45"),
      bloque("c", "10:30", "12:00"),
    ]);

    expect(reparto).toHaveLength(3);
    expect(reparto.every((r) => r.columnas === 3)).toBe(true);
  });
});
