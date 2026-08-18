import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { SessionService } from "./session.service";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
} from "./session-cookies";

/** JWT de mentira: sólo importa el payload, que se lee sin verificar la firma. */
function tokenCon(payload: Record<string, unknown>): string {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `cabecera.${cuerpo}.firma`;
}

const config = (valores: Record<string, string> = {}) =>
  ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

const peticion = (path: string, headers: Record<string, string> = {}) =>
  ({ path, headers }) as unknown as Request;

function respuesta() {
  const cookies: Record<string, { valor: string; opciones: any }> = {};
  const borradas: string[] = [];
  const res = {
    cookie: jest.fn((nombre: string, valor: string, opciones: any) => {
      cookies[nombre] = { valor, opciones };
    }),
    clearCookie: jest.fn((nombre: string) => borradas.push(nombre)),
  } as unknown as Response;
  return { res, cookies, borradas };
}

describe("SessionService", () => {
  const service = new SessionService(
    config({ JWT_EXPIRES_IN: "15m", JWT_REFRESH_EXPIRES_IN: "7d" })
  );

  describe("esRutaDeSesion", () => {
    it.each([
      "/api/v1/auth/login",
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
      "/api/v1/auth-service/login",
    ])("reconoce %s", (ruta) => {
      expect(service.esRutaDeSesion(ruta)).toBe(true);
    });

    it("ignora el resto de rutas", () => {
      expect(service.esRutaDeSesion("/api/v1/core/businesses")).toBe(false);
    });

    it("deja el registro fuera, porque ya no emite tokens", () => {
      expect(service.esRutaDeSesion("/api/v1/auth/register")).toBe(false);
    });
  });

  describe("aplicarRespuesta", () => {
    const cuerpoLogin = {
      user: { id: "u1", email: "a@b.com" },
      accessToken: tokenCon({
        role: "OWNER",
        businessId: "b1",
        exp: 1893456000,
      }),
      refreshToken: "refresco-123",
    };

    it("fija la cookie del access token como httpOnly", () => {
      const { res, cookies } = respuesta();

      service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        cuerpoLogin
      );

      expect(cookies[ACCESS_COOKIE].opciones).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    });

    // El refresh no tiene por qué viajar en cada petición: acotarlo a su ruta
    // reduce la superficie por la que puede filtrarse.
    it("restringe la cookie de refresco a la ruta de renovación", () => {
      const { res, cookies } = respuesta();

      service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        cuerpoLogin
      );

      expect(cookies[REFRESH_COOKIE].opciones).toMatchObject({
        httpOnly: true,
        path: "/api/v1/auth/refresh",
      });
    });

    // Tan necesario como la cookie: un token en el cuerpo lo puede leer el
    // JavaScript de la página, y marcar la cookie como httpOnly no protegería nada.
    it("elimina los tokens del cuerpo de la respuesta", () => {
      const { res } = respuesta();

      const salida = service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        cuerpoLogin
      ) as Record<string, unknown>;

      expect(salida.accessToken).toBeUndefined();
      expect(salida.refreshToken).toBeUndefined();
      expect(salida.user).toEqual(cuerpoLogin.user);
    });

    it("devuelve rol y negocio para que el frontend pinte la interfaz", () => {
      const { res } = respuesta();

      const salida = service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        cuerpoLogin
      ) as { session: Record<string, unknown> };

      expect(salida.session).toEqual({
        role: "OWNER",
        businessId: "b1",
        businessIds: undefined,
        expiresAt: 1893456000,
      });
    });

    it("expone la pista de sesión en una cookie legible por el cliente", () => {
      const { res, cookies } = respuesta();

      service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        cuerpoLogin
      );

      expect(cookies[SESSION_HINT_COOKIE].opciones.httpOnly).toBe(false);
      expect(JSON.parse(cookies[SESSION_HINT_COOKIE].valor)).toMatchObject({
        role: "OWNER",
      });
    });

    it("trata igual el cuerpo envuelto en el sobre estándar", () => {
      const { res, cookies } = respuesta();

      const salida = service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        { success: true, data: cuerpoLogin }
      ) as { data: Record<string, unknown> };

      expect(cookies[ACCESS_COOKIE]).toBeDefined();
      expect(salida.data.accessToken).toBeUndefined();
    });

    it("borra las cookies al cerrar sesión", () => {
      const { res, borradas } = respuesta();

      service.aplicarRespuesta(peticion("/api/v1/auth/logout"), res, {
        ok: true,
      });

      expect(borradas).toEqual([
        ACCESS_COOKIE,
        REFRESH_COOKIE,
        SESSION_HINT_COOKIE,
      ]);
    });

    it("deja pasar sin tocar un cuerpo que no trae tokens", () => {
      const { res, cookies } = respuesta();
      const cuerpo = { user: { id: "u1" } };

      const salida = service.aplicarRespuesta(
        peticion("/api/v1/auth/login"),
        res,
        cuerpo
      );

      expect(salida).toBe(cuerpo);
      expect(Object.keys(cookies)).toHaveLength(0);
    });
  });

  describe("cuerpoReenviado", () => {
    // El refresh token es inaccesible para el frontend: lo pone el gateway
    // desde la cookie, que es lo único que el navegador envía.
    it("inyecta el refresh token de la cookie al renovar", () => {
      const req = peticion("/api/v1/auth/refresh", {
        cookie: `${REFRESH_COOKIE}=refresco-abc`,
      });

      expect(service.cuerpoReenviado(req, {})).toEqual({
        refreshToken: "refresco-abc",
      });
    });

    it("no altera el cuerpo de las demás rutas", () => {
      const cuerpo = { email: "a@b.com" };
      const req = peticion("/api/v1/auth/login");

      expect(service.cuerpoReenviado(req, cuerpo)).toBe(cuerpo);
    });
  });

  describe("la cookie sobrevive al token que lleva dentro", () => {
    const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

    /** Inicia sesión y devuelve las cookies que se escribieron. */
    function trasIniciarSesion() {
      const { res, cookies } = respuesta();
      service.aplicarRespuesta(peticion("/auth/login"), res, {
        accessToken: tokenCon({ role: "OWNER", exp: 1 }),
        refreshToken: "refresh-1",
      });
      return cookies;
    }

    // Igualarlas hacía que el navegador borrara la cookie justo al caducar el
    // token: el guard del panel no veía ni un token caducado y mandaba a login
    // a los quince minutos, con la sesión válida durante días.
    it("la cookie del access dura lo que la sesión, no lo que el token", () => {
      expect(trasIniciarSesion()[ACCESS_COOKIE].opciones.maxAge).toBe(
        SIETE_DIAS_MS
      );
    });

    it("las tres cookies caducan a la vez", () => {
      const cookies = trasIniciarSesion();

      expect(cookies[REFRESH_COOKIE].opciones.maxAge).toBe(SIETE_DIAS_MS);
      expect(cookies[SESSION_HINT_COOKIE].opciones.maxAge).toBe(SIETE_DIAS_MS);
    });

    it("el access sigue siendo httpOnly y de todo el sitio", () => {
      const opciones = trasIniciarSesion()[ACCESS_COOKIE].opciones;

      expect(opciones.httpOnly).toBe(true);
      expect(opciones.path).toBe("/");
    });
  });

  describe("una renovación rechazada cierra la sesión", () => {
    // Mientras la pista siga puesta, el guard del navegador anuncia una sesión
    // renovable y devuelve al panel a quien acaba de ser rechazado.
    it("borra las cookies si la renovación no trae tokens", () => {
      const { res, borradas } = respuesta();

      service.aplicarRespuesta(peticion("/auth/refresh"), res, {
        message: "Refresh token inválido",
      });

      expect(borradas).toEqual(
        expect.arrayContaining([
          ACCESS_COOKIE,
          REFRESH_COOKIE,
          SESSION_HINT_COOKIE,
        ])
      );
    });

    it("no las borra cuando la renovación sí trae tokens", () => {
      const { res, borradas, cookies } = respuesta();

      service.aplicarRespuesta(peticion("/auth/refresh"), res, {
        accessToken: tokenCon({ role: "OWNER", exp: 1 }),
        refreshToken: "refresh-2",
      });

      expect(borradas).toEqual([]);
      expect(cookies[ACCESS_COOKIE]).toBeDefined();
    });

    // Un login fallido no tiene sesión que cerrar: borrar ahí echaría de la
    // aplicación a quien ya estaba dentro y se equivocó al reautenticarse.
    it("no toca las cookies si el que falla es un login", () => {
      const { res, borradas } = respuesta();

      service.aplicarRespuesta(peticion("/auth/login"), res, {
        message: "Credenciales inválidas",
      });

      expect(borradas).toEqual([]);
    });
  });
});
