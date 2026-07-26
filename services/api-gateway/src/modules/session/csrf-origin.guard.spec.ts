import { ConfigService } from "@nestjs/config";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { CsrfOriginGuard } from "./csrf-origin.guard";
import { ACCESS_COOKIE } from "./session-cookies";

const config = (origenes?: string) =>
  ({ get: () => origenes }) as unknown as ConfigService;

function contexto(opciones: {
  method?: string;
  origin?: string;
  referer?: string;
  conCookie?: boolean;
  authorization?: string;
}): ExecutionContext {
  const headers: Record<string, string> = {};
  if (opciones.origin) headers.origin = opciones.origin;
  if (opciones.referer) headers.referer = opciones.referer;
  if (opciones.conCookie) headers.cookie = `${ACCESS_COOKIE}=token-abc`;
  if (opciones.authorization) headers.authorization = opciones.authorization;

  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: opciones.method ?? "POST",
        path: "/api/v1/core/businesses",
        headers,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("CsrfOriginGuard", () => {
  const guard = new CsrfOriginGuard(config("https://beautyspot.co"));
  const entornoOriginal = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    jest.spyOn(guard["logger"], "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = entornoOriginal;
  });

  it("permite una mutación desde un origen configurado", () => {
    const permitido = guard.canActivate(
      contexto({ origin: "https://beautyspot.co", conCookie: true })
    );

    expect(permitido).toBe(true);
  });

  // El ataque que esto evita: una página ajena que dispara un POST y el
  // navegador adjunta la cookie de sesión por su cuenta.
  it("rechaza una mutación con cookie desde un origen ajeno", () => {
    expect(() =>
      guard.canActivate(
        contexto({ origin: "https://sitio-malicioso.com", conCookie: true })
      )
    ).toThrow(ForbiddenException);
  });

  it("no interfiere en las lecturas", () => {
    const permitido = guard.canActivate(
      contexto({
        method: "GET",
        origin: "https://sitio-malicioso.com",
        conCookie: true,
      })
    );

    expect(permitido).toBe(true);
  });

  // Una petición con cabecera Authorization no la envía el navegador sola, así
  // que no se puede falsificar desde otro sitio.
  it("no afecta a quien se autentica con cabecera Authorization", () => {
    const permitido = guard.canActivate(
      contexto({
        origin: "https://sitio-malicioso.com",
        authorization: "Bearer token-abc",
      })
    );

    expect(permitido).toBe(true);
  });

  it("recurre al Referer cuando no hay Origin", () => {
    expect(() =>
      guard.canActivate(
        contexto({
          referer: "https://sitio-malicioso.com/una/pagina",
          conCookie: true,
        })
      )
    ).toThrow(ForbiddenException);
  });

  it("deja pasar una petición sin Origin ni Referer", () => {
    // Los navegadores mandan Origin en toda mutación desde una página, así que
    // su ausencia indica un cliente que no es un navegador.
    expect(guard.canActivate(contexto({ conCookie: true }))).toBe(true);
  });

  it("acepta localhost fuera de producción", () => {
    process.env.NODE_ENV = "development";

    const permitido = guard.canActivate(
      contexto({ origin: "http://localhost:8080", conCookie: true })
    );

    expect(permitido).toBe(true);
  });

  it("rechaza localhost en producción", () => {
    expect(() =>
      guard.canActivate(
        contexto({ origin: "http://localhost:8080", conCookie: true })
      )
    ).toThrow(ForbiddenException);
  });

  it("tolera un Referer que no es una URL válida", () => {
    expect(
      guard.canActivate(contexto({ referer: "no-es-url", conCookie: true }))
    ).toBe(true);
  });
});
