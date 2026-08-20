import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SpecialDaysService } from "./special-days.service";
import { BusinessSpecialDay } from "../../entities/business-special-day.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const SEDE = "22222222-2222-4222-8222-222222222222";

/** Un día especial ya guardado, con lo que se le indique. */
const guardado = (
  campos: Partial<BusinessSpecialDay> = {}
): BusinessSpecialDay =>
  ({
    id: "dia-1",
    businessId: NEGOCIO,
    branchId: null,
    startDate: "2026-07-20",
    endDate: "2026-07-20",
    closed: true,
    openTime: null,
    closeTime: null,
    motivo: "20 de julio",
    ...campos,
  }) as BusinessSpecialDay;

describe("SpecialDaysService", () => {
  let service: SpecialDaysService;
  let repo: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((d) => Promise.resolve(d)),
      create: jest.fn((d) => d),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        SpecialDaysService,
        { provide: getRepositoryToken(BusinessSpecialDay), useValue: repo },
      ],
    }).compile();

    service = modulo.get(SpecialDaysService);
  });

  describe("create", () => {
    it("declara un festivo cerrado", async () => {
      const creado = await service.create(NEGOCIO, {
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        motivo: "20 de julio",
      });

      expect(creado).toMatchObject({
        businessId: NEGOCIO,
        closed: true,
        motivo: "20 de julio",
      });
    });

    it("declara unas vacaciones de varios días", async () => {
      const creado = await service.create(NEGOCIO, {
        startDate: "2026-12-24",
        endDate: "2027-01-02",
        motivo: "Vacaciones",
      });

      expect(creado).toMatchObject({
        startDate: "2026-12-24",
        endDate: "2027-01-02",
      });
    });

    it("guarda el horario propio de un día que abre distinto", async () => {
      const creado = await service.create(NEGOCIO, {
        startDate: "2026-12-24",
        endDate: "2026-12-24",
        closed: false,
        openTime: "09:00",
        closeTime: "14:00",
        motivo: "Nochebuena",
      });

      expect(creado).toMatchObject({
        closed: false,
        openTime: "09:00",
        closeTime: "14:00",
      });
    });

    it("rechaza el rango que termina antes de empezar", async () => {
      await expect(
        service.create(NEGOCIO, {
          startDate: "2026-07-25",
          endDate: "2026-07-20",
          motivo: "Vacaciones",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("no deja abrir sin decir a qué hora", async () => {
      await expect(
        service.create(NEGOCIO, {
          startDate: "2026-12-24",
          endDate: "2026-12-24",
          closed: false,
          motivo: "Nochebuena",
        })
      ).rejects.toThrow(/hora de apertura y de cierre/);
    });

    it("rechaza una hora que no existe", async () => {
      await expect(
        service.create(NEGOCIO, {
          startDate: "2026-12-24",
          endDate: "2026-12-24",
          closed: false,
          openTime: "9:0",
          closeTime: "14:00",
          motivo: "Nochebuena",
        })
      ).rejects.toThrow(/apertura invalida/);
    });

    it("rechaza el rango que pisa otro ya declarado", async () => {
      repo.find.mockResolvedValue([guardado({ motivo: "Vacaciones" })]);

      await expect(
        service.create(NEGOCIO, {
          startDate: "2026-07-18",
          endDate: "2026-07-22",
          motivo: "Festivo",
        })
      ).rejects.toThrow(/ya están declaradas/);
    });

    it("deja declarar el mismo día en dos sedes distintas", async () => {
      repo.find.mockResolvedValue([guardado({ branchId: SEDE })]);

      await expect(
        service.create(NEGOCIO, {
          startDate: "2026-07-20",
          endDate: "2026-07-20",
          motivo: "20 de julio",
        })
      ).resolves.toMatchObject({ branchId: null });
    });
  });

  describe("delDia", () => {
    it("encuentra el día especial que cubre la fecha", async () => {
      repo.find.mockResolvedValue([guardado()]);

      await expect(
        service.delDia(NEGOCIO, "2026-07-20")
      ).resolves.toMatchObject({ motivo: "20 de julio" });
    });

    it("devuelve null cuando la fecha no cae en ninguno", async () => {
      await expect(service.delDia(NEGOCIO, "2026-07-21")).resolves.toBeNull();
    });

    // Lo de la sede manda sobre lo declarado para todo el negocio.
    it("prefiere el de la sede al del negocio", async () => {
      repo.find.mockResolvedValue([
        guardado({ id: "del-negocio" }),
        guardado({ id: "de-la-sede", branchId: SEDE, motivo: "Reforma" }),
      ]);

      await expect(
        service.delDia(NEGOCIO, "2026-07-20", SEDE)
      ).resolves.toMatchObject({ id: "de-la-sede" });
    });

    it("ignora el de otra sede", async () => {
      repo.find.mockResolvedValue([guardado({ branchId: SEDE })]);

      await expect(service.delDia(NEGOCIO, "2026-07-20")).resolves.toBeNull();
    });
  });

  describe("remove", () => {
    it("borra el día especial del negocio", async () => {
      await service.remove("dia-1", NEGOCIO);

      expect(repo.delete).toHaveBeenCalledWith({
        id: "dia-1",
        businessId: NEGOCIO,
      });
    });

    it("lanza 404 si no existe o es de otro negocio", async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove("dia-1", NEGOCIO)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
