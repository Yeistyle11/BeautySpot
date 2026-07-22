import {
  canAccess,
  canDo,
  getPagesForRole,
  getDefaultPath,
  PAGES,
  ACTIONS,
} from "../permissions";

describe("canAccess", () => {
  it("niega el acceso cuando no hay rol", () => {
    expect(canAccess(null, "/dashboard")).toBe(false);
  });

  it("niega el acceso a una ruta que no existe en PAGES", () => {
    expect(canAccess("OWNER", "/dashboard/ruta-inexistente")).toBe(false);
  });

  it("permite el acceso cuando el rol esta en la lista de la pagina", () => {
    expect(canAccess("OWNER", "/dashboard/services")).toBe(true);
  });

  it("niega el acceso cuando el rol no esta en la lista de la pagina", () => {
    expect(canAccess("CLIENT", "/dashboard/services")).toBe(false);
  });

  it("solo matchea /dashboard exacto, no subrutas, para la entrada raiz", () => {
    expect(canAccess("CLIENT", "/dashboard")).toBe(false);
    expect(canAccess("OWNER", "/dashboard")).toBe(true);
  });

  it("matchea subrutas por prefijo para paginas no raiz", () => {
    expect(canAccess("OWNER", "/dashboard/services/algo-mas")).toBe(true);
  });
});

describe("canDo", () => {
  it("niega la accion cuando no hay rol", () => {
    expect(canDo(null, "services_create")).toBe(false);
  });

  it("permite la accion cuando el rol esta autorizado", () => {
    expect(canDo("OWNER", "services_create")).toBe(true);
  });

  it("niega la accion cuando el rol no esta autorizado", () => {
    expect(canDo("CLIENT", "services_create")).toBe(false);
  });

  it("cubre todas las acciones definidas en ACTIONS", () => {
    for (const action of Object.keys(ACTIONS)) {
      expect(typeof canDo("OWNER", action)).toBe("boolean");
    }
  });

  it("devuelve false para una accion no definida en ACTIONS", () => {
    expect(canDo("OWNER", "accion_inexistente")).toBe(false);
  });
});

describe("getPagesForRole", () => {
  it("devuelve un arreglo vacio cuando no hay rol", () => {
    expect(getPagesForRole(null)).toEqual([]);
  });

  it("devuelve solo las paginas accesibles para el rol", () => {
    const pages = getPagesForRole("CLIENT");
    expect(pages.every((p) => p.roles.includes("CLIENT"))).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
  });
});

describe("getDefaultPath", () => {
  it("devuelve /dashboard cuando no hay rol", () => {
    expect(getDefaultPath(null)).toBe("/dashboard");
  });

  it("devuelve la primera pagina accesible para el rol", () => {
    const expected = getPagesForRole("CLIENT")[0].path;
    expect(getDefaultPath("CLIENT")).toBe(expected);
  });

  it("devuelve una ruta valida para cada rol conocido", () => {
    const roles = [
      "SUPER_ADMIN",
      "OWNER",
      "ADMIN",
      "PROFESSIONAL",
      "RECEPTIONIST",
      "CLIENT",
    ] as const;
    for (const role of roles) {
      const path = getDefaultPath(role);
      expect(PAGES.some((p) => p.path === path)).toBe(true);
    }
  });
});
