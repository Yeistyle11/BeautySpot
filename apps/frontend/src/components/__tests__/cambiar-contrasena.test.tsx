import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "@/lib/api";
import { CambiarContrasena } from "../cambiar-contrasena";

jest.mock("@/lib/api", () => ({ api: { post: jest.fn() } }));

const post = api.post as jest.Mock;

const teclear = (etiqueta: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), {
    target: { value: valor },
  });

beforeEach(() => post.mockReset());

describe("CambiarContrasena", () => {
  it("si la confirmación no coincide avisa y no llama a la API", () => {
    render(<CambiarContrasena />);
    teclear("Contraseña actual", "Vieja2026!");
    teclear("Nueva contraseña", "Nueva2026!");
    teclear("Confirmar contraseña", "Otra2026!");

    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/ }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Las contraseñas no coinciden"
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("cambia la contraseña y vacía el formulario", async () => {
    post.mockResolvedValue({});
    render(<CambiarContrasena />);
    teclear("Contraseña actual", "Vieja2026!");
    teclear("Nueva contraseña", "Nueva2026!");
    teclear("Confirmar contraseña", "Nueva2026!");

    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/ }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Contraseña actualizada"
    );
    expect(post).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "Vieja2026!",
      newPassword: "Nueva2026!",
    });
    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("");
  });

  it("si la API la rechaza lo dice y conserva lo tecleado", async () => {
    post.mockRejectedValue(new Error("La contraseña actual no es correcta"));
    render(<CambiarContrasena />);
    teclear("Contraseña actual", "Mala2026!");
    teclear("Nueva contraseña", "Nueva2026!");
    teclear("Confirmar contraseña", "Nueva2026!");

    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/ }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveClass("text-destructive")
    );
    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("Mala2026!");
  });
});
