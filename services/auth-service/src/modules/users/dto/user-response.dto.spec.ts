import { instanceToPlain } from "class-transformer";
import { toSafeUser } from "./user-response.dto";
import { User } from "../../../entities/user.entity";
import { PasswordReset } from "../../../entities/password-reset.entity";
import { EmailVerification } from "../../../entities/email-verification.entity";

/** Un usuario tal y como sale del repositorio, con todo lo suyo dentro. */
function usuarioGuardado(): User {
  const user = new User();
  Object.assign(user, {
    id: "user-123",
    email: "duena@example.com",
    name: "Dueña",
    phone: "+57 300 000 0000",
    password: "$2b$12$hash",
    emailVerified: true,
    active: true,
    tokenVersion: 7,
    failedLoginAttempts: 3,
    lockoutCount: 2,
    lockedUntil: new Date(),
  });
  return user;
}

/**
 * Lo que no debe salir de auth en ninguna respuesta. La contraseña es lo obvio;
 * el resto es maquinaria de la sesión que además viajaba en el listado de
 * personal, o sea publicando el estado de seguridad de cuentas ajenas.
 */
const PROHIBIDOS = [
  "password",
  "tokenVersion",
  "failedLoginAttempts",
  "lockoutCount",
  "lockedUntil",
];

describe("toSafeUser", () => {
  it("no deja salir nada de la maquinaria de la sesión", () => {
    const seguro = toSafeUser(usuarioGuardado()) as Record<string, unknown>;

    for (const campo of PROHIBIDOS) {
      expect(seguro).not.toHaveProperty(campo);
    }
  });

  it("conserva lo que la interfaz sí necesita", () => {
    const seguro = toSafeUser(usuarioGuardado());

    expect(seguro.id).toBe("user-123");
    expect(seguro.email).toBe("duena@example.com");
    expect(seguro.name).toBe("Dueña");
    expect(seguro.emailVerified).toBe(true);
  });

  it("tampoco sale si la entidad viaja entera por el serializador", () => {
    // La otra mitad de la defensa: lo que devuelve la entidad cruda pasa por
    // ClassSerializerInterceptor, que aplica los @Exclude().
    const serializado = instanceToPlain(usuarioGuardado());

    for (const campo of PROHIBIDOS) {
      expect(serializado).not.toHaveProperty(campo);
    }
  });
});

describe("tokens de un solo uso", () => {
  it("el hash del enlace no sale en ninguna respuesta", () => {
    const reset = Object.assign(new PasswordReset(), {
      userId: "user-123",
      tokenHash: "abc123",
    });
    const verificacion = Object.assign(new EmailVerification(), {
      userId: "user-123",
      tokenHash: "def456",
    });

    expect(instanceToPlain(reset)).not.toHaveProperty("tokenHash");
    expect(instanceToPlain(verificacion)).not.toHaveProperty("tokenHash");
  });
});
