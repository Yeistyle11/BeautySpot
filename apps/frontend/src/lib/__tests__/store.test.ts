/**
 * Store de sesion: usuario, negocio y rol con los que se pinta el panel. Lo que
 * importa es de donde sale cada dato al hidratar: la pista que escribe el
 * gateway manda sobre el localStorage, que puede ser de una sesion anterior.
 */
import { useAuthStore, type User } from "../store";
import { SESSION_HINT_COOKIE } from "../auth";

const usuario: User = {
  id: "user-1",
  email: "duena@ejemplo.com",
  name: "Ana",
};

/** Deja en el documento la cookie legible que emite el gateway. */
function ponerPista(pista: object | null) {
  if (pista === null) {
    document.cookie = `${SESSION_HINT_COOKIE}=; max-age=0; path=/`;
    return;
  }
  document.cookie = `${SESSION_HINT_COOKIE}=${encodeURIComponent(
    JSON.stringify(pista)
  )}; path=/`;
}

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    ponerPista(null);
    useAuthStore.setState({
      user: null,
      businessId: null,
      role: null,
      hydrated: false,
    });
  });

  describe("hidratacion", () => {
    it("se hidrata desde la pista del gateway", () => {
      ponerPista({ role: "OWNER", businessId: "biz-1" });

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().role).toBe("OWNER");
      expect(useAuthStore.getState().businessId).toBe("biz-1");
      expect(useAuthStore.getState().hydrated).toBe(true);
    });

    it("cae al almacenamiento local cuando no hay pista", () => {
      localStorage.setItem("auth:v1:role", "ADMIN");
      localStorage.setItem("auth:v1:businessId", "biz-9");

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().role).toBe("ADMIN");
      expect(useAuthStore.getState().businessId).toBe("biz-9");
    });

    it("la pista pisa lo que quedo guardado de una sesion anterior", () => {
      localStorage.setItem("auth:v1:role", "ADMIN");
      localStorage.setItem("auth:v1:businessId", "biz-viejo");
      ponerPista({ role: "CLIENT", businessId: "biz-nuevo" });

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().role).toBe("CLIENT");
      expect(useAuthStore.getState().businessId).toBe("biz-nuevo");
    });

    it("no revienta con una pista que no es JSON", () => {
      document.cookie = `${SESSION_HINT_COOKIE}=no-es-json; path=/`;

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().hydrated).toBe(true);
      expect(useAuthStore.getState().role).toBeNull();
    });

    it("descarta un usuario guardado corrupto en vez de fallar", () => {
      localStorage.setItem("auth:v1:user", "{ esto no cierra");

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().hydrated).toBe(true);
    });
  });

  describe("escritura", () => {
    // Sus datos son personales y la sesion no los necesita guardados: en un
    // equipo compartido sobrevivirian a quien los dejo.
    it("tiene al usuario solo en memoria, sin guardarlo en el navegador", () => {
      useAuthStore.getState().setAuth(usuario);

      expect(useAuthStore.getState().user).toEqual(usuario);
      expect(localStorage.getItem("auth:v1:user")).toBeNull();
      expect(
        Object.keys(localStorage).some((k) =>
          localStorage.getItem(k)?.includes(usuario.email)
        )
      ).toBe(false);
    });

    it("guarda el negocio y el rol activos", () => {
      useAuthStore.getState().setBusinessId("biz-1");
      useAuthStore.getState().setRole("RECEPTIONIST");

      expect(localStorage.getItem("auth:v1:businessId")).toBe("biz-1");
      expect(localStorage.getItem("auth:v1:role")).toBe("RECEPTIONIST");
    });
  });

  describe("logout", () => {
    it("borra el estado y lo guardado", () => {
      useAuthStore.getState().setAuth(usuario);
      useAuthStore.getState().setBusinessId("biz-1");
      useAuthStore.getState().setRole("OWNER");

      useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().businessId).toBeNull();
      expect(useAuthStore.getState().role).toBeNull();
      expect(localStorage.getItem("auth:v1:user")).toBeNull();
      expect(localStorage.getItem("auth:v1:businessId")).toBeNull();
      expect(localStorage.getItem("auth:v1:role")).toBeNull();
    });
  });
});
