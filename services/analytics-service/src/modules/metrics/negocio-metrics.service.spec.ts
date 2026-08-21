import { Test, TestingModule } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { NegocioMetricsService } from "./negocio-metrics.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";

describe("NegocioMetricsService", () => {
  let service: NegocioMetricsService;
  let mockDataSource: { query: jest.Mock };

  beforeEach(async () => {
    mockDataSource = { query: jest.fn().mockResolvedValue([{ visitas: 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NegocioMetricsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<NegocioMetricsService>(NegocioMetricsService);
  });

  describe("registrarVisita", () => {
    it("la primera visita del cliente es nueva", async () => {
      mockDataSource.query.mockResolvedValue([{ visitas: 1 }]);

      await expect(
        service.registrarVisita(NEGOCIO, CLIENTE, "2026-08-10", 50000)
      ).resolves.toBe("nueva");
    });

    it("a partir de la segunda es recurrente", async () => {
      mockDataSource.query.mockResolvedValue([{ visitas: 4 }]);

      await expect(
        service.registrarVisita(NEGOCIO, CLIENTE, "2026-08-10", 50000)
      ).resolves.toBe("recurrente");
    });

    it("acumula la visita sobre la fila del cliente", async () => {
      await service.registrarVisita(NEGOCIO, CLIENTE, "2026-08-10", 50000);

      const [sql, parametros] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("ON CONFLICT (business_id, client_id)");
      expect(sql).toContain("visitas = client_metrics.visitas + 1");
      expect(parametros).toEqual([NEGOCIO, CLIENTE, "2026-08-10", 50000]);
    });
  });

  describe("registrarServicios", () => {
    it("acumula una fila por servicio y día en una sola sentencia", async () => {
      await service.registrarServicios(NEGOCIO, "2026-08-10", [
        { serviceId: "svc-1", name: "Tinte", price: 120000, duration: 90 },
        { serviceId: "svc-2", name: "Corte", price: 30000, duration: 30 },
      ]);

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [sql, parametros] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("ON CONFLICT (business_id, service_id, date)");
      expect(parametros).toEqual([
        NEGOCIO,
        "2026-08-10",
        "svc-1",
        "Tinte",
        1,
        120000,
        90,
        "svc-2",
        "Corte",
        1,
        30000,
        30,
      ]);
    });

    // Postgres rechaza que un ON CONFLICT toque la misma fila dos veces en la
    // misma sentencia, y una cita puede llevar el mismo servicio repetido.
    it("junta el servicio que aparece dos veces en la cita", async () => {
      await service.registrarServicios(NEGOCIO, "2026-08-10", [
        { serviceId: "svc-1", name: "Tinte", price: 120000, duration: 90 },
        { serviceId: "svc-1", name: "Tinte", price: 120000, duration: 90 },
      ]);

      const [, parametros] = mockDataSource.query.mock.calls[0];
      expect(parametros).toEqual([
        NEGOCIO,
        "2026-08-10",
        "svc-1",
        "Tinte",
        2,
        240000,
        180,
      ]);
    });

    it("sin servicios no consulta nada", async () => {
      await service.registrarServicios(NEGOCIO, "2026-08-10", []);

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe("capacidad", () => {
    it("suma los minutos vendidos sin tocar los disponibles", async () => {
      await service.registrarMinutosVendidos(
        NEGOCIO,
        "prof-1",
        "2026-08-10",
        120
      );

      const [sql] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain(
        "minutos_vendidos = capacity_daily.minutos_vendidos + EXCLUDED.minutos_vendidos"
      );
      expect(sql).not.toContain("minutos_disponibles = EXCLUDED");
    });

    it("fija los disponibles del equipo sin tocar los vendidos", async () => {
      await service.fijarCapacidadDelDia(NEGOCIO, "2026-08-10", [
        { professionalId: "prof-1", minutosDisponibles: 480 },
        { professionalId: "prof-2", minutosDisponibles: 240 },
      ]);

      const [sql, parametros] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain(
        "minutos_disponibles = EXCLUDED.minutos_disponibles"
      );
      expect(sql).not.toContain("minutos_vendidos = capacity_daily");
      // Una sola sentencia con una fila por profesional.
      expect(sql.match(/gen_random_uuid\(\)/g)).toHaveLength(2);
      expect(parametros).toEqual([
        NEGOCIO,
        "2026-08-10",
        "prof-1",
        480,
        "prof-2",
        240,
      ]);
    });

    it("no consulta si el negocio no tiene equipo ese día", async () => {
      await service.fijarCapacidadDelDia(NEGOCIO, "2026-08-10", []);

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });
});
