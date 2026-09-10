/**
 * @jest-environment node
 */

/**
 * Guard de Edge de /dashboard y /login. Solo decide a donde va la navegacion:
 * la autorizacion la sigue haciendo el gateway en cada peticion. Corre en node
 * porque `next/server` necesita globales web que jsdom no expone.
 */
import { middleware } from "../../middleware";

const AHORA = Math.floor(Date.now() / 1000);

/** Token con la carga minima que el guard sabe leer. */
function token(payload: Record<string, unknown>): string {
  const base64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.firma`;
}

/** NextRequest minimo: solo se usan la ruta y las cookies. */
function peticion(
  pathname: string,
  cookies: Record<string, string>
): Parameters<typeof middleware>[0] {
  return {
    nextUrl: { pathname },
    url: `http://localhost:8080${pathname}`,
    cookies: {
      get: (nombre: string) =>
        nombre in cookies ? { value: cookies[nombre] } : undefined,
    },
  } as unknown as Parameters<typeof middleware>[0];
}

const vigente = token({
  sub: "user-1",
  email: "duena@ejemplo.com",
  role: "OWNER",
  businessId: "biz-1",
  exp: AHORA + 900,
  iat: AHORA,
});

const caducado = token({
  sub: "user-1",
  email: "duena@ejemplo.com",
  role: "OWNER",
  businessId: "biz-1",
  exp: AHORA - 60,
  iat: AHORA - 960,
});

const pista = JSON.stringify({
  role: "OWNER",
  businessId: "biz-1",
  expiresAt: AHORA - 60,
});

/** Destino de una redireccion, o null si se dejo pasar la peticion. */
function destino(respuesta: Response): string | null {
  const location = respuesta.headers.get("location");
  return location
    ? new URL(location).pathname + new URL(location).search
    : null;
}

describe("middleware", () => {
  it("deja pasar al panel con la sesion vigente", async () => {
    const res = await middleware(
      peticion("/dashboard", { bs_access: vigente })
    );

    expect(destino(res)).toBeNull();
  });

  it("manda al login sin sesion, recordando a donde iba", async () => {
    const res = await middleware(peticion("/dashboard/payments", {}));

    expect(destino(res)).toBe("/login?next=%2Fdashboard%2Fpayments");
  });

  // La cookie de refresco no llega hasta aqui —esta acotada a la ruta que la
  // canjea—, asi que el testigo de que la sesion aun se puede renovar es la
  // pista: expulsar al caducar el access corta un flujo que podia seguir.
  it("deja pasar con el access caducado si la sesion aun puede renovarse", async () => {
    const res = await middleware(
      peticion("/dashboard", { bs_access: caducado, bs_session: pista })
    );

    expect(destino(res)).toBeNull();
  });

  it("manda al login si el access caduco y no queda pista de sesion", async () => {
    const res = await middleware(
      peticion("/dashboard", { bs_access: caducado })
    );

    expect(destino(res)).toBe("/login?next=%2Fdashboard");
  });

  it("saca del panel al rol que no puede ver la seccion", async () => {
    const cliente = token({
      sub: "user-2",
      email: "cliente@ejemplo.com",
      role: "CLIENT",
      exp: AHORA + 900,
      iat: AHORA,
    });

    const res = await middleware(
      peticion("/dashboard/payments", { bs_access: cliente })
    );

    expect(destino(res)).toBe("/dashboard/client");
  });

  it("no devuelve al login a quien ya tiene sesion", async () => {
    const res = await middleware(peticion("/login", { bs_access: vigente }));

    expect(destino(res)).toBe("/dashboard");
  });

  it("deja ver el login a quien no la tiene", async () => {
    const res = await middleware(peticion("/login", {}));

    expect(destino(res)).toBeNull();
  });

  it("tampoco devuelve al registro a quien ya tiene sesion", async () => {
    const res = await middleware(peticion("/registro", { bs_access: vigente }));

    expect(destino(res)).toBe("/dashboard");
  });

  it("deja ver el registro a quien no la tiene", async () => {
    const res = await middleware(peticion("/registro", {}));

    expect(destino(res)).toBeNull();
  });

  it("ignora un token que no se puede decodificar", async () => {
    const res = await middleware(
      peticion("/dashboard", { bs_access: "esto-no-es-un-jwt" })
    );

    expect(destino(res)).toBe("/login?next=%2Fdashboard");
  });
});
