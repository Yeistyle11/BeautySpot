import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfessionalAppointments from "@/components/dashboard/ProfessionalAppointments";

const baseAppointment = {
  key: 1,
  id: 1,
  ids: [1],
  date: new Date("2026-07-20T00:00:00Z"),
  startTime: "10:00",
  endTime: "11:00",
  status: "PENDING",
  notes: null,
  client: {
    name: "Juan Pérez",
    email: "juan@example.com",
    phone: "555-1234",
  },
  services: [{ name: "Corte", price: 20000, duration: 30 }],
  totalPrice: 20000,
  totalDuration: 30,
};

const routerRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefresh,
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

describe("ProfessionalAppointments", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza mensaje de vacío cuando no hay citas", () => {
    render(
      <ProfessionalAppointments
        professionalId={1}
        initialTodayAppointments={[]}
        initialUpcomingAppointments={[]}
      />
    );

    expect(screen.getByText("No tienes citas para hoy")).toBeInTheDocument();
    expect(screen.getByText("No hay próximas citas")).toBeInTheDocument();
  });

  it("renderiza las citas de hoy", () => {
    render(
      <ProfessionalAppointments
        professionalId={1}
        initialTodayAppointments={[baseAppointment]}
        initialUpcomingAppointments={[]}
      />
    );

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText(/Corte/)).toBeInTheDocument();
    expect(screen.getByText("✓ Confirmar")).toBeInTheDocument();
  });

  it("ejecuta acción confirm y refresca la página", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

    render(
      <ProfessionalAppointments
        professionalId={1}
        initialTodayAppointments={[baseAppointment]}
        initialUpcomingAppointments={[]}
      />
    );

    fireEvent.click(screen.getByText("✓ Confirmar"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/appointments/1/confirm", {
        method: "POST",
      });
    });

    await waitFor(() => {
      expect(routerRefresh).toHaveBeenCalled();
    });
  });

  it("no muestra botón Confirmar si status no es PENDING", () => {
    render(
      <ProfessionalAppointments
        professionalId={1}
        initialTodayAppointments={[{ ...baseAppointment, status: "CONFIRMED" }]}
        initialUpcomingAppointments={[]}
      />
    );

    expect(screen.queryByText("✓ Confirmar")).not.toBeInTheDocument();
    expect(screen.getByText("✓ Completar")).toBeInTheDocument();
  });
});
