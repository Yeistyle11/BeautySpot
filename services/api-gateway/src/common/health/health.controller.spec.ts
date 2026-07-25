import { HealthController } from "./health.controller";
import { ServiceUrlsConfig } from "../../config/service-urls";

const urls = {
  auth: "http://localhost:3001",
  core: "http://localhost:3002",
} as unknown as ReturnType<ServiceUrlsConfig["getAll"]>;

const config = () =>
  ({ getAll: jest.fn().mockReturnValue(urls) }) as unknown as ServiceUrlsConfig;

describe("HealthController del gateway", () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it("agrega el estado de todos los backends cuando responden", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;

    const resultado = await new HealthController(config()).check();

    expect(resultado.status).toBe("healthy");
    expect(resultado.services).toEqual({ auth: "healthy", core: "healthy" });
  });

  it("consulta el /health de cada servicio", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;

    await new HealthController(config()).check();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/health",
      expect.anything()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3002/health",
      expect.anything()
    );
  });

  it("marca unhealthy el servicio que responde con error HTTP", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false }) as never;

    const resultado = await new HealthController(config()).check();

    expect(resultado.services.core).toBe("unhealthy");
    expect(resultado.status).toBe("degraded");
  });

  // Un servicio caído o que agota el timeout ni siquiera devuelve respuesta: hay
  // que distinguirlo de uno que contesta con error.
  it("marca unreachable el servicio que no contesta", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("ECONNREFUSED")) as never;

    const resultado = await new HealthController(config()).check();

    expect(resultado.services.core).toBe("unreachable");
    expect(resultado.status).toBe("degraded");
  });

  it("incluye una marca de tiempo ISO", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;

    const resultado = await new HealthController(config()).check();

    expect(new Date(resultado.timestamp).toISOString()).toBe(
      resultado.timestamp
    );
  });
});
