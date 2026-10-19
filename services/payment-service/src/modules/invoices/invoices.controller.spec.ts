import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

describe("InvoicesController", () => {
  const NEGOCIO = "business-123";
  const COBRO = "11111111-1111-4111-8111-111111111111";

  let service: jest.Mocked<InvoicesService>;
  let controller: InvoicesController;

  /** Roles que exige una ruta, con el mismo criterio que `RolesGuard`. */
  const rolesDe = (metodo: keyof InvoicesController) =>
    new Reflector().getAllAndOverride<Role[]>(ROLES_KEY, [
      InvoicesController.prototype[metodo],
      InvoicesController,
    ]);

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: "inv-1" }),
    } as unknown as jest.Mocked<InvoicesService>;
    controller = new InvoicesController(service);
  });

  it("recepción emite la factura de un cobro", async () => {
    await controller.create(NEGOCIO, Role.RECEPTIONIST, { paymentId: COBRO });

    expect(service.create).toHaveBeenCalledWith(NEGOCIO, {
      paymentId: COBRO,
    });
  });

  it("recepción no escribe facturas a mano", async () => {
    await expect(
      controller.create(NEGOCIO, Role.RECEPTIONIST, {
        clientId: "cli-1",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      })
    ).rejects.toThrow(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("el dueño puede escribir una factura a mano", async () => {
    const dto = {
      clientId: "cli-1",
      items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
    };

    await controller.create(NEGOCIO, Role.OWNER, dto);

    expect(service.create).toHaveBeenCalledWith(NEGOCIO, dto);
  });

  it("recepción puede emitir y descargar, pero no cambiar el estado", () => {
    expect(rolesDe("create")).toContain(Role.RECEPTIONIST);
    expect(rolesDe("generatePdf")).toContain(Role.RECEPTIONIST);
    expect(rolesDe("updateStatus")).not.toContain(Role.RECEPTIONIST);
  });
});
