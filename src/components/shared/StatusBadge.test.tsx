import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/shared/StatusBadge";

describe("StatusBadge", () => {
  it("renderiza el texto traducido para PENDING", () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("renderiza el texto traducido para COMPLETED", () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("aplica la clase de color de PENDING", () => {
    const { container } = render(<StatusBadge status="PENDING" />);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-yellow-100");
    expect(span?.className).toContain("text-yellow-800");
  });

  it("aplica className personalizada", () => {
    const { container } = render(
      <StatusBadge status="CONFIRMED" className="px-4 py-2" />
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("px-4");
    expect(span?.className).toContain("py-2");
  });

  it("retorna el status original para estados desconocidos", () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
  });
});
