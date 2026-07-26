import { create } from "zustand";
import { SESSION_HINT_COOKIE } from "./auth";

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
  user: User | null;
  businessId: string | null;
  role: Role | null;
  setAuth: (user: User) => void;
  setBusinessId: (id: string) => void;
  setRole: (role: Role) => void;
  logout: () => void;
  hydrated: boolean;
  hydrate: () => void;
}

const KEYS = {
  user: "auth:v1:user",
  businessId: "auth:v1:businessId",
  role: "auth:v1:role",
} as const;

const LEGACY_KEYS = {
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

/**
 * Lee la pista de sesion que emite el gateway: una cookie legible con rol y
 * negocio, sin el token. Sirve para rehidratar la interfaz cuando el
 * localStorage se ha limpiado pero la sesion del navegador sigue viva.
 */
function readSessionHint(): { role?: Role; businessId?: string } | null {
  if (typeof document === "undefined") return null;
  const entrada = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));
  if (!entrada) return null;
  try {
    return JSON.parse(
      decodeURIComponent(entrada.split("=").slice(1).join("="))
    );
  } catch {
    return null;
  }
}

/**
 * Store global de sesión (Zustand): usuario, negocio y rol activos.
 *
 * La credencial vive en una cookie httpOnly que emite el gateway, fuera del
 * alcance de este código: aquí solo está el estado que la interfaz necesita
 * para pintarse.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  businessId: null,
  role: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    migrateLegacyKeys();
    const user = safeParse<User>(localStorage.getItem(KEYS.user));
    // La pista del gateway manda sobre lo guardado: refleja la sesión que el
    // navegador tiene de verdad, mientras que el localStorage puede haber
    // quedado de una sesión anterior.
    const pista = readSessionHint();
    const businessId =
      pista?.businessId ?? localStorage.getItem(KEYS.businessId);
    const role = pista?.role ?? readRole();
    set({ user, businessId, role, hydrated: true });
  },
  setAuth: (user) => {
    localStorage.setItem(KEYS.user, JSON.stringify(user));
    set({ user });
  },
  setBusinessId: (id) => {
    localStorage.setItem(KEYS.businessId, id);
    set({ businessId: id });
  },
  setRole: (role) => {
    localStorage.setItem(KEYS.role, role);
    set({ role });
  },
  /**
   * Limpia el estado local. Las cookies de sesión las borra el gateway al
   * responder a /auth/logout: son httpOnly y el navegador no las puede tocar
   * desde aquí.
   */
  logout: () => {
    (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) =>
      localStorage.removeItem(KEYS[k])
    );
    set({ user: null, businessId: null, role: null });
  },
}));
