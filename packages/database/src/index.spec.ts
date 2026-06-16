import { Repository } from 'typeorm';
import { paginate } from './helpers/pagination.helper';

describe('Pagination Helper', () => {
  let mockRepository: jest.Mocked<Repository<any>>;

  beforeEach(() => {
    mockRepository = {
      findAndCount: jest.fn(),
    } as any;
  });

  describe('paginate', () => {
    it('debería paginar resultados correctamente', async () => {
      const mockData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ];
      mockRepository.findAndCount.mockResolvedValue([mockData, 10]);

      const result = await paginate(mockRepository, {
        page: 1,
        limit: 10,
        offset: 0,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('debería calcular totalPages correctamente', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await paginate(mockRepository, {
        page: 1,
        limit: 10,
        offset: 0,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.meta.totalPages).toBe(3);
    });

    it('debería determinar hasNext correctamente', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await paginate(mockRepository, {
        page: 2,
        limit: 10,
        offset: 10,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.meta.hasNext).toBe(true);
    });

    it('debería determinar hasPrev correctamente', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await paginate(mockRepository, {
        page: 2,
        limit: 10,
        offset: 10,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.meta.hasPrev).toBe(true);
    });

    it('debería aplicar offset y limit correctamente', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await paginate(mockRepository, {
        page: 3,
        limit: 20,
        offset: 40,
        sort: 'id',
        order: 'DESC',
      });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
          order: { id: 'DESC' },
        }),
      );
    });

    it('debería combinar findOptions adicionales', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const additionalOptions = {
        where: { active: true },
        relations: ['user'],
      };

      await paginate(mockRepository, {
        page: 1,
        limit: 10,
        offset: 0,
        sort: 'id',
        order: 'ASC',
      }, additionalOptions);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true },
          relations: ['user'],
          skip: 0,
          take: 10,
          order: { id: 'ASC' },
        }),
      );
    });

    it('debería manejar resultados vacíos', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await paginate(mockRepository, {
        page: 1,
        limit: 10,
        offset: 0,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
    });

    it('debería manejar página fuera de rango', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 10]);

      const result = await paginate(mockRepository, {
        page: 5,
        limit: 10,
        offset: 40,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.data).toEqual([]);
      expect(result.meta.hasNext).toBe(false);
    });

    it('debería manejar última página con resultados parciales', async () => {
      const mockData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
        { id: 3, name: 'Test 3' },
      ];
      mockRepository.findAndCount.mockResolvedValue([mockData, 23]);

      const result = await paginate(mockRepository, {
        page: 3,
        limit: 10,
        offset: 20,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.data).toHaveLength(3);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNext).toBe(false);
    });

    it('debería manejar primera página correctamente', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 100]);

      const result = await paginate(mockRepository, {
        page: 1,
        limit: 10,
        offset: 0,
        sort: 'id',
        order: 'ASC',
      });

      expect(result.meta.page).toBe(1);
      expect(result.meta.hasPrev).toBe(false);
      expect(result.meta.hasNext).toBe(true);
    });
  });
});