import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = { type: "body" as const, metatype: CreateClientDto };

/** Ficha mínima con la que el mostrador da de alta a un cliente. */
const fichaDelMostrador = {
  name: "Carlos Pérez",
  phone: "+573001112233",
};

/** Mensajes con los que el pipe rechaza esa fecha de nacimiento. */
async function motivosDe(
  birthDate: string,
  metatype: unknown = CreateClientDto
): Promise<string> {
  try {
    await pipe.transform(
      { ...fichaDelMostrador, birthDate },
      { type: "body", metatype: metatype as never }
    );
    return "";
  } catch (error) {
    return JSON.stringify((error as BadRequestException).getResponse());
  }
}

describe("CreateClientDto", () => {
  it("acepta la ficha del mostrador", async () => {
    await expect(
      pipe.transform(fichaDelMostrador, metadata)
    ).resolves.toMatchObject({ name: "Carlos Pérez" });
  });

  it("acepta una fecha de nacimiento que existe", async () => {
    await expect(motivosDe("1990-02-28")).resolves.toBe("");
  });

  // Dias con la forma correcta que no existen en el calendario.
  it.each(["2026-02-30", "1990-04-31", "1990-13-01"])(
    "rechaza %s, que no existe en el calendario",
    async (fecha) => {
      expect(await motivosDe(fecha)).toContain("no existe en el calendario");
    }
  );

  it("sigue distinguiendo el formato mal escrito", async () => {
    const motivos = await motivosDe("13-08-1990");

    expect(motivos).toContain("formato AAAA-MM-DD");
    expect(motivos).not.toContain("no existe en el calendario");
  });

  it("aplica la misma regla al actualizar la ficha", async () => {
    expect(await motivosDe("2026-02-30", UpdateClientDto)).toContain(
      "no existe en el calendario"
    );
  });
});
