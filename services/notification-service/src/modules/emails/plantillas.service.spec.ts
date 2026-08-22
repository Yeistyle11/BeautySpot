import { PlantillasService } from "./plantillas.service";

jest.mock("fs", () => ({
  promises: { readdir: jest.fn(), readFile: jest.fn() },
}));

describe("PlantillasService", () => {
  let service: PlantillasService;
  let fsPromises: { readdir: jest.Mock; readFile: jest.Mock };

  beforeEach(() => {
    fsPromises = require("fs").promises;
    fsPromises.readdir.mockReset();
    fsPromises.readFile.mockReset();
    fsPromises.readFile.mockResolvedValue("<p>Hola {{clientName}}</p>");
    service = new PlantillasService();
    jest.spyOn(service["logger"], "log").mockImplementation(() => undefined);
  });

  describe("al arrancar", () => {
    it("compila las plantillas de la carpeta", async () => {
      fsPromises.readdir.mockResolvedValue([
        "welcome-email.hbs",
        "invoice-generated.hbs",
        "leeme.md",
      ]);

      await service.onModuleInit();

      expect(service.disponibles).toEqual([
        "welcome-email",
        "invoice-generated",
      ]);
    });

    // El servicio arrancaba sano con la carpeta ausente y fallaba en cada
    // envío: el negocio se enteraba por los correos que nunca llegaron.
    it("no arranca si la carpeta de plantillas no está", async () => {
      fsPromises.readdir.mockRejectedValue(new Error("ENOENT"));

      await expect(service.onModuleInit()).rejects.toThrow(
        /No se pueden leer las plantillas/
      );
    });

    it("tampoco arranca si la carpeta está vacía", async () => {
      fsPromises.readdir.mockResolvedValue([]);

      await expect(service.onModuleInit()).rejects.toThrow(
        /No hay ninguna plantilla/
      );
    });
  });

  describe("render", () => {
    beforeEach(async () => {
      fsPromises.readdir.mockResolvedValue(["welcome-email.hbs"]);
      await service.onModuleInit();
    });

    it("sustituye el contexto en la plantilla", () => {
      expect(service.render("welcome-email", { clientName: "Ana" })).toBe(
        "<p>Hola Ana</p>"
      );
    });

    it("lanza si la plantilla no existe", () => {
      expect(() => service.render("no-existe")).toThrow(
        "Template no-existe not found"
      );
    });
  });
});
