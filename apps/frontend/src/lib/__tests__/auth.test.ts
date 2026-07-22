import {
  decodeJwt,
  getRoleFromToken,
  getBusinessIdFromToken,
  authResponseSchema,
} from "../auth";

function makeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(payload);
  return `${header}.${body}.fake-signature`;
}

describe("decodeJwt", () => {
  it("decodifica el payload de un JWT valido", () => {
    const token = makeToken({ sub: "u1", role: "OWNER", businessId: "b1" });
    expect(decodeJwt(token)).toEqual({
      sub: "u1",
      role: "OWNER",
      businessId: "b1",
    });
  });

  it("devuelve null para un token malformado", () => {
    expect(decodeJwt("no-es-un-jwt")).toBeNull();
  });

  it("devuelve null para un payload que no es JSON valido", () => {
    expect(decodeJwt("header.###.signature")).toBeNull();
  });

  it("descarta el payload entero si role no es un Role valido (fail closed)", () => {
    const token = makeToken({ sub: "u1", role: "SUPER_HACKER" });
    expect(decodeJwt(token)).toBeNull();
  });

  it("descarta el payload si exp no tiene el tipo esperado", () => {
    const token = makeToken({ role: "OWNER", exp: "no-es-un-numero" });
    expect(decodeJwt(token)).toBeNull();
  });

  it("acepta un payload completo con todos los campos validos", () => {
    const token = makeToken({
      sub: "u1",
      email: "a@b.com",
      role: "PROFESSIONAL",
      businessId: "biz-1",
      exp: 9999999999,
      iat: 1000,
    });
    expect(decodeJwt(token)).toEqual({
      sub: "u1",
      email: "a@b.com",
      role: "PROFESSIONAL",
      businessId: "biz-1",
      exp: 9999999999,
      iat: 1000,
    });
  });
});

describe("getRoleFromToken", () => {
  it("extrae el rol del payload", () => {
    const token = makeToken({ role: "ADMIN" });
    expect(getRoleFromToken(token)).toBe("ADMIN");
  });

  it("devuelve null si el payload no tiene rol", () => {
    const token = makeToken({ sub: "u1" });
    expect(getRoleFromToken(token)).toBeNull();
  });
});

describe("getBusinessIdFromToken", () => {
  it("extrae el businessId del payload", () => {
    const token = makeToken({ businessId: "biz-123" });
    expect(getBusinessIdFromToken(token)).toBe("biz-123");
  });

  it("devuelve null si el payload no tiene businessId", () => {
    const token = makeToken({ sub: "u1" });
    expect(getBusinessIdFromToken(token)).toBeNull();
  });
});

describe("authResponseSchema", () => {
  it("acepta una respuesta valida de login/register", () => {
    const result = authResponseSchema.safeParse({
      user: { id: "u1", email: "a@b.com", name: "Ana" },
      accessToken: "token123",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza una respuesta sin accessToken", () => {
    const result = authResponseSchema.safeParse({
      user: { id: "u1", email: "a@b.com", name: "Ana" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una respuesta con user incompleto", () => {
    const result = authResponseSchema.safeParse({
      user: { id: "u1" },
      accessToken: "token123",
    });
    expect(result.success).toBe(false);
  });
});
