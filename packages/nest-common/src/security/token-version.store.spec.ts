import {
  TokenVersionStore,
  TOKEN_VERSION_DEFAULT,
} from "./token-version.store";
import { RedisCacheService } from "../cache/redis-cache.service";
import { TokenVersionResolver } from "./token-version.resolver";

describe("TokenVersionStore", () => {
  let cache: jest.Mocked<Pick<RedisCacheService, "get" | "set" | "incr">>;
  let resolver: jest.Mocked<TokenVersionResolver>;

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn(),
    };
    resolver = { load: jest.fn(), bump: jest.fn() };
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  const build = (withResolver: boolean) =>
    new TokenVersionStore(
      cache as unknown as RedisCacheService,
      withResolver ? resolver : undefined
    );

  describe("sin resolver (servicios que solo usan Redis)", () => {
    it("devuelve la versión cacheada", async () => {
      cache.get.mockResolvedValue("7");
      await expect(build(false).getVersion("user-1")).resolves.toBe(7);
    });

    it("devuelve el valor por defecto si no hay nada en caché", async () => {
      cache.get.mockResolvedValue(null);
      await expect(build(false).getVersion("user-1")).resolves.toBe(
        TOKEN_VERSION_DEFAULT
      );
    });

    it("incrementa la versión directamente en Redis", async () => {
      cache.incr.mockResolvedValue(3);
      await expect(build(false).bumpVersion("user-1")).resolves.toBe(3);
      expect(cache.incr).toHaveBeenCalledWith("tokenVersion:user-1");
    });
  });

  describe("con resolver (auth-service, revocación persistente)", () => {
    it("no consulta la BD cuando la caché responde", async () => {
      cache.get.mockResolvedValue("4");
      await expect(build(true).getVersion("user-1")).resolves.toBe(4);
      expect(resolver.load).not.toHaveBeenCalled();
    });

    it("recurre a la BD y repuebla la caché si Redis fue vaciado", async () => {
      cache.get.mockResolvedValue(null);
      resolver.load.mockResolvedValue(9);

      await expect(build(true).getVersion("user-1")).resolves.toBe(9);
      expect(resolver.load).toHaveBeenCalledWith("user-1");
      expect(cache.set).toHaveBeenCalledWith("tokenVersion:user-1", "9");
    });

    it("recurre a la BD cuando Redis falla, sin propagar el error", async () => {
      cache.get.mockRejectedValue(new Error("Redis caído"));
      resolver.load.mockResolvedValue(5);

      await expect(build(true).getVersion("user-1")).resolves.toBe(5);
    });

    it("incrementa en BD y sincroniza la caché al revocar", async () => {
      resolver.bump.mockResolvedValue(6);

      await expect(build(true).bumpVersion("user-1")).resolves.toBe(6);
      expect(resolver.bump).toHaveBeenCalledWith("user-1");
      expect(cache.set).toHaveBeenCalledWith("tokenVersion:user-1", "6");
      expect(cache.incr).not.toHaveBeenCalled();
    });

    it("mantiene la revocación aunque falle el cacheo posterior", async () => {
      resolver.bump.mockResolvedValue(2);
      cache.set.mockRejectedValue(new Error("Redis caído"));

      await expect(build(true).bumpVersion("user-1")).resolves.toBe(2);
    });
  });
});
