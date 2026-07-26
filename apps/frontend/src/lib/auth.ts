// Esquemas de validación y utilidades de sesión: decodifican y validan el JWT
// del backend antes de que su contenido alimente el estado y los permisos.
import { z } from "zod";

/** Cookie httpOnly con el access token, emitida por el gateway. */
export const AUTH_COOKIE_NAME = "bs_access";

/** Cookie legible con datos no sensibles de la sesión: rol, negocio y caducidad. */
export const SESSION_HINT_COOKIE = "bs_session";

const ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "PROFESSIONAL",
  "RECEPTIONIST",
  "CLIENT",
] as const;

// Campos opcionales: un JWT puede traer solo un subconjunto. Un payload que no
// encaja se descarta entero.
const jwtPayloadSchema = z
  .object({
    sub: z.string(),
    email: z.string(),
    role: z.enum(ROLES),
    businessId: z.string(),
    exp: z.number(),
    iat: z.number(),
  })
  .partial();

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

// Usuario que devuelven /auth/login y /auth/register, validado en runtime.
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
});

/**
 * Respuesta de /auth/login y /auth/register: sin tokens y con `session`, los
 * datos no sensibles que necesita la interfaz.
 */
export const authResponseSchema = z.object({
  user: userSchema,
  session: z
    .object({
      role: z.enum(ROLES).optional(),
      businessId: z.string().optional(),
      expiresAt: z.number().optional(),
    })
    .optional(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

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

/** Decodifica y valida el payload del JWT; devuelve null si es inválido o no matchea el esquema. */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const raw: unknown = JSON.parse(base64UrlDecode(parts[1]));
    const result = jwtPayloadSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Extrae el rol del token, o null si no está presente o el token es inválido. */
export function getRoleFromToken(token: string): JwtPayload["role"] | null {
  return decodeJwt(token)?.role ?? null;
}

/** Extrae el businessId del token, o null si no está presente o el token es inválido. */
export function getBusinessIdFromToken(token: string): string | null {
  return decodeJwt(token)?.businessId ?? null;
}
