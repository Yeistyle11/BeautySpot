import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InternalHttpClient, OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { Between, In, Repository, DataSource, EntityManager } from "typeorm";
import { paginate, PaginateParams } from "@beautyspot/database";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import { InvoiceStatus, IPaginatedResponse } from "@beautyspot/shared-types";
import { IVA } from "@beautyspot/shared-constants";
import { CreateInvoiceDto } from "./dto/invoice.dto";
import { PdfService } from "./pdf/pdf.service";

/** Serie de numeración de quien no la haya configurado. */
const SERIE_POR_DEFECTO = "INV";

/** Estados a los que puede pasar una factura desde cada estado. */
const TRANSICIONES_DE_FACTURA: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
};

/**
 * Lo que devuelve `/internal/profiles/resolve` del core-service, acotado a lo
 * que necesita la factura.
 */
interface ProfileResolution {
  client: { name: string; documento: string } | null;
  business: {
    name: string;
    address: string;
    phone: string;
    email: string;
    facturacion: {
      nit?: string;
      razonSocial?: string;
      direccionFiscal?: string;
      serie?: string;
    };
  } | null;
}

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
    private readonly outbox: OutboxService,
    private readonly http: InternalHttpClient
  ) {}

  /** Crea una factura calculando los totales de sus líneas y asignándole un número. */
  async create(
    businessId: string,
    dto: CreateInvoiceDto
  ): Promise<InvoiceEntity> {
    const date = dto.date || new Date().toISOString().split("T")[0];
    const dueDate = dto.dueDate || this.getDefaultDueDate();

    let subtotal = 0;
    const items = dto.items.map((item) => {
      const itemTotal = Number(item.quantity) * Number(item.unitPrice);
      subtotal += itemTotal;
      return this.itemRepo.create({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal,
      });
    });

    // El impuesto y el tipo aplicado se calculan y se guardan al emitir.
    const tax = Math.round(subtotal * IVA * 100) / 100;
    const total = subtotal + tax;

    // El numero se reserva dentro de la misma transaccion que la factura, de
    // modo que la serie no deja huecos.
    return this.dataSource.transaction(async (manager) => {
      const invoice = manager.getRepository(InvoiceEntity).create({
        businessId,
        clientId: dto.clientId,
        number: await this.generateInvoiceNumber(businessId, manager),
        date,
        dueDate,
        subtotal,
        taxRate: IVA,
        tax,
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
          subtotal: Number(guardada.subtotal),
          tax: Number(guardada.tax),
          total: Number(guardada.total),
          dueDate: guardada.dueDate,
          items: guardada.items.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            total: Number(i.total),
          })),
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

  /** Facturas de todas las fichas de cliente que tenga el usuario. */
  async findByClientUser(
    userId: string,
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<InvoiceEntity>> {
    const clientIds = await this.clientIdsDelUsuario(userId);
    if (clientIds.length === 0) {
      return {
        data: [],
        meta: {
          page: pagination.page,
          limit: pagination.limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    return paginate(this.invoiceRepo, pagination, {
      where: { clientId: In(clientIds) },
      relations: ["items"],
      order: { createdAt: "DESC" },
    });
  }

  /** PDF de una factura propia del cliente; 404 si no es suya. */
  async generateMyInvoicePdf(
    invoiceId: string,
    userId: string
  ): Promise<Buffer> {
    const invoice = await this.facturaDelUsuario(invoiceId, userId);
    return this.generateInvoicePdf(invoiceId, invoice.businessId);
  }

  /** Factura que pertenece a alguna ficha del usuario; si no, 404. */
  private async facturaDelUsuario(
    invoiceId: string,
    userId: string
  ): Promise<InvoiceEntity> {
    const clientIds = await this.clientIdsDelUsuario(userId);
    const invoice = clientIds.length
      ? await this.invoiceRepo.findOne({
          where: { id: invoiceId, clientId: In(clientIds) },
        })
      : null;
    if (!invoice) throw new NotFoundException("Factura no encontrada");
    return invoice;
  }

  /** Fichas de cliente del usuario. */
  private async clientIdsDelUsuario(userId: string): Promise<string[]> {
    const fichas = await this.http.pedirONulo<{ id?: unknown }[]>(
      "core",
      `/internal/clients/by-user/${userId}`
    );
    if (!Array.isArray(fichas)) return [];

    return fichas
      .map((c) => c.id)
      .filter((id): id is string => typeof id === "string");
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

  /** Cambia el estado de una factura siguiendo las transiciones permitidas. */
  async updateStatus(
    id: string,
    businessId: string,
    status: InvoiceStatus
  ): Promise<InvoiceEntity> {
    const invoice = await this.findById(id, businessId);

    if (!TRANSICIONES_DE_FACTURA[invoice.status].includes(status)) {
      throw new BadRequestException(
        `Una factura ${invoice.status} no puede pasar a ${status}`
      );
    }

    await this.invoiceRepo.update({ id, businessId }, { status });
    return this.findById(id, businessId);
  }

  /** Compone los datos de la factura y delega en PdfService para generar el PDF. */
  async generateInvoicePdf(
    invoiceId: string,
    businessId: string
  ): Promise<Buffer> {
    const invoice = await this.findById(invoiceId, businessId);

    // El emisor y el receptor se resuelven contra core con `pedir`: si no
    // responde, la emision falla en vez de caer a valores por defecto.
    const perfiles = await this.http.pedir<ProfileResolution>(
      "core",
      `/internal/profiles/resolve?businessId=${businessId}&clientId=${invoice.clientId}`
    );
    const negocio = perfiles?.business;
    const cliente = perfiles?.client;

    if (!negocio) {
      throw new NotFoundException(
        "No se pudieron resolver los datos del negocio emisor"
      );
    }

    const facturacion = negocio.facturacion ?? {};

    const invoiceData = {
      invoiceNumber: invoice.number,
      invoiceDate: new Date(invoice.date),
      dueDate: new Date(invoice.dueDate),
      business: {
        name: facturacion.razonSocial || negocio.name,
        nit: facturacion.nit ?? "",
        address: facturacion.direccionFiscal || negocio.address,
        phone: negocio.phone,
        email: negocio.email,
      },
      client: {
        name: cliente?.name ?? "",
        document: cliente?.documento ?? "",
      },
      items: invoice.items.map((item) => ({
        name: item.description,
        quantity: Number(item.quantity),
        price: Number(item.unitPrice),
      })),
      subtotal: Number(invoice.subtotal),
      taxRate: Number(invoice.taxRate),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      // La factura todavía no está atada a un pago concreto, y afirmar un
      // método que nadie ha registrado sería inventarlo.
      paymentMethod: "—",
      notes: invoice.notes,
    };

    return this.pdfService.generateInvoicePdf(invoiceData);
  }

  /**
   * Reserva el siguiente numero de la serie del negocio, con formato
   * `INV-{ano}-{secuencia}`, en un solo INSERT ... ON CONFLICT ... RETURNING.
   */
  private async generateInvoiceNumber(
    businessId: string,
    manager: EntityManager
  ): Promise<string> {
    const year = new Date().getFullYear();
    const serie = await this.serieDelNegocio(businessId);

    const [{ last_number: siguiente }] = (await manager.query(
      `INSERT INTO invoice_sequences (business_id, serie, year, last_number)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (business_id, serie, year)
       DO UPDATE SET last_number = invoice_sequences.last_number + 1
       RETURNING last_number`,
      [businessId, serie, year]
    )) as { last_number: number }[];

    return `${serie}-${year}-${String(siguiente).padStart(6, "0")}`;
  }

  /** Serie con la que numera el negocio, tomada de sus datos fiscales. */
  private async serieDelNegocio(businessId: string): Promise<string> {
    const perfil = await this.http.pedirONulo<ProfileResolution>(
      "core",
      `/internal/profiles/resolve?businessId=${businessId}`
    );
    const serie = perfil?.business?.facturacion?.serie?.trim();

    return serie ? serie.toUpperCase() : SERIE_POR_DEFECTO;
  }

  /** Fecha de vencimiento por defecto: 30 días desde hoy. */
  private getDefaultDueDate(): string {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return due.toISOString().split("T")[0];
  }
}
