import { fireEvent, render, screen } from "@testing-library/react";
import { useAuthStore } from "@/lib/store";
import { BillingTab } from "../billing-tab";
import { BookingRulesTab } from "../booking-rules-tab";

// Las pestanas leen el rol del store para decidir si dejan editar.
beforeEach(() => {
  useAuthStore.setState({ role: "OWNER" });
});

describe("BillingTab", () => {
  it("pinta los datos fiscales guardados", () => {
    render(
      <BillingTab
        facturacion={{ razonSocial: "La Noche S.A.S.", nit: "900.123.456-7" }}
        onChange={jest.fn()}
        onSave={jest.fn()}
        saving={false}
      />
    );

    expect(screen.getByDisplayValue("La Noche S.A.S.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("900.123.456-7")).toBeInTheDocument();
  });

  it("guarda lo que se teclea", () => {
    const onChange = jest.fn();
    const onSave = jest.fn();
    render(
      <BillingTab
        facturacion={{}}
        onChange={onChange}
        onSave={onSave}
        saving={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/NIT/), {
      target: { value: "800.999.111-2" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nit: "800.999.111-2" })
    );

    fireEvent.click(screen.getByRole("button", { name: /Guardar datos/ }));
    expect(onSave).toHaveBeenCalled();
  });

  it("a quien no puede editar le deja mirar, no escribir", () => {
    useAuthStore.setState({ role: "RECEPTIONIST" });
    render(
      <BillingTab
        facturacion={{ nit: "900.123.456-7" }}
        onChange={jest.fn()}
        onSave={jest.fn()}
        saving={false}
      />
    );

    expect(screen.getByLabelText(/NIT/)).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Guardar datos/ })
    ).not.toBeInTheDocument();
  });
});

describe("BookingRulesTab", () => {
  it("pinta la antelación guardada", () => {
    render(
      <BookingRulesTab
        reservas={{ horasMinimasCancelacion: 24 }}
        onChange={jest.fn()}
        onSave={jest.fn()}
        saving={false}
      />
    );

    expect(screen.getByDisplayValue("24")).toBeInTheDocument();
  });

  it("no admite antelaciones negativas", () => {
    const onChange = jest.fn();
    render(
      <BookingRulesTab
        reservas={{ horasMinimasCancelacion: 2 }}
        onChange={onChange}
        onSave={jest.fn()}
        saving={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/Antelación mínima/), {
      target: { value: "-5" },
    });

    expect(onChange).toHaveBeenCalledWith({ horasMinimasCancelacion: 0 });
  });
});
