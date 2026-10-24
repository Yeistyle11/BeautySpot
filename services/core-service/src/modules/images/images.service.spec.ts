import { BadRequestException, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { AlmacenDeImagenes } from "./almacen-de-imagenes";
import { ImagesService } from "./images.service";

const NEGOCIO = "632f8391-d9ba-4d76-bc2c-1d20dae78ff6";
const OTRO = "0878891c-9bf9-4d28-8d28-ba5cdb3b6f69";
const ARCHIVO = "3f1c2b9a-7d4e-4a1b-9c3d-2e5f6a7b8c9d.webp";
const LOGO = `/media/negocios/${NEGOCIO}/logo/${ARCHIVO}`;

describe("ImagesService", () => {
  const almacen = {
    guardar: jest.fn().mockResolvedValue(undefined),
    leer: jest.fn(),
    borrar: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ImagesService(almacen as unknown as AlmacenDeImagenes);
  jest.spyOn(service["logger"], "warn").mockImplementation(() => undefined);

  describe("subir", () => {
    it("guarda la imagen procesada bajo el negocio y devuelve su URL", async () => {
      const png = await sharp({
        create: { width: 64, height: 32, channels: 4, background: "#7C3AED" },
      })
        .png()
        .toBuffer();

      const subida = await service.subir(png, "logo", NEGOCIO);

      expect(subida.url).toMatch(
        new RegExp(`^/media/negocios/${NEGOCIO}/logo/[0-9a-f-]{36}\\.webp$`)
      );
      expect([subida.ancho, subida.alto]).toEqual([64, 32]);
      expect(almacen.guardar).toHaveBeenCalledWith(
        subida.url.replace("/media/", ""),
        expect.any(Buffer)
      );
    });

    it("pide el archivo y el negocio", async () => {
      await expect(service.subir(undefined, "logo", NEGOCIO)).rejects.toThrow(
        BadRequestException
      );
      await expect(
        service.subir(Buffer.from("x"), "logo", undefined)
      ).rejects.toThrow("negocio");
      expect(almacen.guardar).not.toHaveBeenCalled();
    });
  });

  describe("leer", () => {
    it("da el archivo de una imagen propia", async () => {
      almacen.leer.mockResolvedValue(Buffer.from("webp"));

      await expect(service.leer(LOGO)).resolves.toEqual(Buffer.from("webp"));
      expect(almacen.leer).toHaveBeenCalledWith(LOGO.replace("/media/", ""));
    });

    it("responde 404 si no existe o la ruta no es de las nuestras", async () => {
      almacen.leer.mockResolvedValue(null);
      await expect(service.leer(LOGO)).rejects.toThrow(NotFoundException);

      await expect(service.leer("/media/../../etc/passwd")).rejects.toThrow(
        NotFoundException
      );
      expect(almacen.leer).toHaveBeenCalledTimes(1);
    });
  });

  describe("descartar", () => {
    it("borra solo las imágenes del negocio", async () => {
      await service.descartar(
        [
          LOGO,
          `/media/negocios/${OTRO}/logo/${ARCHIVO}`,
          "https://cdn.example/x.jpg",
        ],
        NEGOCIO
      );

      expect(almacen.borrar).toHaveBeenCalledTimes(1);
      expect(almacen.borrar).toHaveBeenCalledWith(LOGO.replace("/media/", ""));
    });

    it("un fallo al borrar no se propaga", async () => {
      almacen.borrar.mockRejectedValueOnce(new Error("disco lleno"));

      await expect(service.descartar([LOGO], NEGOCIO)).resolves.toBeUndefined();
    });
  });
});
