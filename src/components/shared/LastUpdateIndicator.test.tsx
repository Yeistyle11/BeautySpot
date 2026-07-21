import { render, screen, act } from "@testing-library/react";
import LastUpdateIndicator from "@/components/shared/LastUpdateIndicator";

describe("LastUpdateIndicator", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-20T10:00:00Z"));
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('muestra "Actualizado Ahora" al montar', () => {
    render(<LastUpdateIndicator />);
    expect(screen.getByText(/Actualizado Ahora/)).toBeInTheDocument();
  });

  it("muestra 'hace X min' después de passar minutos", () => {
    render(<LastUpdateIndicator />);
    expect(screen.getByText(/Actualizado Ahora/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3 * 60 * 1000);
    });

    expect(screen.getByText(/Actualizado hace 3 min/)).toBeInTheDocument();
  });

  it("hace tick cada minuto (regresión bug setLastUpdate((p) => p) no-op)", () => {
    render(<LastUpdateIndicator />);
    // El bug anterior: setLastUpdate((prev) => prev) era no-op en React 18
    // y el texto nunca cambiaba de "Ahora". Con el fix, ahora cambia.
    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText(/hace 1 min/)).toBeInTheDocument();
  });
});
