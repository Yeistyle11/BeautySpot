import { decodeJwt, getRoleFromToken, getBusinessIdFromToken } from "../auth";

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
