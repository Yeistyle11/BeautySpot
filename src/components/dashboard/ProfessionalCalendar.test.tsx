import { render, screen, fireEvent } from "@testing-library/react";
import ProfessionalCalendar from "@/components/dashboard/ProfessionalCalendar";

const appointmentOn = (
  day: number,
  status: string = "CONFIRMED",
  id: number = 1
) => ({
  id,
  date: new Date(2026, 6, day), // Julio 2026 (month es 0-indexed)
  startTime: "10:00",
  endTime: "11:00",
  status,
  notes: null,
  client: {
    name: "Juan Pérez",
    email: "juan@example.com",
    phone: "555-1234",
  },
  services: [{ name: "Corte", price: 20000, duration: 30 }],
  totalPrice: 20000,
  totalDuration: 30,
});

describe("ProfessionalCalendar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 15)); // 15 de julio 2026
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renderiza el mes actual", () => {
    render(<ProfessionalCalendar appointments={[]} />);
    // El título del calendario muestra "Julio de 2026"
    expect(screen.getByText(/julio.*2026/i)).toBeInTheDocument();
  });

  it("muestra los encabezados de días de la semana", () => {
    render(<ProfessionalCalendar appointments={[]} />);
    expect(screen.getByText("Lun")).toBeInTheDocument();
    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getByText("Dom")).toBeInTheDocument();
  });

  it("navega al mes siguiente y anterior", () => {
    render(<ProfessionalCalendar appointments={[]} />);

    const nextButtons = screen.getAllByTitle("Mes siguiente");
    fireEvent.click(nextButtons[0]);
    expect(screen.getByText(/agosto.*2026/i)).toBeInTheDocument();

    const prevButtons = screen.getAllByTitle("Mes anterior");
    fireEvent.click(prevButtons[0]);
    expect(screen.getByText(/julio.*2026/i)).toBeInTheDocument();
  });

  it("muestra contador de citas en los días con citas", () => {
    const appointments = [
      appointmentOn(10, "CONFIRMED", 1),
      appointmentOn(10, "PENDING", 2),
      appointmentOn(20, "COMPLETED", 3),
    ];

    const { container } = render(
      <ProfessionalCalendar appointments={appointments} />
    );

    // Los badges de contador tienen clase bg-indigo-600 con número
    const badges = container.querySelectorAll(
      ".bg-indigo-600.text-xs.font-bold"
    );
    const counts = Array.from(badges).map((b) => b.textContent);
    expect(counts).toContain("2");
    expect(counts).toContain("1");
  });

  it("muestra detalle de citas al hacer clic en un día", () => {
    const appointments = [appointmentOn(10, "CONFIRMED", 1)];

    render(<ProfessionalCalendar appointments={appointments} />);

    // Antes de clic, no hay detalle
    expect(screen.queryByText(/Citas del/)).not.toBeInTheDocument();

    // Hay 42 botones de día (grilla 6x7). Buscar el botón del día 10
    // que sea del mes actual.
    const dayCandidates = screen.getAllByText("10");
    const currentMonthDay10 = dayCandidates[dayCandidates.length - 1];
    fireEvent.click(currentMonthDay10.closest("button")!);

    expect(screen.getByText(/Citas del/)).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });
});
