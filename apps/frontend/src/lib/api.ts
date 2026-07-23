import { ApiError } from "./api-error";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

let cachedToken: string | null = null;
let tokenCacheInitialized = false;

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  if (!tokenCacheInitialized) {
    cachedToken = localStorage.getItem("auth:v1:token");
    tokenCacheInitialized = true;
  }
  return cachedToken;
}

export function setCachedToken(token: string | null): void {
  cachedToken = token;
  tokenCacheInitialized = true;
  if (typeof window === "undefined") return;
  if (token === null) {
    localStorage.removeItem("auth:v1:token");
  } else {
    localStorage.setItem("auth:v1:token", token);
  }
}

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registra que hacer cuando el backend responde 401 (token expirado o
 * invalido). Vive aqui y no en cada pagina porque la sesion puede caducar
 * durante cualquier peticion: sin un punto unico, el usuario se queda en un
 * dashboard que ya no puede cargar nada y sin explicacion.
 */
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

async function request<T>(
  path: string,
  options?: RequestInit,
  publicMode = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (!publicMode) {
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await parseBody(res);

  if (!res.ok) {
    if (res.status === 401 && !publicMode) onUnauthorized?.();
    const error = data.error as { message?: string } | undefined;
    throw new ApiError(
      res.status,
      error?.message ||
        (data.message as string | undefined) ||
        `Error en la solicitud (${res.status})`
    );
  }
  return (data.success !== undefined ? data.data : data) as T;
}

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

export const apiPublic = {
  get: <T>(path: string) => request<T>(path, undefined, true),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, true),
};
