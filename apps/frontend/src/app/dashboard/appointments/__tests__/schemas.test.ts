import { z } from "zod";
import { paginatedSchema } from "@/lib/swr";
import {
  appointmentSchema,
  clientSchema,
  professionalSchema,
  serviceSchema,
  APPOINTMENTS_KEY,
  CLIENTS_KEY,
  PROFESSIONALS_KEY,
  SERVICES_KEY,
} from "../schemas";

/**
 * Una cita tal y como la devuelve /booking/appointments. Los decimales
 * (`totalAmount`, `price`) llegan como número porque la entidad los pasa por el
 * numericTransformer, y los recordatorios aun sin enviar llegan como null.
 */
const citaDeLaApi = {
  id: "e9ecd7ed-e9ab-4516-ae3c-20bfe21e6840",
  createdAt: "2026-07-28T06:47:08.003Z",
  updatedAt: "2026-07-28T06:47:08.003Z",
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  createdBy: "93532a9f-3727-474b-b3b1-979927a191bc",
  updatedBy: null,
  branchId: null,
  clientId: "4b976cc8-7942-4c64-86f1-7d5aa1e20f5a",
  professionalId: "904dbbed-a416-44f2-acfa-1e9278b3b09c",
  date: "2026-07-29",
  startTime: "10:00",
  endTime: "10:30",
  status: "PENDING",
  notes: "Cita de certificacion",
  cancelReason: null,
  pointsEarned: 0,
  totalAmount: 30000,
  reminder24hSentAt: null,
  reminder1hSentAt: null,
  appointmentServices: [
    {
      id: "0683f29c-ce06-4e6d-90f1-9093f4102b45",
      createdAt: "2026-07-28T06:47:08.003Z",
      updatedAt: "2026-07-28T06:47:08.003Z",
      appointmentId: "e9ecd7ed-e9ab-4516-ae3c-20bfe21e6840",
      serviceId: "4a28a25f-5168-4d8b-a8fd-51dc5f9f33e6",
      serviceName: "Corte básico",
      price: 30000,
      duration: 30,
    },
  ],
};

describe("appointmentSchema", () => {
  it("acepta la cita que devuelve la API, con nulos incluidos", () => {
    const result = appointmentSchema.safeParse(citaDeLaApi);

    expect(result.success).toBe(true);
  });

  it("conserva los importes como número, sin convertirlos a texto", () => {
    const cita = appointmentSchema.parse(citaDeLaApi);

    expect(cita.totalAmount).toBe(30000);
    expect(cita.appointmentServices[0].price).toBe(30000);
  });

  it("acepta una cita sin notas", () => {
    const result = appointmentSchema.safeParse({ ...citaDeLaApi, notes: null });

    expect(result.success).toBe(true);
  });

  it("rechaza importes en texto, que romperían el formato de moneda", () => {
    const result = appointmentSchema.safeParse({
      ...citaDeLaApi,
      totalAmount: "30000.00",
    });

    expect(result.success).toBe(false);
  });
});

describe("respuesta paginada de /booking/appointments", () => {
  it("acepta el sobre { data, meta } que envuelve la lista", () => {
    const respuesta = {
      data: [citaDeLaApi],
      meta: {
        page: 1,
        limit: 20,
        total: 13,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };

    const result = paginatedSchema(appointmentSchema).safeParse(respuesta);

    expect(result.success).toBe(true);
  });
});

describe("catálogos del formulario", () => {
  it("acepta el cliente dentro del sobre paginado de /core/clients", () => {
    const respuesta = {
      data: [
        {
          id: "4b976cc8-7942-4c64-86f1-7d5aa1e20f5a",
          createdAt: "2026-07-28T06:40:00.000Z",
          businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
          userId: null,
          name: "Laura Certificacion",
          email: "laura.cert@ejemplo.co",
          phone: "+573001234567",
        },
      ],
      meta: {
        page: 1,
        limit: 100,
        total: 8,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };

    const result = paginatedSchema(clientSchema).safeParse(respuesta);

    expect(result.success).toBe(true);
  });

  it("acepta el array pelado de /core/professionals y /core/services", () => {
    const profesionales = [
      { id: "904dbbed-a416-44f2-acfa-1e9278b3b09c", name: "David Arismendy" },
    ];
    const servicios = [
      {
        id: "4a28a25f-5168-4d8b-a8fd-51dc5f9f33e6",
        name: "Corte básico",
        price: 30000,
        duration: 30,
      },
    ];

    expect(z.array(professionalSchema).safeParse(profesionales).success).toBe(
      true
    );
    expect(z.array(serviceSchema).safeParse(servicios).success).toBe(true);
  });
});

describe("constantes de la pantalla", () => {
  it("apunta a las rutas del gateway", () => {
    expect(APPOINTMENTS_KEY).toBe("/booking/appointments");
    expect(PROFESSIONALS_KEY).toBe("/core/professionals");
    expect(SERVICES_KEY).toBe("/core/services");
  });

  it("pide los clientes de a lotes grandes, porque alimentan un desplegable", () => {
    // Con el limite por defecto (20) el desplegable esconde clientes sin avisar.
    const limite = Number(
      new URLSearchParams(CLIENTS_KEY.split("?")[1]).get("limit")
    );

    expect(limite).toBeGreaterThanOrEqual(100);
  });
});
