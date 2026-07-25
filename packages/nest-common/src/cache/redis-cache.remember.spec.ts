import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { RedisCacheService } from "./redis-cache.service";
// El constructor abre una conexión real de ioredis; sin este mock el cliente
// reintenta contra un servidor inexistente y deja el proceso de jest colgado.
jest.mock("ioredis", () => {
  const cliente = { disconnect: jest.fn() };
  const fn = jest.fn(() => cliente);
  return { __esModule: true, default: fn, Redis: fn };
});

/**
 * Construye el servicio con un cliente Redis controlado.
 *
 * El cliente se inyecta reemplazando la propiedad privada porque el constructor
 * crea el suyo a partir del ConfigService; aquí interesa gobernar sus respuestas.
 */
function servicioCon(cliente: Partial<Redis>): RedisCacheService {
  const service = new RedisCacheService({
    get: () => undefined,
  } as unknown as ConfigService);
  (service as unknown as { client: Partial<Redis> }).client = cliente;
  jest.spyOn(service["logger"], "warn").mockImplementation(() => undefined);
  return service;
}

describe("RedisCacheService.remember", () => {
  it("devuelve el valor cacheado sin llamar al origen", async () => {
    const cargar = jest.fn();
    const service = servicioCon({
      get: jest.fn().mockResolvedValue('{"nombre":"Peluquería"}'),
      set: jest.fn(),
    });

    const valor = await service.remember("k", 60, cargar);

    expect(valor).toEqual({ nombre: "Peluquería" });
    expect(cargar).not.toHaveBeenCalled();
  });

  it("consulta el origen y guarda el resultado cuando no hay nada cacheado", async () => {
    const set = jest.fn().mockResolvedValue("OK");
    const service = servicioCon({
      get: jest.fn().mockResolvedValue(null),
      set,
    });

    const valor = await service.remember("k", 60, async () => ({ total: 3 }));

    expect(valor).toEqual({ total: 3 });
    expect(set).toHaveBeenCalledWith("k", '{"total":3}', "EX", 60);
  });

  // Una caché caída tiene que degradar el rendimiento, no convertir una lectura
  // correcta en un error de cara al usuario.
  it("sirve del origen si Redis falla al leer", async () => {
    const service = servicioCon({
      get: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      set: jest.fn().mockResolvedValue("OK"),
    });

    const valor = await service.remember("k", 60, async () => "del origen");

    expect(valor).toBe("del origen");
  });

  it("devuelve el valor aunque no se pueda guardar en caché", async () => {
    const service = servicioCon({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockRejectedValue(new Error("OOM")),
    });

    await expect(service.remember("k", 60, async () => 42)).resolves.toBe(42);
  });

  it("recurre al origen si lo cacheado no es JSON válido", async () => {
    const service = servicioCon({
      get: jest.fn().mockResolvedValue("{no es json"),
      set: jest.fn().mockResolvedValue("OK"),
    });

    await expect(service.remember("k", 60, async () => "fresco")).resolves.toBe(
      "fresco"
    );
  });
});

describe("RedisCacheService.delByPrefix", () => {
  it("recorre con SCAN y borra las claves encontradas", async () => {
    const del = jest.fn().mockResolvedValue(2);
    const scan = jest
      .fn()
      .mockResolvedValueOnce(["7", ["p:a", "p:b"]])
      .mockResolvedValueOnce(["0", []]);
    const service = servicioCon({ scan, del } as unknown as Partial<Redis>);

    const borradas = await service.delByPrefix("p:");

    expect(scan).toHaveBeenCalledWith("0", "MATCH", "p:*", "COUNT", 100);
    expect(del).toHaveBeenCalledWith("p:a", "p:b");
    expect(borradas).toBe(2);
  });

  it("no borra nada cuando el prefijo no tiene claves", async () => {
    const del = jest.fn();
    const service = servicioCon({
      scan: jest.fn().mockResolvedValue(["0", []]),
      del,
    } as unknown as Partial<Redis>);

    await service.delByPrefix("p:");

    expect(del).not.toHaveBeenCalled();
  });

  // Invalidar es mejor esfuerzo: propagar el fallo rompería una escritura que
  // ya ha tenido éxito, y las entradas caducan solas por TTL.
  it("no propaga el error si la invalidación falla", async () => {
    const service = servicioCon({
      scan: jest.fn().mockRejectedValue(new Error("caído")),
      del: jest.fn(),
    } as unknown as Partial<Redis>);

    await expect(service.delByPrefix("p:")).resolves.toBe(0);
  });
});
