import { Test } from "@nestjs/testing";
import { getDataSourceToken, getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DashboardService } from "./dashboard.service";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";

describe("DashboardService", () => {
  let service: DashboardService;
  let mockDailyRepo: jest.Mocked<Repository<DailyMetricEntity>>;
  let mockProfRepo: jest.Mocked<Repository<ProfessionalMetricEntity>>;
  let mockDataSource: { query: jest.Mock };

  const mockDailyMetric: DailyMetricEntity = {
    id: "metrics-123",
    businessId: "business-123",
    date: "2024-01-15",
    totalAppointments: 10,
    completedAppointments: 8,
    cancelledAppointments: 1,
    noShowAppointments: 1,
    totalRevenue: 500000,
    newClients: 3,
    returningClients: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const buildQueryBuilder = (result: unknown) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    mockDailyRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockProfRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    // Por defecto no hay capacidad materializada, y la ocupación sale 0.
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ vendidos: "0", disponibles: "0" }]),
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(DailyMetricEntity),
          useValue: mockDailyRepo,
        },
        {
          provide: getRepositoryToken(ProfessionalMetricEntity),
          useValue: mockProfRepo,
        },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        {
          provide: ZonaDelNegocioService,
          useValue: { de: jest.fn().mockResolvedValue("America/Bogota") },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe("getKPIs", () => {
    it("debería retornar KPIs usando SQL aggregation", async () => {
      const aggResult = {
        totalRevenue: "1100000",
        totalAppointments: "22",
        completedAppointments: "18",
        cancelledAppointments: "2",
        noShowAppointments: "2",
        newClients: "6",
        returningClients: "14",
      };

      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggResult)
      );
      mockDailyRepo.findOne.mockResolvedValue(mockDailyMetric as any);

      const result = await service.getKPIs("business-123");

      expect(result.today as any).toEqual({
        totalAppointments: 10,
        totalRevenue: 500000,
        completedAppointments: 8,
      });
      expect(result.periodo.totalRevenue).toBe(1100000);
      expect(result.periodo.totalAppointments).toBe(22);
      expect(result.periodo.completionRate).toBe(82);
      expect(result.periodo.cancellationRate).toBe(9);
      expect(result.periodo.noShowRate).toBe(9);
      // El promedio se reparte entre los 30 días del periodo, no entre los que
      // tuvieron movimiento: 1.100.000 / 30.
      expect(result.periodo.avgDailyRevenue).toBe(36667);
    });

    // Con la hora del proceso —UTC en producción— esa franja ya cae en la
    // fecha siguiente y el panel del dueño mostraría ceros.
    it("sigue siendo el mismo día pasadas las 19:00 en Colombia", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-10T02:00:00Z")); // 21:00 en Bogotá

      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({})
      );
      mockDailyRepo.findOne.mockResolvedValue(mockDailyMetric as any);

      await service.getKPIs("business-123");

      expect(mockDailyRepo.findOne).toHaveBeenCalledWith({
        where: { businessId: "business-123", date: "2026-08-09" },
      });

      jest.useRealTimers();
    });

    it("debería retornar KPIs vacíos si no hay datos", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          totalRevenue: "0",
          totalAppointments: "0",
          completedAppointments: "0",
          cancelledAppointments: "0",
          noShowAppointments: "0",
          newClients: "0",
          returningClients: "0",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      const result = await service.getKPIs("business-123");

      expect(result.today as any).toEqual({
        totalAppointments: 0,
        totalRevenue: 0,
        completedAppointments: 0,
      });
      expect(result.periodo.totalRevenue).toBe(0);
      expect(result.periodo.completionRate).toBe(0);
    });

    it("debería calcular tasas correctamente cuando no hay citas", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          totalRevenue: "0",
          totalAppointments: "0",
          completedAppointments: "0",
          cancelledAppointments: "0",
          noShowAppointments: "0",
          newClients: "0",
          returningClients: "0",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      const result = await service.getKPIs("business-123");

      expect(result.periodo.completionRate).toBe(0);
      expect(result.periodo.cancellationRate).toBe(0);
      expect(result.periodo.noShowRate).toBe(0);
    });
  });

  describe("getTopProfessionals", () => {
    it("debería retornar profesionales top con SQL aggregation", async () => {
      // Postgres devuelve los agregados como cadena; el contrato de la API son
      // números, que es lo que el dashboard ordena y formatea.
      const filas = [
        {
          professionalId: "prof-123",
          appointments: "20",
          revenue: "800000",
          avgRating: "4.8",
        },
        {
          professionalId: "prof-456",
          appointments: "15",
          revenue: "600000",
          avgRating: "4.9",
        },
      ];

      (mockProfRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(filas)
      );

      const result = await service.getTopProfessionals("business-123", 10);

      expect(result).toEqual([
        {
          professionalId: "prof-123",
          appointments: 20,
          revenue: 800000,
          avgRating: 4.8,
        },
        {
          professionalId: "prof-456",
          appointments: 15,
          revenue: 600000,
          avgRating: 4.9,
        },
      ]);
    });

    it("debería usar límite por defecto de 10", async () => {
      const qb = buildQueryBuilder([]);
      (mockProfRepo.createQueryBuilder as any).mockReturnValue(qb);

      await service.getTopProfessionals("business-123");

      expect(qb.limit).toHaveBeenCalledWith(10);
    });

    it("debería usar límite personalizado", async () => {
      const qb = buildQueryBuilder([]);
      (mockProfRepo.createQueryBuilder as any).mockReturnValue(qb);

      await service.getTopProfessionals("business-123", 5);

      expect(qb.limit).toHaveBeenCalledWith(5);
    });
  });

  describe("getRevenueChart", () => {
    // La gráfica del dashboard consume {date, revenue}: con la entidad entera
    // su validación falla y la serie se pinta vacía.
    it("devuelve la serie como puntos {date, revenue}", async () => {
      const revenueData = [
        { ...mockDailyMetric, date: "2024-01-15", totalRevenue: 500000 } as any,
        { ...mockDailyMetric, date: "2024-01-16", totalRevenue: 600000 } as any,
      ];

      mockDailyRepo.find.mockResolvedValue(revenueData);

      const result = await service.getRevenueChart("business-123", 30);

      expect(mockDailyRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", date: expect.any(Object) },
        order: { date: "ASC" },
      });
      expect(result).toEqual([
        { date: "2024-01-15", revenue: 500000 },
        { date: "2024-01-16", revenue: 600000 },
      ]);
    });

    it("debería retornar array vacío si no hay datos", async () => {
      mockDailyRepo.find.mockResolvedValue([]);

      const result = await service.getRevenueChart("business-123", 30);

      expect(result).toEqual([]);
    });
  });

  describe("ticket medio y ocupación", () => {
    const aggResult = {
      totalRevenue: "1000000",
      totalAppointments: "50",
      completedAppointments: "20",
      cancelledAppointments: "0",
      noShowAppointments: "0",
      newClients: "0",
      returningClients: "0",
      ventas: "20",
      revenueDeVentas: "1000000",
    };

    it("divide los ingresos entre los cobros que los produjeron", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggResult)
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      expect((await service.getKPIs("business-123")).periodo.avgTicket).toBe(
        50000
      );
    });

    // Los ingresos vienen de los cobros y las citas atendidas de la agenda:
    // hay ventas sin cita y citas que se cobran otro dia.
    it("no lo divide entre las citas atendidas", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          ...aggResult,
          completedAppointments: "0",
          ventas: "2",
          revenueDeVentas: "1000000",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      expect((await service.getKPIs("business-123")).periodo.avgTicket).toBe(
        500000
      );
    });

    // Solo entran los dias que aportan las dos cifras: sin cobros no hay
    // ticket que promediar.
    it("promedia solo los días cuyas ventas están contadas", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          ...aggResult,
          totalRevenue: "576000",
          ventas: "2",
          revenueDeVentas: "75000",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      const kpis = await service.getKPIs("business-123");

      expect(kpis.periodo.totalRevenue).toBe(576000);
      expect(kpis.periodo.avgTicket).toBe(37500);
    });

    // Un cero se lee como "este negocio no vende"; que no haya cobros es otra
    // cosa, y la pantalla lo dice con palabras.
    it("sin cobros no hay ticket medio", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          ...aggResult,
          totalRevenue: "0",
          ventas: "0",
          revenueDeVentas: "0",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      expect(
        (await service.getKPIs("business-123")).periodo.avgTicket
      ).toBeNull();
    });

    it("calcula la ocupación sobre la capacidad materializada", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggResult)
      );
      mockDailyRepo.findOne.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([
        { vendidos: "300", disponibles: "1200" },
      ]);

      const kpis = await service.getKPIs("business-123");

      expect(kpis.periodo.ocupacion).toBe(25);
    });

    it("sin capacidad materializada la ocupación es cero", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggResult)
      );
      mockDailyRepo.findOne.mockResolvedValue(null);

      const kpis = await service.getKPIs("business-123");

      expect(kpis.periodo.ocupacion).toBe(0);
    });
  });

  describe("getRetencion", () => {
    it("calcula la tasa de retorno y la frecuencia de visita", async () => {
      mockDataSource.query.mockResolvedValue([
        { clientes: 40, recurrentes: 10, dias_entre_visitas: "28.4" },
      ]);

      await expect(service.getRetencion("business-123")).resolves.toEqual({
        clientes: 40,
        recurrentes: 10,
        tasaDeRetorno: 25,
        diasEntreVisitas: 28,
      });
    });

    it("sin clientes devuelve ceros", async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.getRetencion("business-123")).resolves.toEqual({
        clientes: 0,
        recurrentes: 0,
        tasaDeRetorno: 0,
        diasEntreVisitas: 0,
      });
    });
  });

  describe("getRentabilidadPorServicio", () => {
    it("añade el ingreso por hora de agenda a cada servicio", async () => {
      mockDataSource.query.mockResolvedValue([
        {
          service_id: "svc-1",
          service_name: "Tinte",
          veces: 4,
          ingresos: "480000",
          minutos: 360,
        },
        {
          service_id: "svc-2",
          service_name: "Corte",
          veces: 10,
          ingresos: "300000",
          minutos: 300,
        },
      ]);

      const filas = await service.getRentabilidadPorServicio("business-123");

      expect(filas[0]).toEqual({
        serviceId: "svc-1",
        serviceName: "Tinte",
        veces: 4,
        ingresos: 480000,
        minutos: 360,
        ingresoPorHora: 80000,
      });
      expect(filas[1].ingresoPorHora).toBe(60000);
    });

    it("un servicio sin minutos no divide por cero", async () => {
      mockDataSource.query.mockResolvedValue([
        {
          service_id: "svc-1",
          service_name: "Consulta",
          veces: 1,
          ingresos: "10000",
          minutos: 0,
        },
      ]);

      const filas = await service.getRentabilidadPorServicio("business-123");

      expect(filas[0].ingresoPorHora).toBe(0);
    });
  });

  describe("getKPIs sobre un periodo pedido", () => {
    /** Deja el agregado devolviendo esos ingresos y captura el constructor. */
    function conIngresos(totalRevenue: string) {
      const qb = buildQueryBuilder({ totalRevenue, ventas: "0" });
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(qb);
      mockDailyRepo.findOne.mockResolvedValue(null as any);
      return qb;
    }

    it("agrega sobre el periodo que se le pide", async () => {
      const qb = conIngresos("900000");

      const result = await service.getKPIs("business-123", {
        from: "2026-08-01",
        to: "2026-08-31",
      });

      expect(qb.andWhere).toHaveBeenCalledWith("m.date BETWEEN :from AND :to", {
        from: "2026-08-01",
        to: "2026-08-31",
      });
      expect(result.periodo.from).toBe("2026-08-01");
      expect(result.periodo.to).toBe("2026-08-31");
    });

    // El promedio diario se reparte entre los días del periodo pedido, sean los
    // que sean: agosto tiene 31 y febrero 28, y la cifra tiene que decirlo.
    it("reparte el promedio entre los días que abarca el periodo", async () => {
      conIngresos("900000");

      const agosto = await service.getKPIs("business-123", {
        from: "2026-08-01",
        to: "2026-08-31",
      });

      expect(agosto.periodo.dias).toBe(31);
      expect(agosto.periodo.avgDailyRevenue).toBe(Math.round(900000 / 31));
    });

    it("cuenta un solo día cuando el periodo es un día", async () => {
      conIngresos("50000");

      const result = await service.getKPIs("business-123", {
        from: "2026-08-17",
        to: "2026-08-17",
      });

      expect(result.periodo.dias).toBe(1);
      expect(result.periodo.avgDailyRevenue).toBe(50000);
    });

    it("no compara si no se lo piden", async () => {
      conIngresos("900000");

      const result = await service.getKPIs("business-123", {
        from: "2026-08-01",
        to: "2026-08-31",
      });

      expect(result.comparado).toBeNull();
    });

    // El periodo anterior tiene la misma duración y acaba justo antes: comparar
    // febrero contra enero mediría el calendario, no el negocio.
    it("compara contra el periodo anterior de la misma duración", async () => {
      conIngresos("900000");

      const result = await service.getKPIs(
        "business-123",
        { from: "2026-08-01", to: "2026-08-31" },
        true
      );

      expect(result.comparado).toMatchObject({
        from: "2026-07-01",
        to: "2026-07-31",
        dias: 31,
      });
    });

    it("compara la semana contra la semana anterior", async () => {
      conIngresos("100000");

      const result = await service.getKPIs(
        "business-123",
        { from: "2026-08-10", to: "2026-08-16" },
        true
      );

      expect(result.comparado).toMatchObject({
        from: "2026-08-03",
        to: "2026-08-09",
        dias: 7,
      });
    });
  });
});
