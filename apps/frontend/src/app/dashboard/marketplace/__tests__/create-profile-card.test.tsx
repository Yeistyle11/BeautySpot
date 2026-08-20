import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateProfileCard } from "../create-profile-card";

/** Monta el formulario vacío y devuelve el espía del alta. */
function pintar(inicial = {}) {
  const onCrear = jest.fn().mockResolvedValue(undefined);
  render(
    <CreateProfileCard
      inicial={inicial}
      onCrear={onCrear}
      onCancelar={jest.fn()}
    />
  );
  return onCrear;
}

const campoNombre = () => screen.getByLabelText(/nombre del negocio/i);
const campoEnlace = () => screen.getByLabelText(/enlace público/i);

describe("CreateProfileCard", () => {
  it("propone el enlace a partir del nombre", () => {
    pintar();

    fireEvent.change(campoNombre(), {
      target: { value: "Barbería La Noche" },
    });

    expect(campoEnlace()).toHaveValue("barberia-la-noche");
    expect(
      screen.getByText(/marketplace\/business\/barberia-la-noche/)
    ).toBeInTheDocument();
  });

  // Un enlace que el dueño ya escribió puede estar repartido: dejar de
  // proponerlo es lo que evita pisárselo al seguir tecleando el nombre.
  it("deja de proponerlo en cuanto lo escribe a mano", () => {
    pintar();

    fireEvent.change(campoNombre(), { target: { value: "Barbería" } });
    fireEvent.change(campoEnlace(), { target: { value: "la-noche" } });
    fireEvent.change(campoNombre(), { target: { value: "Barbería La Noche" } });

    expect(campoEnlace()).toHaveValue("la-noche");
  });

  it("da de alta con el enlace propuesto si no se toca", async () => {
    const onCrear = pintar();

    fireEvent.change(campoNombre(), { target: { value: "Salón Aurora" } });
    fireEvent.click(screen.getByRole("button", { name: /crear perfil/i }));

    await waitFor(() =>
      expect(onCrear).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Salón Aurora",
          slug: "salon-aurora",
          businessType: "BARBERIA",
        })
      )
    );
  });

  it("arranca con los datos que ya tiene el negocio", () => {
    pintar({ name: "Spa Zen", city: "Medellín", businessType: "SPA" });

    expect(campoNombre()).toHaveValue("Spa Zen");
    expect(screen.getByLabelText(/ciudad/i)).toHaveValue("Medellín");
    expect(screen.getByLabelText(/tipo de negocio/i)).toHaveValue("SPA");
  });
});
