import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { MAX_PAGE } from "@beautyspot/shared-utils";
import { CreateReviewDto, MAXIMO_FOTOS, ReviewQueryDto } from "./review.dto";

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

/** Errores del campo `page` del filtro de listado con ese valor. */
async function erroresDePagina(page: unknown): Promise<string[]> {
  const dto = plainToInstance(ReviewQueryDto, { page });
  const errores = await validate(dto);
  const pagina = errores.find((e) => e.property === "page");
  return Object.values(pagina?.constraints ?? {});
}

// El listado por negocio es público y sin token: sin tope, una página enorme
// se traduce en un OFFSET que Postgres recorre y descarta entero.
describe("ReviewQueryDto: tope de página", () => {
  it("acepta la última página permitida", async () => {
    expect(await erroresDePagina(MAX_PAGE)).toEqual([]);
  });

  it("rechaza pasarse del tope", async () => {
    expect(await erroresDePagina(MAX_PAGE + 1)).not.toEqual([]);
  });

  it("rechaza una página desmesurada", async () => {
    expect(await erroresDePagina(100_000_000)).not.toEqual([]);
  });
});
