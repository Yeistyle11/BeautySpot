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
  phone?: string | null;
  avatar?: string | null;
}

interface AuthState {
  user: User | null;
  businessId: string | null;
  role: Role | null;
  /** Sede sobre la que se trabaja; null = el negocio entero. */
  branchId: string | null;
  setAuth: (user: User) => void;
  setBusinessId: (id: string) => void;
  setRole: (role: Role) => void;
  setSedeActiva: (id: string | null) => void;
  /** Cambia de negocio: el rol es el que el usuario tiene en ese negocio. */
  setNegocioActivo: (id: string, role: Role) => void;
  logout: () => void;
  hydrated: boolean;
  hydrate: () => void;
}

const KEYS = {
  user: "auth:v1:user",
  businessId: "auth:v1:businessId",
  role: "auth:v1:role",
  branchId: "auth:v1:branchId",
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

/** Lee de la cookie del gateway el rol y el negocio de la sesión. */
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

/** Store global de sesión (Zustand): usuario, negocio y rol activos. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  businessId: null,
  role: null,
  branchId: null,
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
    const branchId = localStorage.getItem(KEYS.branchId);
    set({ user, businessId, role, branchId, hydrated: true });
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
  setSedeActiva: (id) => {
    if (id) localStorage.setItem(KEYS.branchId, id);
    else localStorage.removeItem(KEYS.branchId);
    set({ branchId: id });
  },
  // Al cambiar de negocio se olvida la sede activa.
  setNegocioActivo: (id, role) => {
    localStorage.setItem(KEYS.businessId, id);
    localStorage.setItem(KEYS.role, role);
    localStorage.removeItem(KEYS.branchId);
    set({ businessId: id, role, branchId: null });
  },
  /** Limpia el estado local; las cookies las borra el gateway en /auth/logout. */
  logout: () => {
    (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) =>
      localStorage.removeItem(KEYS[k])
    );
    set({ user: null, businessId: null, role: null, branchId: null });
  },
}));
