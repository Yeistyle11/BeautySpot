import { Roles, ROLES_KEY } from "./roles.decorator";
import { Role } from "@beautyspot/shared-types";

describe("Roles Decorator", () => {
  it("debería ser una función", () => {
    expect(typeof Roles).toBe("function");
  });

  it("debería funcionar con la constante ROLES_KEY exportada", () => {
    expect(ROLES_KEY).toBe("roles");
  });

  it("debería crear metadata cuando se aplica a una clase", () => {
    @Roles(Role.ADMIN, Role.OWNER)
    class TestClass {
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual([Role.ADMIN, Role.OWNER]);
  });

  it("debería crear metadata con un solo rol", () => {
    @Roles(Role.ADMIN)
    class TestClass {
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual([Role.ADMIN]);
  });

  it("debería aceptar roles del enum Role", () => {
    @Roles(Role.ADMIN, Role.OWNER)
    class TestClass {
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toContain(Role.ADMIN);
    expect(metadata).toContain(Role.OWNER);
  });

  it("debería manejar array vacío si no se proporcionan roles", () => {
    @Roles()
    class TestClass {
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass);
    expect(metadata).toEqual([]);
  });
});
