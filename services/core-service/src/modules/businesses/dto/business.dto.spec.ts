import { ValidationPipe } from "@nestjs/common";
import { UpdateBusinessDto } from "./business.dto";

// Mismo pipe que monta createMicroserviceApp: rechaza las propiedades que el
// DTO no declara.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = {
  type: "body" as const,
  metatype: UpdateBusinessDto,
};

/** Lo que envía la pestaña de negocio de configuración. */
const formularioDeConfiguracion = {
  name: "Salón Aurora",
  description: "Barbería y salón de belleza en el centro de Medellín.",
  phone: "+573001112233",
  email: "hola@salonaurora.co",
  website: "https://salonaurora.co",
  address: "Calle 10 #43-25",
  city: "Medellín",
  state: "Antioquia",
  country: "CO",
  logo: "https://salonaurora.co/logo.png",
  coverImage: "https://salonaurora.co/portada.jpg",
};

describe("UpdateBusinessDto", () => {
  it("acepta el formulario completo de configuración", async () => {
    await expect(
      pipe.transform(formularioDeConfiguracion, metadata)
    ).resolves.toMatchObject(formularioDeConfiguracion);
  });

  it("acepta logo y coverImage vacíos", async () => {
    await expect(
      pipe.transform({ logo: null, coverImage: null }, metadata)
    ).resolves.toMatchObject({ logo: null, coverImage: null });
  });

  it("rechaza una propiedad que el negocio no tiene", async () => {
    await expect(
      pipe.transform({ inventado: "x" }, metadata)
    ).rejects.toThrow();
  });
});
