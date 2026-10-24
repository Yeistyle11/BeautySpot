import { ConfigService } from "@nestjs/config";
import { aTextoPlano, PlantillasService } from "./plantillas.service";
import { EJEMPLOS_DE_CORREO, EJEMPLOS_MINIMOS } from "./ejemplos-de-correo";
import {
  conDuracion,
  diaCompleto,
  duracion,
  primerNombre,
} from "./ayudantes-de-plantilla";

/** Las plantillas de verdad, leídas de disco: sin mocks de fs. */
describe("Plantillas de correo", () => {
  const plantillas = new PlantillasService(
    new ConfigService({
      APP_URL: "https://appbeautyspot.com",
      EMAIL_ASSETS_URL: "https://appbeautyspot.com/correo",
    })
  );

  beforeAll(() => plantillas.onModuleInit());

  it("hay un ejemplo por cada plantilla", () => {
    expect(Object.keys(EJEMPLOS_DE_CORREO).sort()).toEqual(
      [...plantillas.disponibles].sort()
    );
  });

  describe.each(Object.keys(EJEMPLOS_DE_CORREO))("%s", (nombre) => {
    it("se pinta con todos sus datos sin dejar marcas ni huecos", () => {
      const html = plantillas.render(nombre, EJEMPLOS_DE_CORREO[nombre]);

      expect(html).toMatch(/^<!DOCTYPE html>/);
      expect(html).not.toContain("{{");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain('href=""');
      expect(html).toContain("https://appbeautyspot.com/correo/cabecera-");
    });

    // Lo mínimo es un invitado de un negocio sin dirección ni teléfono.
    it("aguanta los datos mínimos sin filas vacías", () => {
      const html = plantillas.render(nombre, EJEMPLOS_MINIMOS[nombre]);

      expect(html).not.toContain("undefined");
      expect(html).not.toContain('href=""');
      expect(html).not.toContain("Dónde</td>");
    });
  });

  it("un correo de cita lo firma el negocio y uno de cuenta, BeautySpot", () => {
    const cita = plantillas.render(
      "appointment-confirmed",
      EJEMPLOS_DE_CORREO["appointment-confirmed"]
    );
    const cuenta = plantillas.render(
      "password-reset",
      EJEMPLOS_DE_CORREO["password-reset"]
    );

    expect(cita).toContain("Reserva gestionada con BeautySpot");
    expect(cuenta).toContain("isotipo-blanco.png");
    expect(cuenta).not.toContain("Reserva gestionada");
  });

  it("la factura escribe los importes en pesos", () => {
    const html = plantillas.render(
      "invoice-generated",
      EJEMPLOS_DE_CORREO["invoice-generated"]
    );

    expect(html).toMatch(/\$\s?65\.450/);
    expect(html).toMatch(/\$\s?35\.000/);
  });

  it("al invitado no le ofrece enlaces a su cuenta", () => {
    const html = plantillas.render(
      "appointment-created",
      EJEMPLOS_MINIMOS["appointment-created"]
    );

    expect(html).not.toContain("Ver mi cita");
    expect(html).toContain("Si cambias de planes, avisa a Barbería La Noche.");
  });

  it("el año del pie es el actual", () => {
    const html = plantillas.render(
      "welcome-email",
      EJEMPLOS_DE_CORREO["welcome-email"]
    );

    expect(html).toContain(`© ${new Date().getFullYear()} BeautySpot`);
  });
});

describe("aTextoPlano", () => {
  it("quita la cabecera y los estilos y deja los enlaces con su dirección", () => {
    const texto = aTextoPlano(
      '<html><head><style>.a{color:red}</style></head><body><h1>Hola</h1><p>Entra <a href="https://x.co/y">aquí</a></p></body></html>'
    );

    expect(texto).toBe("Hola\nEntra aquí (https://x.co/y)");
  });

  it("deja el preheader fuera del texto", () => {
    const texto = aTextoPlano(
      '<body><div style="display: none; max-height: 0;">Oculto</div><p>Visible</p></body>'
    );

    expect(texto).toBe("Visible");
  });
});

describe("ayudantes de plantilla", () => {
  it("escriben la fecha larga sin coma y con mayúscula", () => {
    expect(diaCompleto("2026-10-25")).toBe("Domingo 25 de octubre");
  });

  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
  ])("escriben %i minutos como «%s»", (minutos, texto) => {
    expect(duracion(minutos)).toBe(texto);
  });

  it("solo añaden la duración al servicio si se sabe", () => {
    expect(conDuracion("Corte", 60)).toBe("Corte · 1 h");
    expect(conDuracion("Corte", undefined)).toBe("Corte");
  });

  it("saludan por el nombre de pila", () => {
    expect(primerNombre("  Camila Restrepo ")).toBe("Camila");
  });
});
