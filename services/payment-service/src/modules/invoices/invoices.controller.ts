import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto, UpdateInvoiceStatusDto } from "./dto/invoice.dto";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints de facturación del negocio (crear, consultar, cambiar estado y descargar PDF). */
@Controller("invoices")
@Roles(Role.OWNER, Role.ADMIN)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  /** Crea una factura para un cliente. */
  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateInvoiceDto
  ) {
    return this.service.create(businessId, dto);
  }

  /** Lista las facturas del negocio con filtros opcionales. */
  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(
    @BusinessId() businessId: string,
    @Query() query: Record<string, unknown>
  ) {
    return this.service.findByBusiness(businessId, query as any);
  }

  /** Obtiene una factura por id. */
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Cambia el estado de una factura. */
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateInvoiceStatusDto
  ) {
    return this.service.updateStatus(id, businessId, dto.status);
  }

  /** Genera y descarga el PDF de una factura. */
  @Get(":id/pdf")
  @HttpCode(HttpStatus.OK)
  async generatePdf(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.service.generateInvoicePdf(id, businessId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${id}.pdf`
    );
    res.send(pdfBuffer);
  }
}
