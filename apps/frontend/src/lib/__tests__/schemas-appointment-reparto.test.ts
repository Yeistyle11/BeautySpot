import { appointmentSchema } from "../schemas/appointment";

const citaDeLaApi = {
  id: "appt-1",
  date: "2026-08-10",
  startTime: "10:00",
  endTime: "11:30",
  status: "CONFIRMED",
  notes: null,
  totalAmount: 120000,
  businessId: "biz-1",
  professionalId: "prof-1",
  clientId: "cli-1",
  appointmentServices: [{ serviceName: "Tinte", price: 120000, duration: 90 }],
};

describe("appointmentSchema: reparto de la agenda", () => {
  it("acepta una cita sin reparto", () => {
    const parsed = appointmentSchema.parse(citaDeLaApi);

    expect(parsed.ocupadoHasta).toBeUndefined();
    expect(parsed.appointmentServices[0].procesadoDesde).toBeUndefined();
  });

  it("conserva el procesado y la limpieza de cada línea", () => {
    const parsed = appointmentSchema.parse({
      ...citaDeLaApi,
      ocupadoHasta: "11:40",
      appointmentServices: [
        {
          serviceName: "Tinte",
          price: 120000,
          duration: 90,
          orden: 0,
          procesadoDesde: 20,
          procesadoMinutos: 40,
          bufferDespues: 10,
        },
      ],
    });

    expect(parsed.ocupadoHasta).toBe("11:40");
    expect(parsed.appointmentServices[0]).toMatchObject({
      procesadoDesde: 20,
      procesadoMinutos: 40,
      bufferDespues: 10,
    });
  });

  it("admite el nulo con que viajan las citas sin reparto configurado", () => {
    const parsed = appointmentSchema.parse({
      ...citaDeLaApi,
      ocupadoHasta: null,
      appointmentServices: [
        {
          serviceName: "Corte",
          price: 30000,
          duration: 30,
          orden: 0,
          procesadoDesde: null,
          procesadoMinutos: null,
          bufferDespues: 0,
        },
      ],
    });

    expect(parsed.ocupadoHasta).toBeNull();
  });
});
