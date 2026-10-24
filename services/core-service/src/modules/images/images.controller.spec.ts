import { NotFoundException } from "@nestjs/common";
import {
  ImagesController,
  InternalImagesController,
  PublicImagesController,
} from "./images.controller";
import { ImagesService } from "./images.service";

const NEGOCIO = "632f8391-d9ba-4d76-bc2c-1d20dae78ff6";
const ARCHIVO = "3f1c2b9a-7d4e-4a1b-9c3d-2e5f6a7b8c9d.webp";

describe("controladores de imágenes", () => {
  const images = {
    subir: jest.fn(),
    leer: jest.fn(),
    descartar: jest.fn(),
  } as unknown as jest.Mocked<ImagesService>;

  /** Respuesta de Express mínima que recoge lo que se le manda. */
  function respuesta() {
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(),
      end: jest.fn(),
      send: jest.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  }

  beforeEach(() => jest.clearAllMocks());

  it("sube el archivo para el negocio de la sesión", async () => {
    const archivo = { buffer: Buffer.from("x") } as Express.Multer.File;

    await new ImagesController(images).subir(
      NEGOCIO,
      { proposito: "portada" },
      archivo
    );

    expect(images.subir).toHaveBeenCalledWith(
      archivo.buffer,
      "portada",
      NEGOCIO
    );
  });

  describe("lectura pública", () => {
    const controller = new PublicImagesController(images);

    it("sirve la imagen con caché inmutable y sin dejar adivinar el tipo", async () => {
      images.leer.mockResolvedValue(Buffer.from("webp"));
      const res = respuesta();

      await controller.leer(NEGOCIO, "logo", ARCHIVO, undefined, res as never);

      expect(images.leer).toHaveBeenCalledWith(
        `/media/negocios/${NEGOCIO}/logo/${ARCHIVO}`
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "public, max-age=31536000, immutable"
      );
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/webp");
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff"
      );
      expect(res.send).toHaveBeenCalledWith(Buffer.from("webp"));
    });

    it("responde 304 al navegador que ya la tiene", async () => {
      const res = respuesta();

      await controller.leer(
        NEGOCIO,
        "logo",
        ARCHIVO,
        `"${ARCHIVO}"`,
        res as never
      );

      expect(res.status).toHaveBeenCalledWith(304);
      expect(images.leer).not.toHaveBeenCalled();
    });

    it("deja pasar el 404 de una imagen que no existe", async () => {
      images.leer.mockRejectedValue(new NotFoundException());

      await expect(
        controller.leer(
          NEGOCIO,
          "logo",
          ARCHIVO,
          undefined,
          respuesta() as never
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  it("descarta a petición de otro servicio", async () => {
    await new InternalImagesController(images).descartar({
      businessId: NEGOCIO,
      urls: ["/media/x"],
    });

    expect(images.descartar).toHaveBeenCalledWith(["/media/x"], NEGOCIO);
  });
});
