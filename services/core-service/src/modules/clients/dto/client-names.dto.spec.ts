import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ClientNamesDto } from "./client.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = { type: "query" as const, metatype: ClientNamesDto };

const UNO = "11111111-1111-4111-8111-111111111111";
const DOS = "22222222-2222-4222-8222-222222222222";

describe("ClientNamesDto", () => {
  it("parte la lista separada por comas", async () => {
    await expect(
      pipe.transform({ ids: `${UNO},${DOS}` }, metadata)
    ).resolves.toMatchObject({ ids: [UNO, DOS] });
  });

  it("tolera espacios y elementos vacíos", async () => {
    await expect(
      pipe.transform({ ids: ` ${UNO} , , ${DOS} ` }, metadata)
    ).resolves.toMatchObject({ ids: [UNO, DOS] });
  });

  it("acepta que no se pida ninguno", async () => {
    await expect(pipe.transform({ ids: "" }, metadata)).resolves.toMatchObject({
      ids: [],
    });
  });

  it("rechaza lo que no sea un UUID", async () => {
    await expect(
      pipe.transform({ ids: `${UNO},no-es-un-uuid` }, metadata)
    ).rejects.toThrow(BadRequestException);
  });

  // Sin tope, un `?ids=` largo arma un IN (...) de miles de elementos.
  it("corta en 200 identificadores", async () => {
    const muchos = Array.from({ length: 250 }, () => UNO).join(",");

    const resultado = (await pipe.transform(
      { ids: muchos },
      metadata
    )) as ClientNamesDto;

    expect(resultado.ids).toHaveLength(200);
  });
});
