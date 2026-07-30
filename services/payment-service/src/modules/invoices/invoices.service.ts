import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { Between, Repository, DataSource, EntityManager } from "typeorm";
import { paginate, PaginateParams } from "@beautyspot/database";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import { InvoiceStatus, IPaginatedResponse } from "@beautyspot/shared-types";
import { IVA } from "@beautyspot/shared-constants";
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
    private readonly pdfService: PdfService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService
  ) {}

  /** Crea una factura calculando los totales de sus líneas y asignándole un número. */
  async create(
    businessId: string,
    dto: CreateInvoiceDto
  ): Promise<InvoiceEntity> {
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

    // El número se reserva dentro de la misma transacción que la factura: si
    // esta no llega a guardarse, el número no se consume y la serie no deja
    // huecos.
    return this.dataSource.transaction(async (manager) => {
      const invoice = manager.getRepository(InvoiceEntity).create({
        businessId,
        clientId: dto.clientId,
        number: await this.generateInvoiceNumber(businessId, manager),
        date,
        dueDate,
        total,
        notes: dto.notes,
        status: InvoiceStatus.DRAFT,
        items,
      });

      const guardada = await manager.getRepository(InvoiceEntity).save(invoice);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.PAYMENT_INVOICE_GENERATED,
        aggregateType: "invoice",
        aggregateId: guardada.id,
        payload: {
          invoiceId: guardada.id,
          businessId,
          clientId: guardada.clientId,
          number: guardada.number,
          total: Number(guardada.total),
        },
      });

      return guardada;
    });
  }

  /** Lista las facturas del negocio con sus líneas, filtradas por estado y fecha, paginadas. */
  async findByBusiness(
    businessId: string,
    filters: { status?: InvoiceStatus; from?: string; to?: string },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<InvoiceEntity>> {
    const where: Record<string, unknown> = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    }

    return paginate(this.invoiceRepo, pagination, {
      where,
      relations: ["items"],
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
      // El total ya lleva el IVA incluido, así que la base se obtiene
      // dividiendo.
      subtotal: Number(invoice.total) / (1 + IVA),
      tax: Number(invoice.total) - Number(invoice.total) / (1 + IVA),
      total: Number(invoice.total),
      paymentMethod: "Efectivo",
      notes: invoice.notes,
    };

    return this.pdfService.generateInvoicePdf(invoiceData);
  }

  /**
   * Reserva el siguiente número de la serie del negocio, con formato
   * `INV-{año}-{secuencia}`, con un INSERT … ON CONFLICT DO UPDATE … RETURNING
   * que lo reserva y lo devuelve en una sola operación atómica.
   */
  private async generateInvoiceNumber(
    businessId: string,
    manager: EntityManager
  ): Promise<string> {
    const year = new Date().getFullYear();

    const [{ last_number: siguiente }] = (await manager.query(
      `INSERT INTO invoice_sequences (business_id, year, last_number)
       VALUES ($1, $2, 1)
       ON CONFLICT (business_id, year)
       DO UPDATE SET last_number = invoice_sequences.last_number + 1
       RETURNING last_number`,
      [businessId, year]
    )) as { last_number: number }[];

    return `INV-${year}-${String(siguiente).padStart(6, "0")}`;
  }

  /** Fecha de vencimiento por defecto: 30 días desde hoy. */
  private getDefaultDueDate(): string {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return due.toISOString().split("T")[0];
  }
}
