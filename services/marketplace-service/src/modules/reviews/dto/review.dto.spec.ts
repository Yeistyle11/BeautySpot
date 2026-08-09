import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateReviewDto, MAXIMO_FOTOS } from "./review.dto";

const FOTO = "https://cdn.beautyspot.co/reviews/";

/** Errores del campo `photos` del DTO montado con esas fotos. */
async function erroresDeFotos(photos: string[]): Promise<string[]> {
  const dto = plainToInstance(CreateReviewDto, {
    businessId: "business-123",
    appointmentId: "4a5f0e1c-4d3b-4f7a-9c2e-8f1b6d0a2c34",
    rating: 5,
    photos,
  });
  const errores = await validate(dto);
  const fotos = errores.find((e) => e.property === "photos");
  return Object.values(fotos?.constraints ?? {});
}

describe("CreateReviewDto: fotos", () => {
  it("acepta el máximo de fotos", async () => {
    const fotos = Array.from(
      { length: MAXIMO_FOTOS },
      (_, i) => `${FOTO}${i}.jpg`
    );

    expect(await erroresDeFotos(fotos)).toEqual([]);
  });

  it("rechaza pasarse del máximo en vez de recortar en silencio", async () => {
    const fotos = Array.from(
      { length: MAXIMO_FOTOS + 1 },
      (_, i) => `${FOTO}${i}.jpg`
    );

    expect(await erroresDeFotos(fotos)).toEqual(
      expect.arrayContaining([expect.stringContaining("más de 3 fotos")])
    );
  });

  it("sigue exigiendo que cada foto sea una URL", async () => {
    expect(await erroresDeFotos(["no-es-una-url"])).not.toEqual([]);
  });
});
