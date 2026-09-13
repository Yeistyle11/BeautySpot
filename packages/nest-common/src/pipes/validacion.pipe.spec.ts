import { BadRequestException } from "@nestjs/common";
import { IsArray, IsNumber, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { crearValidationPipe } from "./validacion.pipe";

class LineaDto {
  @IsNumber()
  price!: number;
}

class CuerpoDto {
  @IsUUID()
  businessId!: string;

  @IsArray()
  @IsUUID("4", { each: true })
  serviceIds!: string[];

  @ValidateNested({ each: true })
  @Type(() => LineaDto)
  items!: LineaDto[];
}

/** Detalles de validación que el pipe devuelve para un cuerpo dado. */
async function detalles(cuerpo: unknown): Promise<string[]> {
  try {
    await crearValidationPipe().transform(cuerpo, {
      type: "body",
      metatype: CuerpoDto,
    });
    return [];
  } catch (error) {
    const cuerpoDelError = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    return cuerpoDelError.message;
  }
}

describe("crearValidationPipe", () => {
  it("traduce los mensajes que el validador emite en inglés", async () => {
    const mensajes = await detalles({
      businessId: "no-es-uuid",
      serviceIds: [],
      items: [],
    });
    expect(mensajes).toContain("Revisa el negocio: el formato no es válido");
  });

  it("no repite dos reglas que se cuentan igual", async () => {
    const mensajes = await detalles({
      businessId: "no-es-uuid",
      serviceIds: "x",
      items: [],
    });
    expect(
      mensajes.filter(
        (m) => m === "Revisa los servicios: el formato no es válido"
      )
    ).toHaveLength(1);
  });

  it("recorre los errores de los objetos anidados", async () => {
    const mensajes = await detalles({
      businessId: "5a2c9f1e-0b3d-4c8a-9f6e-1d2b3c4d5e6f",
      serviceIds: [],
      items: [{ price: "gratis" }],
    });
    expect(mensajes).toContain("Revisa el precio: el formato no es válido");
  });

  it("rechaza los campos que el DTO no declara", async () => {
    const mensajes = await detalles({
      businessId: "5a2c9f1e-0b3d-4c8a-9f6e-1d2b3c4d5e6f",
      serviceIds: [],
      items: [],
      colado: true,
    });
    expect(mensajes.join(" ")).toContain("should not exist");
  });
});
