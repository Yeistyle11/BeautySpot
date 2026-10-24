import { MAXIMO_BYTES_IMAGEN } from "@beautyspot/shared-constants";
import { api } from "../api";
import {
  ErrorDeImagen,
  LADO_MAXIMO_ENVIO,
  medidasDeEnvio,
  prepararImagen,
  subirImagen,
} from "../imagenes";

jest.mock("../api", () => ({ api: { upload: jest.fn() } }));

/** Un archivo del tipo y tamaño pedidos. */
function archivo(tipo: string, bytes = 1000, nombre = "foto.jpg"): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

/** Simula el lienzo del navegador, que jsdom no tiene. */
function conLienzo(blob: Blob | null, medidas = { width: 4000, height: 3000 }) {
  const drawImage = jest.fn();
  const close = jest.fn();
  global.createImageBitmap = jest
    .fn()
    .mockResolvedValue({ ...medidas, close }) as never;
  jest.spyOn(document, "createElement").mockImplementation(
    () =>
      ({
        getContext: () => ({ drawImage }),
        toBlob: (resolver: (b: Blob | null) => void) => resolver(blob),
      }) as never
  );
  return { drawImage, close };
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (global as { createImageBitmap?: unknown }).createImageBitmap;
});

describe("medidasDeEnvio", () => {
  it("reduce al lado máximo conservando la proporción", () => {
    expect(medidasDeEnvio(4000, 3000)).toEqual({
      ancho: LADO_MAXIMO_ENVIO,
      alto: 1920,
    });
    expect(medidasDeEnvio(1000, 4000, 2000)).toEqual({
      ancho: 500,
      alto: 2000,
    });
  });

  it("no agranda una imagen pequeña", () => {
    expect(medidasDeEnvio(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });
});

describe("prepararImagen", () => {
  it("manda tal cual una imagen ligera de un formato aceptado", async () => {
    const foto = archivo("image/png");

    await expect(prepararImagen(foto)).resolves.toBe(foto);
  });

  it("rechaza lo que no es una imagen", async () => {
    await expect(prepararImagen(archivo("application/pdf"))).rejects.toThrow(
      "no es una imagen"
    );
  });

  it("reduce en el navegador la foto que pesa demasiado", async () => {
    const reducida = new Blob(["jpg"], { type: "image/jpeg" });
    const { drawImage, close } = conLienzo(reducida);

    await expect(
      prepararImagen(archivo("image/jpeg", MAXIMO_BYTES_IMAGEN + 1))
    ).resolves.toBe(reducida);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      LADO_MAXIMO_ENVIO,
      1920
    );
    expect(close).toHaveBeenCalled();
  });

  it("convierte una foto HEIC que el navegador sabe leer", async () => {
    const reducida = new Blob(["jpg"], { type: "image/jpeg" });
    conLienzo(reducida, { width: 1200, height: 900 });

    await expect(prepararImagen(archivo("image/heic"))).resolves.toBe(reducida);
  });

  it("explica que no pudo leerla si el navegador no la entiende", async () => {
    global.createImageBitmap = jest
      .fn()
      .mockRejectedValue(new Error("x")) as never;

    await expect(prepararImagen(archivo("image/heic"))).rejects.toThrow(
      ErrorDeImagen
    );
  });

  it("avisa si el navegador no sabe preparar imágenes", async () => {
    await expect(prepararImagen(archivo("image/heic"))).rejects.toThrow(
      "no puede preparar"
    );
  });

  it("avisa si el lienzo no da imagen", async () => {
    conLienzo(null);

    await expect(prepararImagen(archivo("image/heic"))).rejects.toThrow(
      "no puede preparar"
    );
  });

  it("rechaza la que sigue pesando demasiado después de reducirla", async () => {
    conLienzo(new Blob([new Uint8Array(MAXIMO_BYTES_IMAGEN + 1)]));

    await expect(prepararImagen(archivo("image/heic"))).rejects.toThrow(
      "pesa demasiado"
    );
  });
});

describe("subirImagen", () => {
  it("sube la imagen con su propósito y devuelve la URL", async () => {
    (api.upload as jest.Mock).mockResolvedValue({
      url: "/media/x.webp",
      ancho: 10,
      alto: 10,
    });
    const foto = archivo("image/png", 100, "logo.png");

    await expect(subirImagen(foto, "logo")).resolves.toMatchObject({
      url: "/media/x.webp",
    });

    const [ruta, formulario] = (api.upload as jest.Mock).mock.calls[0];
    expect(ruta).toBe("/core/images");
    expect(formulario.get("proposito")).toBe("logo");
    expect((formulario.get("archivo") as File).name).toBe("logo.png");
  });

  it("nombra .jpg lo que se reencodó en el navegador", async () => {
    (api.upload as jest.Mock).mockResolvedValue({ url: "/media/y.webp" });
    conLienzo(new Blob(["jpg"], { type: "image/jpeg" }));

    await subirImagen(archivo("image/heic", 100, "IMG_0001.HEIC"), "galeria");

    const formulario = (api.upload as jest.Mock).mock.calls.at(-1)[1];
    expect((formulario.get("archivo") as File).name).toBe("IMG_0001.jpg");
  });
});
