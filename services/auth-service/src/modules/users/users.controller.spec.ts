import { UsersController, InternalUsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User } from "../../entities/user.entity";

const USUARIO = "user-123";
const NEGOCIO = "business-123";
const OTRO = "staff-456";

/** El usuario tal y como sale del repositorio, con su contraseña dentro. */
const usuarioGuardado = {
  id: USUARIO,
  email: "duena@example.com",
  name: "Dueña",
  password: "$2b$12$hash",
  generateId: () => {},
} as unknown as User;

describe("UsersController", () => {
  let service: jest.Mocked<UsersService>;
  let controller: UsersController;

  beforeEach(() => {
    service = {
      findById: jest.fn().mockResolvedValue(usuarioGuardado),
      updateProfile: jest.fn().mockResolvedValue({ id: USUARIO }),
      getUserMemberships: jest.fn().mockResolvedValue([]),
      findByBusiness: jest.fn().mockResolvedValue([]),
      findByIdAndBusiness: jest.fn().mockResolvedValue({ id: OTRO }),
      createStaff: jest.fn().mockResolvedValue({ id: OTRO }),
      updateStaff: jest.fn().mockResolvedValue({ id: OTRO }),
      adminResetPassword: jest.fn().mockResolvedValue(undefined),
      toggleActive: jest.fn().mockResolvedValue({ id: OTRO, active: false }),
    } as unknown as jest.Mocked<UsersService>;

    controller = new UsersController(service);
  });

  describe("perfil propio", () => {
    // Es la respuesta que ve el navegador: el hash no puede viajar en ella.
    it("no devuelve la contraseña del usuario", async () => {
      const perfil = await controller.getMe(USUARIO);

      expect(perfil).not.toHaveProperty("password");
      expect(perfil.email).toBe("duena@example.com");
    });

    // El usuario sale del token, nunca de la ruta: si no, cualquiera editaría
    // el perfil de cualquiera pasando otro id.
    it("actualiza el perfil del usuario del token", async () => {
      await controller.updateProfile(USUARIO, { name: "Nuevo nombre" });

      expect(service.updateProfile).toHaveBeenCalledWith(USUARIO, {
        name: "Nuevo nombre",
      });
    });

    it("lista las membresías del usuario del token", async () => {
      await controller.getMemberships(USUARIO);

      expect(service.getUserMemberships).toHaveBeenCalledWith(USUARIO);
    });
  });

  // El negocio lo inyecta el gateway a partir del token, y el controlador solo
  // lo pasa: es lo que impide administrar el personal de otro negocio.
  describe("personal del negocio", () => {
    it("lista el personal del negocio del token", async () => {
      await controller.listStaff(NEGOCIO);

      expect(service.findByBusiness).toHaveBeenCalledWith(NEGOCIO);
    });

    it("busca a un miembro acotado a su negocio", async () => {
      await controller.getStaffMember(OTRO, NEGOCIO);

      expect(service.findByIdAndBusiness).toHaveBeenCalledWith(OTRO, NEGOCIO);
    });

    it("da de alta al personal en el negocio del token", async () => {
      const dto = {
        email: "nuevo@example.com",
        password: "Secreta123",
        name: "Nuevo",
        role: "RECEPTIONIST",
      } as never;

      await controller.createStaff(dto, NEGOCIO);

      expect(service.createStaff).toHaveBeenCalledWith(NEGOCIO, dto);
    });

    it("actualiza a un miembro acotado a su negocio", async () => {
      await controller.updateStaff(OTRO, { name: "Cambiado" }, NEGOCIO);

      expect(service.updateStaff).toHaveBeenCalledWith(OTRO, NEGOCIO, {
        name: "Cambiado",
      });
    });

    it("restablece la contraseña dentro del negocio", async () => {
      await controller.adminResetPassword(
        OTRO,
        { newPassword: "OtraSecreta123" },
        NEGOCIO
      );

      expect(service.adminResetPassword).toHaveBeenCalledWith(
        OTRO,
        NEGOCIO,
        "OtraSecreta123"
      );
    });

    it("activa y desactiva una cuenta del negocio", async () => {
      await controller.toggleActive(OTRO, { active: false }, NEGOCIO);

      expect(service.toggleActive).toHaveBeenCalledWith(OTRO, NEGOCIO, false);
    });
  });
});

describe("InternalUsersController", () => {
  it("devuelve la versión de token que auth tiene guardada", async () => {
    const service = {
      versionDeToken: jest.fn().mockResolvedValue(4),
    } as unknown as jest.Mocked<UsersService>;

    const respuesta = await new InternalUsersController(service).tokenVersion(
      USUARIO
    );

    expect(respuesta).toEqual({ version: 4 });
    expect(service.versionDeToken).toHaveBeenCalledWith(USUARIO);
  });
});
