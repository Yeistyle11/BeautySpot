import { create } from "zustand";

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

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  businessId: null,
  role: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    const businessId = localStorage.getItem("businessId");
    const role = localStorage.getItem("role") as Role | null;
    set({
      token,
      user: user ? JSON.parse(user) : null,
      businessId,
      role,
      hydrated: true,
    });
  },
  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, user });
  },
  setBusinessId: (id) => {
    localStorage.setItem("businessId", id);
    set({ businessId: id });
  },
  setRole: (role) => {
    localStorage.setItem("role", role);
    set({ role });
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("businessId");
    localStorage.removeItem("role");
    set({ token: null, user: null, businessId: null, role: null });
  },
}));
