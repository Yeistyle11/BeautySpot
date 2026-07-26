import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../page";

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

function enviarCredenciales(password: string) {
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@ejemplo.co" },
  });
  fireEvent.change(screen.getByLabelText("Contrasena"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesion" }));
}

describe("LoginPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("no renueva la sesion cuando la contraseña es incorrecta", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        respuesta(401, { error: { message: "Credenciales inválidas" } })
      );
    global.fetch = fetchMock;

    enviarCredenciales("contraseña-incorrecta");

    await screen.findByText("Credenciales inválidas");

    const rutas = fetchMock.mock.calls.map(([url]) => String(url));
    expect(rutas).toHaveLength(1);
    expect(rutas[0]).toContain("/auth/login");
    expect(rutas.some((r) => r.includes("/auth/refresh"))).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("entra al panel cuando las credenciales son validas", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respuesta(200, {
        success: true,
        data: {
          user: { id: "1", email: "owner@ejemplo.co", name: "Yeison" },
          session: { role: "OWNER", businessId: "negocio-1" },
        },
      })
    );

    enviarCredenciales("Correcta123!");

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });
});
