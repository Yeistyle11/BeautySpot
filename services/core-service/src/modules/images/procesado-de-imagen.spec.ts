import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import { MAXIMO_BYTES_IMAGEN } from "@beautyspot/shared-constants";
import {
  formatoSegunContenido,
  LADO_MAXIMO,
  procesarImagen,
} from "./procesado-de-imagen";

/** Una foto de prueba como la que saldría de una cámara. */
function foto(
  ancho: number,
  alto: number,
  formato: "jpeg" | "png" | "webp" = "jpeg"
): Promise<Buffer> {
  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 124, g: 58, b: 237 },
    },
  })
    .toFormat(formato)
    .toBuffer();
}

describe("formatoSegunContenido", () => {
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", async () => {
    expect(formatoSegunContenido(await foto(10, 10, "jpeg"))).toBe("jpeg");
    expect(formatoSegunContenido(await foto(10, 10, "png"))).toBe("png");
    expect(formatoSegunContenido(await foto(10, 10, "webp"))).toBe("webp");
  });

  it("no se fía de lo que no es una imagen permitida", () => {
    expect(formatoSegunContenido(Buffer.from("<html>hola</html>"))).toBeNull();
    expect(formatoSegunContenido(Buffer.from("GIF89a......"))).toBeNull();
    expect(formatoSegunContenido(Buffer.alloc(4))).toBeNull();
  });
});

describe("procesarImagen", () => {
  it("reduce la foto al tamaño de su propósito y la deja en WebP", async () => {
    const resultado = await procesarImagen(await foto(4000, 2000), "galeria");

    expect(resultado.ancho).toBe(LADO_MAXIMO.galeria);
    expect(resultado.alto).toBe(LADO_MAXIMO.galeria / 2);
    expect(formatoSegunContenido(resultado.datos)).toBe("webp");
  });

  it("no agranda una imagen pequeña", async () => {
    const resultado = await procesarImagen(await foto(300, 200, "png"), "logo");

    expect([resultado.ancho, resultado.alto]).toEqual([300, 200]);
  });

  it("gira la foto según la cámara y le quita los metadatos", async () => {
    // Orientación 6: la cámara la guardó tumbada y pide girarla 90°.
    const tumbada = await sharp(await foto(800, 400))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const resultado = await procesarImagen(tumbada, "historia");
    const metadatos = await sharp(resultado.datos).metadata();

    expect([resultado.ancho, resultado.alto]).toEqual([400, 800]);
    expect(metadatos.exif).toBeUndefined();
    expect(metadatos.orientation).toBeUndefined();
  });

  it("rechaza lo que no es una imagen aunque diga serlo", async () => {
    await expect(
      procesarImagen(Buffer.from("<svg onload='x'></svg>   "), "logo")
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza una imagen dañada", async () => {
    const entera = await foto(200, 200);
    const rota = Buffer.concat([entera.subarray(0, 40), Buffer.alloc(200)]);

    await expect(procesarImagen(rota, "logo")).rejects.toThrow(
      "No se pudo leer la imagen"
    );
  });

  it("rechaza un archivo que pasa del máximo", async () => {
    const enorme = Buffer.concat([
      await foto(10, 10),
      Buffer.alloc(MAXIMO_BYTES_IMAGEN),
    ]);

    await expect(procesarImagen(enorme, "logo")).rejects.toThrow("5 MB");
  });
});
