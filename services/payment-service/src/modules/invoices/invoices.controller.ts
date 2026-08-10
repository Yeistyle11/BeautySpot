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
import {
  Roles,
  BusinessId,
  CurrentUser,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { Role, InvoiceStatus } from "@beautyspot/shared-types";
import { parsePaginationQuery } from "@beautyspot/shared-utils";

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
    const pagination = parsePaginationQuery(query, ["createdAt", "total"]);
    return this.service.findByBusiness(
      businessId,
      {
        status: query.status as InvoiceStatus,
        from: query.from as string,
        to: query.to as string,
      },
      pagination
    );
  }

  /** Facturas del cliente autenticado, de todos los negocios donde compró. */
  @Get("mine")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async findMine(
    @CurrentUser("userId") userId: string,
    @Query() query: Record<string, unknown>
  ) {
    const pagination = parsePaginationQuery(query, ["createdAt", "total"]);
    return this.service.findByClientUser(userId, pagination);
  }

  /** Descarga el PDF de una factura propia del cliente. */
  @Get("mine/:id/pdf")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @HttpCode(HttpStatus.OK)
  async generateMyPdf(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.service.generateMyInvoicePdf(id, userId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=factura-${id}.pdf`
    );
    res.send(pdfBuffer);
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
