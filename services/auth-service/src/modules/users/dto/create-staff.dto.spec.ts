import { validate } from "class-validator";
import { Role } from "@beautyspot/shared-types";
import { CreateStaffDto } from "./create-staff.dto";

/** Construye un DTO válido y le aplica los cambios indicados. */
function build(overrides: Partial<CreateStaffDto> = {}): CreateStaffDto {
  return Object.assign(new CreateStaffDto(), {
    email: "nuevo@negocio.com",
    password: "ClaveSegura9",
    name: "Nuevo Staff",
    role: Role.PROFESSIONAL,
    ...overrides,
  });
}

describe("CreateStaffDto", () => {
  it("acepta los roles que un administrador puede asignar", async () => {
    const asignables = [
      Role.OWNER,
      Role.ADMIN,
      Role.PROFESSIONAL,
      Role.RECEPTIONIST,
      Role.CLIENT,
    ];

    for (const role of asignables) {
      const errores = await validate(build({ role }));
      expect(errores).toHaveLength(0);
    }
  });

  it("rechaza SUPER_ADMIN para que un admin no pueda escalar privilegios", async () => {
    const errores = await validate(build({ role: Role.SUPER_ADMIN }));

    expect(errores).toHaveLength(1);
    expect(errores[0].property).toBe("role");
    expect(Object.values(errores[0].constraints ?? {})).toContain(
      "No se puede asignar el rol SUPER_ADMIN"
    );
  });

  it("rechaza un rol inexistente", async () => {
    const errores = await validate(build({ role: "ROOT" as Role }));

    expect(errores).toHaveLength(1);
    expect(errores[0].property).toBe("role");
  });
});
