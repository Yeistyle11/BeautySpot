import { Controller, Get, Post, Patch, Param, Body, Query, Req, Res, HttpCode, HttpStatus } from "@nestjs/common";
import { Response } from 'express';
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto, UpdateInvoiceStatusDto } from "./dto/invoice.dto";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("invoices")
@Roles(Role.OWNER, Role.ADMIN)
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    return this.service.create(req.businessId, dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.service.findByBusiness(req.businessId, query as any);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Req() req: any, @Body() dto: UpdateInvoiceStatusDto) {
    return this.service.updateStatus(id, req.businessId, dto.status);
  }

  @Get(":id/pdf")
  @HttpCode(HttpStatus.OK)
  async generatePdf(@Param("id") id: string, @Req() req: any, @Res() res: Response) {
    const pdfBuffer = await this.service.generateInvoicePdf(id, req.businessId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
    res.send(pdfBuffer);
  }
}
