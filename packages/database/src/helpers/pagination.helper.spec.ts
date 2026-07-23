import { paginate, PaginateParams } from "./pagination.helper";
import { Repository } from "typeorm";

describe("Pagination Helper", () => {
  let mockRepository: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    mockRepository = {
      findAndCount: jest.fn(),
    } as any;
  });

  describe("paginate", () => {
    const mockParams: PaginateParams = {
      page: 1,
      limit: 10,
      offset: 0,
      sort: "createdAt",
      order: "DESC",
    };

    const mockData = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];

    it("debería retornar datos paginados correctamente", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);

      const result = await paginate(mockRepository, mockParams);

      expect(result).toEqual({
        data: mockData,
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it("debería calcular totalPages correctamente", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 25]);

      const result = await paginate(mockRepository, mockParams);

      expect(result.meta.totalPages).toBe(3);
    });

    it("debería identificar hasNext correctamente", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 25]);

      const result = await paginate(mockRepository, mockParams);

      expect(result.meta.hasNext).toBe(true);
    });

    it("debería identificar hasPrev correctamente en página 1", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);

      const result = await paginate(mockRepository, mockParams);

      expect(result.meta.hasPrev).toBe(false);
    });

    it("debería identificar hasPrev correctamente en página > 1", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 20]);
      const params = { ...mockParams, page: 2, offset: 10 };

      const result = await paginate(mockRepository, params);

      expect(result.meta.hasPrev).toBe(true);
    });

    it("debería pasar parámetros findAndCount correctamente", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);
      const findOptions = { where: { active: true } };

      await paginate(mockRepository, mockParams, findOptions);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        ...findOptions,
        skip: 0,
        take: 10,
        order: { createdAt: "DESC" },
      });
    });

    it("debería usar sort personalizado", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);
      const params = { ...mockParams, sort: "name" };

      await paginate(mockRepository, params);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { name: "DESC" },
        })
      );
    });

    it("debería usar order personalizado", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);
      const params = { ...mockParams, order: "ASC" as const };

      await paginate(mockRepository, params);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: "ASC" },
        })
      );
    });

    it("respeta un order explícito de findOptions (multi-campo) sobre el sort", async () => {
      // Antes el helper descartaba findOptions.order y siempre imponía el sort
      // de params; ahora un order explícito (p. ej. date DESC + startTime ASC)
      // tiene prioridad.
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);

      await paginate(mockRepository, mockParams, {
        where: { active: true },
        order: { date: "DESC", startTime: "ASC" },
      });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true },
          order: { date: "DESC", startTime: "ASC" },
        })
      );
    });

    it("debería manejar resultados vacíos", async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await paginate(mockRepository, mockParams);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
    });

    it("debería manejar offset personalizado", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 30]);
      const params = { ...mockParams, page: 3, offset: 20 };

      await paginate(mockRepository, params);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
        })
      );
    });

    it("debería mantener datos adicionales en findOptions", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 2]);
      const findOptions = {
        where: { active: true },
        relations: ["category"],
      };

      await paginate(mockRepository, mockParams, findOptions);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { active: true },
        relations: ["category"],
        skip: 0,
        take: 10,
        order: { createdAt: "DESC" },
      });
    });

    it("debería manejar totalPages con límite exacto", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 20]);

      const result = await paginate(mockRepository, mockParams);

      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNext).toBe(true);
    });

    it("debería manejar última página", async () => {
      mockRepository.findAndCount.mockResolvedValue([mockData, 20]);
      const params = { ...mockParams, page: 2, offset: 10 };

      const result = await paginate(mockRepository, params);

      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(true);
    });
  });
});
