import { ExecutionContext } from "@nestjs/common";
import { AuthGatewayGuard } from "./auth-gateway.guard";

/** Contexto mínimo con la ruta y el método que mira el guard. */
function contextoDe(path: string, method: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ path, method }) }),
  } as unknown as ExecutionContext;
}

describe("AuthGatewayGuard", () => {
  let guard: AuthGatewayGuard;
  let superCanActivate: jest.SpyInstance;

  beforeEach(() => {
    guard = new AuthGatewayGuard();
    // Lo que interesa es si el guard cortocircuita o delega en el JWT de passport.
    superCanActivate = jest
      .spyOn(Object.getPrototypeOf(AuthGatewayGuard.prototype), "canActivate")
      .mockReturnValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  describe("rutas sin token", () => {
    it("deja pasar el login", () => {
      expect(guard.canActivate(contextoDe("/api/v1/auth/login", "POST"))).toBe(
        true
      );
    });

    it("deja pasar el escaparate del marketplace por GET", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/marketplace/profiles/salon-aurora", "GET")
        )
      ).toBe(true);
    });

    it("deja pasar el catálogo público del negocio, que alimenta la reserva", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/core/public/businesses/abc/services", "GET")
        )
      ).toBe(true);
    });

    it("deja reservar a un invitado sin token", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/booking/public/appointments", "POST")
        )
      ).toBe(true);
    });

    it("deja consultar horarios libres antes de tener sesión", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/booking/appointments/availability", "GET")
        )
      ).toBe(true);
    });

    it("acepta también el alias con sufijo -service", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/booking-service/public/appointments", "POST")
        )
      ).toBe(true);
    });
  });

  describe("lo que no debe abrir de paso", () => {
    it("exige token para escribir en el marketplace", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/marketplace/profiles/salon-aurora", "POST")
        )
      ).toBe(false);
      expect(superCanActivate).toHaveBeenCalled();
    });

    it("exige token para el resto de la agenda", () => {
      expect(
        guard.canActivate(contextoDe("/api/v1/booking/appointments", "POST"))
      ).toBe(false);
    });

    it("no abre la agenda entera por compartir el prefijo public", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/booking/public/appointments/secreto", "POST")
        )
      ).toBe(false);
    });

    it("exige token para escribir en el catálogo público", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/core/public/businesses/abc/services", "POST")
        )
      ).toBe(false);
    });

    it("no deja escribir citas por la puerta de disponibilidad", () => {
      expect(
        guard.canActivate(
          contextoDe("/api/v1/booking/appointments/availability", "POST")
        )
      ).toBe(false);
    });

    it("exige token para las citas propias del cliente", () => {
      expect(
        guard.canActivate(contextoDe("/api/v1/booking/appointments/mine", "GET"))
      ).toBe(false);
    });

    it("exige token para los clientes del negocio", () => {
      expect(
        guard.canActivate(contextoDe("/api/v1/core/clients", "GET"))
      ).toBe(false);
    });
  });
});
