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
  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error?.message || data.message || "Error en la solicitud"
    );
  }
  return data.success !== undefined ? data.data : data;
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
