import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import { InvoiceStatus } from "@beautyspot/shared-types";
import { CreateInvoiceDto } from "./dto/invoice.dto";
import { PdfService } from "./pdf/pdf.service";

/** Gestiona las facturas del negocio: creación con numeración propia, consulta y generación de PDF. */
@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(InvoiceItemEntity)
    private readonly itemRepo: Repository<InvoiceItemEntity>,
    private readonly pdfService: PdfService
  ) {}

  /** Crea una factura calculando los totales de sus líneas y asignándole un número. */
  async create(
    businessId: string,
    dto: CreateInvoiceDto
  ): Promise<InvoiceEntity> {
    const number = await this.generateInvoiceNumber(businessId);
    const date = dto.date || new Date().toISOString().split("T")[0];
    const dueDate = dto.dueDate || this.getDefaultDueDate();

    let total = 0;
    const items = dto.items.map((item) => {
      const itemTotal = Number(item.quantity) * Number(item.unitPrice);
      total += itemTotal;
      return this.itemRepo.create({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal,
      });
    });

    const invoice = this.invoiceRepo.create({
      businessId,
      clientId: dto.clientId,
      number,
      date,
      dueDate,
      total,
      notes: dto.notes,
      status: InvoiceStatus.DRAFT,
      items,
    });

    return this.invoiceRepo.save(invoice);
  }

  /** Lista las facturas del negocio con sus líneas, opcionalmente filtradas por estado. */
  async findByBusiness(
    businessId: string,
    filters?: { status?: InvoiceStatus; from?: string; to?: string }
  ) {
    const where: Record<string, unknown> = { businessId };
    if (filters?.status) where.status = filters.status;

    return this.invoiceRepo.find({
      where,
      relations: ["items"],
      order: { createdAt: "DESC" },
    });
  }

  /** Obtiene una factura con sus líneas; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, businessId },
      relations: ["items"],
    });
    if (!invoice) throw new NotFoundException("Factura no encontrada");
    return invoice;
  }

  /** Cambia el estado de una factura (borrador, emitida, pagada, etc.). */
  async updateStatus(
    id: string,
    businessId: string,
    status: InvoiceStatus
  ): Promise<InvoiceEntity> {
    await this.invoiceRepo.update({ id, businessId }, { status });
    return this.findById(id, businessId);
  }

  /** Compone los datos de la factura y delega en PdfService para generar el PDF. */
  async generateInvoicePdf(
    invoiceId: string,
    businessId: string
  ): Promise<Buffer> {
    const invoice = await this.findById(invoiceId, businessId);

    const invoiceData = {
      invoiceNumber: invoice.number,
      invoiceDate: new Date(invoice.date),
      dueDate: new Date(invoice.dueDate),
      business: {
        name: "BeautySpot Business",
        nit: "900123456-1",
        address: "Calle 123 #45-67, Bogotá",
        phone: "+57 300 123 4567",
        email: "info@beautyspot.co",
      },
      client: {
        name: "Cliente",
        document: "123456789",
      },
      items: invoice.items.map((item) => ({
        name: item.description,
        quantity: Number(item.quantity),
        price: Number(item.unitPrice),
      })),
      subtotal: Number(invoice.total) * 0.84,
      tax: Number(invoice.total) * 0.16,
      total: Number(invoice.total),
      paymentMethod: "Efectivo",
      notes: invoice.notes,
    };

    return this.pdfService.generateInvoicePdf(invoiceData);
  }

  /** Genera el número correlativo de factura del negocio con el formato INV-{año}-{secuencia}. */
  private async generateInvoiceNumber(businessId: string): Promise<string> {
    const count = await this.invoiceRepo.count({ where: { businessId } });
    const seq = String(count + 1).padStart(6, "0");
    const year = new Date().getFullYear();
    return `INV-${year}-${seq}`;
  }

  /** Fecha de vencimiento por defecto: 30 días desde hoy. */
  private getDefaultDueDate(): string {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return due.toISOString().split("T")[0];
  }
}
