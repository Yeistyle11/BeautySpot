import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { MAX_PAGE } from "@beautyspot/shared-utils";
import { CreateReviewDto, ReviewQueryDto } from "./review.dto";

// La reseña son estrellas y comentario: el almacén de imágenes es solo de los
// negocios.
describe("CreateReviewDto: sin fotos", () => {
  it("no admite fotos", async () => {
    const dto = plainToInstance(CreateReviewDto, {
      businessId: "business-123",
      appointmentId: "4a5f0e1c-4d3b-4f7a-9c2e-8f1b6d0a2c34",
      rating: 5,
      photos: ["https://cdn.example/foto.jpg"],
    });

    const errores = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errores.map((e) => e.property)).toEqual(["photos"]);
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
