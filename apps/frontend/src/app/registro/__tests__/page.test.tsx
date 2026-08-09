import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RegistroPage from "../page";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

function respuesta(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  } as unknown as Response;
}

function rellenarAlta(password: string) {
  render(<RegistroPage />);

  fireEvent.change(screen.getByLabelText("Nombre completo"), {
    target: { value: "Yeison" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "nuevo@ejemplo.co" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Repetir contraseña"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

describe("RegistroPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => jest.clearAllMocks());
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("pide revisar el correo en vez de entrar al panel", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respuesta(201, {
        success: true,
        data: {
          user: { id: "1", email: "nuevo@ejemplo.co", name: "Yeison" },
          message: "Te enviamos un correo para confirmar tu cuenta",
        },
      })
    );

    rellenarAlta("ClaveSegura9");

    await screen.findByText(/Enviamos un enlace de confirmación/);
    expect(push).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña sin variedad antes de llamar al backend", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    rellenarAlta("todominusculas");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/mayúsculas/)
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
