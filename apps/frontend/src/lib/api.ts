// Cliente HTTP del frontend contra el API Gateway. Centraliza el token de sesión,
// el parseo defensivo de respuestas y el manejo global del 401.
import { ApiError } from "./api-error";
import { useAuthStore } from "./store";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** Registra qué hacer cuando el backend responde 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

// El gateway no siempre responde JSON: un 502 devuelve HTML y un 204 no
// devuelve nada. Parsear a ciegas convertia esos casos en un
// "Unexpected token '<'" que acababa impreso en pantalla.
async function parseBody(res: Response): Promise<Record<string, unknown>> {
  if (res.status === 204) return {};
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return {};
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// Rutas que establecen la sesión: un 401 suyo significa credenciales
// rechazadas, no sesión caducada, y no se renueva.
const RUTAS_DE_SESION = ["/auth/login", "/auth/register", "/auth/refresh"];

/** Renovación en curso, compartida por las peticiones que caduquen a la vez. */
let renovacionEnCurso: Promise<boolean> | null = null;

/** Pide al gateway un token nuevo a partir de la cookie de refresco. */
async function renovarSesion(): Promise<boolean> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        renovacionEnCurso = null;
      });
  }
  return renovacionEnCurso;
}

/**
 * Ejecuta una petición al gateway y normaliza el error a {@link ApiError}.
 * Devuelve el campo `data` del sobre estándar o el cuerpo tal cual si no viene
 * envuelto. La sesión viaja en la cookie httpOnly. Ante un 401 renueva una vez
 * y repite la petición; si la renovación falla, cierra la sesión.
 */
/**
 * Negocio sobre el que va la peticion, para quien trabaja en mas de uno. El
 * gateway comprueba que el usuario tenga membresia en el.
 */
function cabeceraDeNegocio(publicMode: boolean): Record<string, string> {
  if (publicMode || typeof window === "undefined") return {};

  const businessId = useAuthStore.getState().businessId;
  return businessId ? { "X-Business-Id": businessId } : {};
}

async function request<T>(
  path: string,
  options?: RequestInit,
  publicMode = false,
  yaReintentado = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...cabeceraDeNegocio(publicMode),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await parseBody(res);

  if (!res.ok) {
    const esRutaDeSesion = RUTAS_DE_SESION.includes(path);
    if (res.status === 401 && !publicMode && !esRutaDeSesion) {
      if (!yaReintentado && (await renovarSesion())) {
        return request<T>(path, options, publicMode, true);
      }
      onUnauthorized?.();
    }
    const error = data.error as
      | { message?: string; details?: { validation?: string[] } }
      | undefined;
    const detalles = error?.details?.validation;
    throw new ApiError(
      res.status,
      error?.message ||
        (data.message as string | undefined) ||
        `Error en la solicitud (${res.status})`,
      Array.isArray(detalles) ? detalles : []
    );
  }
  return (data.success !== undefined ? data.data : data) as T;
}

/** API autenticada: añade el token Bearer a cada petición. */
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** API pública: sin token, para endpoints como el marketplace o el login. */
export const apiPublic = {
  get: <T>(path: string) => request<T>(path, undefined, true),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, true),
};
