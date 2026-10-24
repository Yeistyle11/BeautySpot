import { NotFoundException } from "@nestjs/common";
import { InternalInvoicesController } from "./internal-invoices.controller";
import { InvoicesService } from "./invoices.service";

describe("InternalInvoicesController", () => {
  const service = {
    generateInvoicePdf: jest.fn(),
  } as unknown as jest.Mocked<InvoicesService>;
  const controller = new InternalInvoicesController(service);
  const res = { setHeader: jest.fn(), send: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it("responde el PDF de la factura del negocio", async () => {
    const pdf = Buffer.from("%PDF");
    service.generateInvoicePdf.mockResolvedValue(pdf);

    await controller.pdf("f-1", "b-1", res as never);

    expect(service.generateInvoicePdf).toHaveBeenCalledWith("f-1", "b-1");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/pdf"
    );
    expect(res.send).toHaveBeenCalledWith(pdf);
  });

  // La factura se busca dentro del negocio: con otro, no aparece.
  it("deja pasar el 404 de una factura que no es de ese negocio", async () => {
    service.generateInvoicePdf.mockRejectedValue(
      new NotFoundException("Factura no encontrada")
    );

    await expect(controller.pdf("f-1", "otro", res as never)).rejects.toThrow(
      NotFoundException
    );
    expect(res.send).not.toHaveBeenCalled();
  });
});
