import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { Internal } from "@beautyspot/nest-common";
import { InvoicesService } from "./invoices.service";

/**
 * Facturas para otros servicios (`x-internal-secret`). El correo de la factura
 * pide aquí su PDF para adjuntarlo, el mismo que se descarga desde el panel.
 */
@Internal()
@Controller("internal/invoices")
export class InternalInvoicesController {
  constructor(private readonly service: InvoicesService) {}

  /** PDF de una factura del negocio indicado; 404 si no es suya. */
  @Get(":id/pdf")
  async pdf(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("businessId", ParseUUIDPipe) businessId: string,
    @Res() res: Response
  ) {
    const pdf = await this.service.generateInvoicePdf(id, businessId);
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  }
}
