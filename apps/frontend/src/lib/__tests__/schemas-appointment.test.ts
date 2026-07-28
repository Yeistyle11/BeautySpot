import { paginatedSchema } from "@/lib/swr";
import {
  appointmentSchema,
  APPOINTMENTS_KEY,
} from "@/lib/schemas/appointment";

/** Una cita tal y como la devuelve GET /booking/appointments. */
const citaDeLaApi = {
  id: "e9ecd7ed-e9ab-4516-ae3c-20bfe21e6840",
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  clientId: "4b976cc8-7942-4c64-86f1-7d5aa1e20f5a",
  professionalId: "904dbbed-a416-44f2-acfa-1e9278b3b09c",
  date: "2026-07-29",
  startTime: "10:00",
  endTime: "10:30",
  status: "PENDING",
  notes: null,
  totalAmount: 30000,
  reminder24hSentAt: null,
  reminder1hSentAt: null,
  appointmentServices: [
    { serviceName: "Corte básico", price: 30000, duration: 30 },
  ],
};

const respuestaPaginada = {
  data: [citaDeLaApi],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

describe("appointmentSchema canónico", () => {
  it("acepta la cita que devuelve la API", () => {
    expect(appointmentSchema.safeParse(citaDeLaApi).success).toBe(true);
  });

  it("conserva los importes como número", () => {
    const cita = appointmentSchema.parse(citaDeLaApi);

    expect(cita.totalAmount).toBe(30000);
    expect(cita.appointmentServices[0].price).toBe(30000);
  });

  it("rechaza importes en texto", () => {
    const result = appointmentSchema.safeParse({
      ...citaDeLaApi,
      totalAmount: "30000.00",
    });

    expect(result.success).toBe(false);
  });

  // Cinco pantallas duplicaban este schema y todas leían la lista como array
  // pelado, lo que las dejaba permanentemente vacías.
  it("se consume envuelto en { data, meta }, no como array pelado", () => {
    expect(paginatedSchema(appointmentSchema).safeParse(respuestaPaginada).success).toBe(
      true
    );
    expect(appointmentSchema.array().safeParse(respuestaPaginada).success).toBe(
      false
    );
  });

  it("apunta a la ruta del gateway", () => {
    expect(APPOINTMENTS_KEY).toBe("/booking/appointments");
  });
});
