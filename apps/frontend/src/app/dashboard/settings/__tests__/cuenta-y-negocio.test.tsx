import { render, screen } from "@testing-library/react";
import { useAuthStore, type Role } from "@/lib/store";
import { AccountTab } from "../account-tab";
import { BusinessTab } from "../business-tab";

const pintarCuenta = () =>
  render(
    <AccountTab
      email="ana@example.com"
      account={{ name: "Ana", phone: "3001234567" }}
      onAccountChange={jest.fn()}
      onSaveAccount={jest.fn()}
      savingAccount={false}
    />
  );

describe("AccountTab", () => {
  it.each<Role>(["OWNER", "ADMIN", "PROFESSIONAL", "SUPER_ADMIN"])(
    "%s puede guardar sus propios datos y cambiar su contraseña",
    (role) => {
      useAuthStore.setState({ role });
      pintarCuenta();

      expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Guardar cambios/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Cambiar contraseña/ })
      ).toBeInTheDocument();
    }
  );
});

describe("BusinessTab", () => {
  it("el admin, que ve la pestaña, también puede guardarla", () => {
    useAuthStore.setState({ role: "ADMIN" });
    render(
      <BusinessTab
        form={{ name: "La Noche" }}
        onChange={jest.fn()}
        onSave={jest.fn()}
        saving={false}
        loading={false}
      />
    );

    expect(
      screen.getByRole("button", { name: /Guardar cambios/ })
    ).toBeInTheDocument();
  });
});
