import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CampoDeImagen } from "../ui/campo-de-imagen";
import { ErrorDeImagen, subirImagen } from "@/lib/imagenes";

jest.mock("@/lib/imagenes", () => ({
  ...jest.requireActual("@/lib/imagenes"),
  subirImagen: jest.fn(),
}));

const LOGO = "/media/negocios/n/logo/a.webp";

/** Elige un archivo en el control, como lo haría el selector del sistema. */
function elegir(archivo: File) {
  fireEvent.change(screen.getByLabelText("Logo"), {
    target: { files: [archivo] },
  });
}

describe("CampoDeImagen", () => {
  const foto = new File(["x"], "logo.png", { type: "image/png" });

  beforeEach(() => jest.clearAllMocks());

  it("sube la imagen elegida y entrega su URL al formulario", async () => {
    (subirImagen as jest.Mock).mockResolvedValue({ url: LOGO });
    const alCambiar = jest.fn();
    render(
      <CampoDeImagen
        etiqueta="Logo"
        proposito="logo"
        valor={null}
        alCambiar={alCambiar}
      />
    );

    elegir(foto);

    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(LOGO));
    expect(subirImagen).toHaveBeenCalledWith(foto, "logo");
  });

  it("explica por qué no se pudo subir", async () => {
    (subirImagen as jest.Mock).mockRejectedValue(
      new ErrorDeImagen("La imagen pesa demasiado, prueba con otra")
    );
    const alCambiar = jest.fn();
    render(
      <CampoDeImagen
        etiqueta="Logo"
        proposito="logo"
        valor={null}
        alCambiar={alCambiar}
      />
    );

    elegir(foto);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "pesa demasiado"
    );
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("enseña la imagen guardada y deja quitarla", () => {
    const alCambiar = jest.fn();
    render(
      <CampoDeImagen
        etiqueta="Logo"
        proposito="logo"
        valor={LOGO}
        alCambiar={alCambiar}
      />
    );

    expect(screen.getByAltText("Logo actual")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /quitar/i }));

    expect(alCambiar).toHaveBeenCalledWith(null);
  });

  it("acepta la imagen que se suelta encima", async () => {
    (subirImagen as jest.Mock).mockResolvedValue({ url: LOGO });
    const alCambiar = jest.fn();
    render(
      <CampoDeImagen
        etiqueta="Logo"
        proposito="logo"
        valor={null}
        alCambiar={alCambiar}
      />
    );

    fireEvent.drop(screen.getByText(/arrástrala aquí/), {
      dataTransfer: { files: [foto] },
    });

    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith(LOGO));
  });
});
