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
    // El TTL se dispersa un 10% para que no venzan todas las claves a la vez.
    const [clave, contenido, modo, ttl] = set.mock.calls[0];
    expect([clave, contenido, modo]).toEqual(["k", '{"total":3}', "EX"]);
    expect(ttl).toBeGreaterThanOrEqual(54);
    expect(ttl).toBeLessThanOrEqual(66);
  });

  it("agrupa las cargas simultáneas de la misma clave en una sola", async () => {
    let resolver: (valor: unknown) => void = () => undefined;
    const cargar = jest.fn(
      () => new Promise((resuelve) => (resolver = resuelve))
    );
    const service = servicioCon({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
    });

    // Al caducar una clave muy visitada, todas las peticiones en vuelo fallaban
    // a la vez y cada una recalculaba por su cuenta.
    const peticiones = Promise.all([
      service.remember("k", 60, cargar),
      service.remember("k", 60, cargar),
      service.remember("k", 60, cargar),
    ]);
    await Promise.resolve();
    resolver({ total: 1 });

    await expect(peticiones).resolves.toEqual([
      { total: 1 },
      { total: 1 },
      { total: 1 },
    ]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("vuelve a cargar tras terminar la carga anterior", async () => {
    const cargar = jest.fn().mockResolvedValue("v");
    const service = servicioCon({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
    });

    await service.remember("k", 60, cargar);
    await service.remember("k", 60, cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("asocia la clave a la etiqueta que corresponde al valor cargado", async () => {
    const sadd = jest.fn().mockResolvedValue(1);
    const expire = jest.fn().mockResolvedValue(1);
    const service = servicioCon({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      sadd,
      expire,
    } as unknown as Partial<Redis>);

    await service.remember(
      "perfil:slug:x",
      60,
      async () => ({ businessId: "n-1" }),
      (valor) => `perfil:negocio:${valor.businessId}`
    );

    expect(sadd).toHaveBeenCalledWith("perfil:negocio:n-1", "perfil:slug:x");
    expect(expire).toHaveBeenCalled();
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

describe("RedisCacheService.invalidarEtiqueta", () => {
  it("borra solo las claves del grupo, no el espacio de claves entero", async () => {
    const del = jest.fn().mockResolvedValue(2);
    const smembers = jest.fn().mockResolvedValue(["p:a", "p:b"]);
    const scan = jest.fn();
    const service = servicioCon({
      smembers,
      del,
      scan,
    } as unknown as Partial<Redis>);

    const borradas = await service.invalidarEtiqueta("p:negocio:1");

    expect(smembers).toHaveBeenCalledWith("p:negocio:1");
    expect(del).toHaveBeenCalledWith("p:a", "p:b");
    expect(borradas).toBe(2);
    // Recorrer con SCAN leía todas las claves de Redis para filtrar después.
    expect(scan).not.toHaveBeenCalled();
  });

  it("borra también la etiqueta para no dejarla apuntando a claves muertas", async () => {
    const del = jest.fn().mockResolvedValue(1);
    const service = servicioCon({
      smembers: jest.fn().mockResolvedValue(["p:a"]),
      del,
    } as unknown as Partial<Redis>);

    await service.invalidarEtiqueta("p:negocio:1");

    expect(del).toHaveBeenCalledWith("p:negocio:1");
  });

  it("no borra nada cuando la etiqueta no tiene claves", async () => {
    const del = jest.fn().mockResolvedValue(0);
    const service = servicioCon({
      smembers: jest.fn().mockResolvedValue([]),
      del,
    } as unknown as Partial<Redis>);

    const borradas = await service.invalidarEtiqueta("p:negocio:1");

    expect(borradas).toBe(0);
    expect(del).toHaveBeenCalledTimes(1);
  });

  // Invalidar es mejor esfuerzo: propagar el fallo rompería una escritura que
  // ya ha tenido éxito, y las entradas caducan solas por TTL.
  it("no propaga el error si la invalidación falla", async () => {
    const service = servicioCon({
      smembers: jest.fn().mockRejectedValue(new Error("caído")),
      del: jest.fn(),
    } as unknown as Partial<Redis>);

    await expect(service.invalidarEtiqueta("p:negocio:1")).resolves.toBe(0);
  });
});
