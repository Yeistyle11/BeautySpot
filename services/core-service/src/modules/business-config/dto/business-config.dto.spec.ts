import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { FidelizacionDto } from "./business-config.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = {
  type: "body" as const,
  metatype: FidelizacionDto,
};

describe("FidelizacionDto", () => {
  it("acepta una escala que arranca en cero y sube", async () => {
    await expect(
      pipe.transform(
        {
          niveles: [
            { min: 0, label: "Inicio", color: "verde" },
            { min: 100, label: "Habitual", color: "azul" },
          ],
        },
        metadata
      )
    ).resolves.toMatchObject({ niveles: [{ min: 0 }, { min: 100 }] });
  });

  it("rechaza que el primer nivel no arranque en cero", async () => {
    await expect(
      pipe.transform(
        { niveles: [{ min: 10, label: "Inicio", color: "verde" }] },
        metadata
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza los umbrales desordenados", async () => {
    await expect(
      pipe.transform(
        {
          niveles: [
            { min: 0, label: "Inicio", color: "verde" },
            { min: 300, label: "Fiel", color: "morado" },
            { min: 100, label: "Habitual", color: "azul" },
          ],
        },
        metadata
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza dos niveles con el mismo nombre", async () => {
    await expect(
      pipe.transform(
        {
          niveles: [
            { min: 0, label: "Inicio", color: "verde" },
            { min: 100, label: " inicio ", color: "azul" },
          ],
        },
        metadata
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza un color que no está en la paleta", async () => {
    await expect(
      pipe.transform(
        { niveles: [{ min: 0, label: "Inicio", color: "fucsia" }] },
        metadata
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("rechaza una escala vacía", async () => {
    await expect(pipe.transform({ niveles: [] }, metadata)).rejects.toThrow(
      BadRequestException
    );
  });
});
