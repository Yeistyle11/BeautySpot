/**
 * Store de sesion: usuario, negocio y rol con los que se pinta el panel.
 *
 * Lo que importa aqui es de donde sale cada dato al hidratar. La pista que
 * escribe el gateway refleja la sesion que el navegador tiene de verdad; el
 * localStorage puede haber quedado de una sesion anterior, asi que la pista
 * manda sobre lo guardado.
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
      localStorage.setItem("auth:v1:user", JSON.stringify(usuario));

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().role).toBe("ADMIN");
      expect(useAuthStore.getState().businessId).toBe("biz-9");
      expect(useAuthStore.getState().user).toEqual(usuario);
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

    // Las claves sin prefijo son de una version anterior del store; se mueven
    // al espacio nuevo para no expulsar a quien ya tenia la sesion abierta.
    it("migra las claves antiguas y las retira", () => {
      localStorage.setItem("role", "OWNER");
      localStorage.setItem("businessId", "biz-legacy");
      localStorage.setItem("user", JSON.stringify(usuario));

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().role).toBe("OWNER");
      expect(useAuthStore.getState().businessId).toBe("biz-legacy");
      expect(localStorage.getItem("role")).toBeNull();
      expect(localStorage.getItem("auth:v1:role")).toBe("OWNER");
    });

    it("no pisa la clave nueva con la antigua", () => {
      localStorage.setItem("auth:v1:role", "ADMIN");
      localStorage.setItem("role", "OWNER");

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().role).toBe("ADMIN");
    });
  });

  describe("escritura", () => {
    it("guarda el usuario para la siguiente carga", () => {
      useAuthStore.getState().setAuth(usuario);

      expect(useAuthStore.getState().user).toEqual(usuario);
      expect(localStorage.getItem("auth:v1:user")).toBe(
        JSON.stringify(usuario)
      );
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
