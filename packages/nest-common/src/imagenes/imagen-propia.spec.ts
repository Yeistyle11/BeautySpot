import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  asegurarImagenPropia,
  claveDeImagenPropia,
  esImagenPropia,
  imagenesQueSobran,
} from "./imagen-propia";

const NEGOCIO = "632f8391-d9ba-4d76-bc2c-1d20dae78ff6";
const OTRO = "0878891c-9bf9-4d28-8d28-ba5cdb3b6f69";
const ARCHIVO = "3f1c2b9a-7d4e-4a1b-9c3d-2e5f6a7b8c9d.webp";
const LOGO = `/media/negocios/${NEGOCIO}/logo/${ARCHIVO}`;
const AJENA = `/media/negocios/${OTRO}/logo/${ARCHIVO}`;

describe("claveDeImagenPropia", () => {
  it("separa la clave del almacén y el negocio", () => {
    expect(claveDeImagenPropia(LOGO)).toEqual({
      clave: `negocios/${NEGOCIO}/logo/${ARCHIVO}`,
      businessId: NEGOCIO,
    });
  });

  it.each([
    ["una URL externa", "https://images.unsplash.com/foto.jpg"],
    [
      "un propósito que no existe",
      `/media/negocios/${NEGOCIO}/otro/${ARCHIVO}`,
    ],
    ["otra extensión", LOGO.replace(".webp", ".svg")],
    ["una ruta que sube de nivel", `/media/negocios/${NEGOCIO}/../${ARCHIVO}`],
    ["la URL absoluta de la propia app", `https://app.com${LOGO}`],
  ])("no reconoce %s", (_caso, url) => {
    expect(claveDeImagenPropia(url)).toBeNull();
  });
});

describe("esImagenPropia", () => {
  it("solo es propia la que cuelga del negocio", () => {
    expect(esImagenPropia(LOGO, NEGOCIO)).toBe(true);
    expect(esImagenPropia(LOGO, OTRO)).toBe(false);
  });
});

describe("asegurarImagenPropia", () => {
  it("acepta quitar la imagen y subir una del negocio", () => {
    expect(() => asegurarImagenPropia(null, LOGO, NEGOCIO)).not.toThrow();
    expect(() => asegurarImagenPropia(LOGO, null, NEGOCIO)).not.toThrow();
  });

  it("deja pasar la URL externa que ya estaba guardada", () => {
    const vieja = "https://images.unsplash.com/logo.jpg";
    expect(() => asegurarImagenPropia(vieja, vieja, NEGOCIO)).not.toThrow();
    expect(() =>
      asegurarImagenPropia(vieja, [LOGO, vieja], NEGOCIO)
    ).not.toThrow();
  });

  it("rechaza una URL externa nueva", () => {
    expect(() =>
      asegurarImagenPropia("https://evil.example/x.png", LOGO, NEGOCIO)
    ).toThrow(BadRequestException);
  });

  it("rechaza la imagen de otro negocio", () => {
    expect(() => asegurarImagenPropia(AJENA, null, NEGOCIO)).toThrow(
      ForbiddenException
    );
  });
});

describe("imagenesQueSobran", () => {
  it("devuelve las propias que ya no se usan, una vez cada una", () => {
    const otra = LOGO.replace("logo", "portada");
    expect(imagenesQueSobran([LOGO, otra, LOGO, null], [otra])).toEqual([LOGO]);
  });

  it("no toca las URLs externas", () => {
    expect(imagenesQueSobran(["https://cdn.x/y.jpg"], [])).toEqual([]);
  });
});
