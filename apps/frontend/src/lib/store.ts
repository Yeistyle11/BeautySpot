import { create } from "zustand";
import { setCachedToken } from "./api";
import { decodeJwt, AUTH_COOKIE_NAME } from "./auth";

export type Role =
  | "SUPER_ADMIN"
  | "OWNER"
  | "ADMIN"
  | "PROFESSIONAL"
  | "RECEPTIONIST"
  | "CLIENT";

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  businessId: string | null;
  role: Role | null;
  setAuth: (token: string, user: User) => void;
  setBusinessId: (id: string) => void;
  setRole: (role: Role) => void;
  logout: () => void;
  hydrated: boolean;
  hydrate: () => void;
}

const KEYS = {
  token: "auth:v1:token",
  user: "auth:v1:user",
  businessId: "auth:v1:businessId",
  role: "auth:v1:role",
} as const;

const LEGACY_KEYS = {
  token: "token",
  user: "user",
  businessId: "businessId",
  role: "role",
} as const;

function migrateLegacyKeys(): void {
  if (typeof window === "undefined") return;
  (Object.keys(LEGACY_KEYS) as (keyof typeof LEGACY_KEYS)[]).forEach((k) => {
    const legacy = localStorage.getItem(LEGACY_KEYS[k]);
    if (legacy !== null && localStorage.getItem(KEYS[k]) === null) {
      localStorage.setItem(KEYS[k], legacy);
    }
    if (legacy !== null) localStorage.removeItem(LEGACY_KEYS[k]);
  });
}

function safeParse<T>(value: string | null): T | null {
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readRole(): Role | null {
  const raw = localStorage.getItem(KEYS.role);
  if (!raw) return null;
  return raw as Role;
}

// Cookie no-httpOnly que espeja el token de localStorage: la unica razon de
// que exista es dejarle algo legible a middleware.ts (corre en el Edge, sin
// acceso a localStorage) para redirigir por rol antes de renderizar. No es
// un limite de seguridad nuevo (misma exposicion a XSS que hoy); la
// autorizacion real la sigue validando el api-gateway via el header JWT.
function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;
  const exp = decodeJwt(token)?.exp;
  const maxAge = exp
    ? Math.max(exp - Math.floor(Date.now() / 1000), 0)
    : 60 * 60 * 24 * 7;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Store global de sesión (Zustand). Es la fuente de verdad del token, usuario,
 * negocio y rol activos, y los sincroniza con localStorage y la cookie de sesión.
 * `hydrate` rehidrata el estado desde localStorage al cargar la app en el cliente.
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  businessId: null,
  role: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    migrateLegacyKeys();
    const token = localStorage.getItem(KEYS.token);
    const user = safeParse<User>(localStorage.getItem(KEYS.user));
    const businessId = localStorage.getItem(KEYS.businessId);
    const role = readRole();
    setCachedToken(token);
    if (token) setAuthCookie(token);
    set({ token, user, businessId, role, hydrated: true });
  },
  setAuth: (token, user) => {
    localStorage.setItem(KEYS.token, token);
    localStorage.setItem(KEYS.user, JSON.stringify(user));
    setCachedToken(token);
    setAuthCookie(token);
    set({ token, user });
  },
  setBusinessId: (id) => {
    localStorage.setItem(KEYS.businessId, id);
    set({ businessId: id });
  },
  setRole: (role) => {
    localStorage.setItem(KEYS.role, role);
    set({ role });
  },
  logout: () => {
    (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) =>
      localStorage.removeItem(KEYS[k])
    );
    setCachedToken(null);
    clearAuthCookie();
    set({ token: null, user: null, businessId: null, role: null });
  },
}));
