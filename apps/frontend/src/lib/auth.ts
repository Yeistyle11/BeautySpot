// Esquemas de validación y utilidades de sesión: decodifican y validan el JWT
// del backend antes de que su contenido alimente el estado y los permisos.
import { z } from "zod";

/**
 * Cookie httpOnly con el access token, emitida por el gateway. El JavaScript de
 * la pagina no puede leerla; middleware.ts si, porque corre en el servidor.
 */
export const AUTH_COOKIE_NAME = "bs_access";

/**
 * Cookie legible con datos no sensibles de la sesion (rol, negocio, caducidad).
 * No es una credencial: solo evita que la interfaz tenga que adivinar con que
 * permisos entra el usuario. La autorizacion la decide siempre el backend.
 */
export const SESSION_HINT_COOKIE = "bs_session";

const ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "PROFESSIONAL",
  "RECEPTIONIST",
  "CLIENT",
] as const;

// Todos los campos son opcionales porque un JWT puede traer solo un
// subconjunto (ej. durante refresh). Si un campo SI viene, debe tener la
// forma correcta -- en particular `role`, que alimenta directamente
// canAccess/canDo (lib/permissions.ts). Un payload que no matchea se
// descarta entero (fail closed) en vez de dejar pasar un valor de rol
// invalido silenciosamente.
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

// La respuesta de /auth/login y /auth/register es el origen de todo el
// estado de sesion/rol de la app (setAuth/setRole/setBusinessId en
// lib/store.ts parten de aca). Se valida en runtime porque un cambio de
// contrato del backend aca rompe silenciosamente cosas mas adelante
// (ej. un `undefined.role`) en vez de fallar con un mensaje claro.
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
});

/**
 * Respuesta de /auth/login y /auth/register.
 *
 * No trae tokens: el gateway los convierte en cookies httpOnly antes de que la
 * respuesta llegue al navegador. En su lugar devuelve `session`, con los datos
 * no sensibles que la interfaz necesita para saber qué pintar.
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
