import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { BusinessConfigService } from "./business-config.service";
import { BusinessConfig } from "../../entities/business-config.entity";
import { v4 as uuidv4 } from "uuid";

describe("BusinessConfigService", () => {
  let service: BusinessConfigService;
  let outbox: { enqueue: jest.Mock };
  let mockRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let valoresInsertados: Record<string, unknown>;
  let columnasPisadas: string[];

  beforeEach(async () => {
    valoresInsertados = {};
    columnasPisadas = [];
    const builder = {
      insert: () => builder,
      into: () => builder,
      values: (v: Record<string, unknown>) => {
        valoresInsertados = v;
        return builder;
      },
      orUpdate: (columnas: string[]) => {
        columnasPisadas = columnas;
        return builder;
      },
      execute: jest.fn().mockResolvedValue(undefined),
    };
    mockRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => builder),
    };

    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessConfigService,
        { provide: getRepositoryToken(BusinessConfig), useValue: mockRepo },
        // La transacción entrega el mismo constructor de consultas del test.
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: unknown) => unknown) =>
              cb({ createQueryBuilder: jest.fn(() => builder) })
            ),
          },
        },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    service = module.get<BusinessConfigService>(BusinessConfigService);
  });

  describe("leer", () => {
    it("devuelve un objeto vacío si el negocio no tocó la clave", async () => {
      expect(await service.leer("business-123", "facturacion")).toEqual({});
    });

    it("devuelve lo guardado", async () => {
      mockRepo.findOne.mockResolvedValue({ value: { serie: "FA" } });

      expect(await service.leer("business-123", "facturacion")).toEqual({
        serie: "FA",
      });
    });
  });

  describe("guardar", () => {
    it("mezcla los cambios con lo que ya había", async () => {
      mockRepo.findOne.mockResolvedValue({
        value: { nit: "900123", serie: "INV" },
      });

      const resultado = await service.guardar("business-123", "facturacion", {
        serie: "FA",
      });

      expect(resultado).toEqual({ nit: "900123", serie: "FA" });
      expect(valoresInsertados).toEqual(
        expect.objectContaining({
          businessId: "business-123",
          key: "facturacion",
          value: { nit: "900123", serie: "FA" },
        })
      );
    });

    it("pone el id de la fila que inserta", async () => {
      (uuidv4 as jest.Mock).mockReturnValue("config-1");

      await service.guardar("business-123", "facturacion", { serie: "FA" });

      expect(valoresInsertados.id).toBe("config-1");
    });

    it("al chocar solo pisa el valor, no el id de la fila", async () => {
      await service.guardar("business-123", "facturacion", { serie: "FA" });

      expect(columnasPisadas).toEqual(["value", "updated_at"]);
    });
  });

  describe("anuncio del cambio", () => {
    // De esta clave sale la politica de reserva que booking cachea.
    it("avisa de que la configuración cambió, en la misma escritura", async () => {
      await service.guardar("business-123", "reservas", { horas: 4 });

      expect(outbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.CORE_BUSINESS_CONFIG_UPDATED,
          payload: { businessId: "business-123" },
        })
      );
    });
  });
});
