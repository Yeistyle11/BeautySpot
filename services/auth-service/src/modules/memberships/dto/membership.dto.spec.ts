import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Role } from "@beautyspot/shared-types";
import { CrearMembresiaInternaDto } from "./membership.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = {
  type: "body" as const,
  metatype: CrearMembresiaInternaDto,
};

const alta = {
  userId: "b0a0a0a0-0000-4000-8000-000000000001",
  businessId: "b0a0a0a0-0000-4000-8000-000000000002",
  role: Role.OWNER,
};

describe("CrearMembresiaInternaDto", () => {
  it("acepta el alta que manda otro servicio", async () => {
    await expect(
      pipe.transform({ ...alta, invitedBy: "quien-invita" }, metadata)
    ).resolves.toMatchObject({ role: Role.OWNER, invitedBy: "quien-invita" });
  });

  it("acepta el alta sin quien invita", async () => {
    await expect(pipe.transform(alta, metadata)).resolves.toMatchObject({
      role: Role.OWNER,
    });
  });

  // Es el endpoint que concede roles: con la intersección de antes el pipe no
  // miraba nada, ni siquiera esto.
  it("rechaza conceder SUPER_ADMIN", async () => {
    await expect(
      pipe.transform({ ...alta, role: Role.SUPER_ADMIN }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza los campos que no declara", async () => {
    await expect(
      pipe.transform({ ...alta, active: true }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exige que quien invita sea texto", async () => {
    await expect(
      pipe.transform({ ...alta, invitedBy: 7 }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
