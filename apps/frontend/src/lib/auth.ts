import type { Role } from "./store";

export const AUTH_COOKIE_NAME = "bs_token";

export interface JwtPayload {
  sub?: string;
  email?: string;
  role?: Role;
  businessId?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  if (typeof atob === "function") {
    return atob(padded);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf-8");
  }
  throw new Error("No hay mecanismo disponible para decodificar base64");
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string): Role | null {
  return decodeJwt(token)?.role ?? null;
}

export function getBusinessIdFromToken(token: string): string | null {
  return decodeJwt(token)?.businessId ?? null;
}
