import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  InternalHttpClient,
  OutboxService,
  esViolacionDeUnicidad,
} from "@beautyspot/nest-common";
import { EventNames, ServicioDeLaCita } from "@beautyspot/event-types";
import { Between, In, Repository, DataSource, EntityManager } from "typeorm";
import { paginate, PaginateParams } from "@beautyspot/database";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import {
  InvoiceStatus,
  IPaginatedResponse,
  PaymentStatus,
} from "@beautyspot/shared-types";
import { PaymentEntity } from "../payments/payment.entity";
import { IVA } from "@beautyspot/shared-constants";
import { CreateInvoiceDto } from "./dto/invoice.dto";
import { PdfService } from "./pdf/pdf.service";

/** Redondea a céntimos, que es la escala con la que se guarda el dinero. */
function redondear(importe: number): number {
  return Math.round(importe * 100) / 100;
}

/** Serie de numeración de quien no la haya configurado. */
const SERIE_POR_DEFECTO = "INV";

/** Estados a los que puede pasar una factura desde cada estado. */
const TRANSICIONES_DE_FACTURA: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
};

/** Lo que la agenda sabe del cobro de una cita. */
interface CobroDeCita {
  clientId: string;
  totalAmount: number;
  services?: ServicioDeLaCita[];
}

/** Datos fiscales con los que se emite: la serie y el tipo aplicado. */
interface DatosFiscales {
  serie: string;
  /** En tanto por uno, que es como se guarda en la factura. */
  tasa: number;
}

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
      /** Impuesto con el que factura el negocio, en porcentaje. */
      tasaDeImpuesto?: number;
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
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
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

    // La serie y el tipo salen de los datos fiscales del negocio, en una sola
    // consulta y fuera de la transacción: hablar con otro servicio con la
    // transacción abierta alarga los bloqueos de la secuencia.
    const fiscales = await this.datosFiscalesDe(businessId);

    const emision = dto.paymentId
      ? await this.desdeElCobro(businessId, dto.paymentId, fiscales.tasa)
      : this.deLasLineas(dto, fiscales.tasa);

    // El numero se reserva dentro de la misma transaccion que la factura, de
    // modo que la serie no deja huecos.
    return this.dataSource.transaction(async (manager) => {
      const invoice = manager.getRepository(InvoiceEntity).create({
        businessId,
        clientId: emision.clientId,
        paymentId: dto.paymentId ?? null,
        number: await this.generateInvoiceNumber(
          businessId,
          fiscales.serie,
          manager
        ),
        date,
        dueDate,
        subtotal: emision.subtotal,
        taxRate: fiscales.tasa,
        tax: emision.tax,
        total: emision.total,
        notes: dto.notes,
        status: InvoiceStatus.DRAFT,
        items: emision.items,
      });

      const guardada = await manager
        .getRepository(InvoiceEntity)
        .save(invoice)
        .catch((error: unknown) => {
          // El cobro ya se facturó: lo separa el índice, porque entre la
          // comprobación y la escritura cabe otra emisión.
          if (esViolacionDeUnicidad(error)) {
            throw new ConflictException("Ese cobro ya tiene una factura");
          }
          throw error;
        });

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

  /**
   * Factura escrita a mano: los precios de las líneas son la base y el
   * impuesto se suma encima.
   */
  private deLasLineas(dto: CreateInvoiceDto, tasa: number) {
    if (!dto.clientId || !dto.items?.length) {
      throw new BadRequestException(
        "Hace falta el cliente y al menos una línea, o el cobro del que sale la factura"
      );
    }

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

    const tax = redondear(subtotal * tasa);
    return {
      clientId: dto.clientId,
      items,
      subtotal,
      tax,
      total: subtotal + tax,
    };
  }

  /**
   * Factura de un cobro ya registrado. Lo cobrado en el mostrador es el total,
   * con el impuesto dentro, así que la base sale de descontarlo y el total de la
   * factura coincide al peso con el importe cobrado.
   */
  private async desdeElCobro(
    businessId: string,
    paymentId: string,
    tasa: number
  ) {
    const cobro = await this.paymentRepo.findOne({
      where: { id: paymentId, businessId },
    });
    if (!cobro) throw new NotFoundException("Cobro no encontrado");
    if (cobro.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        "Solo se factura un cobro completado: este está " + cobro.status
      );
    }

    const yaFacturado = await this.invoiceRepo.exists({
      where: {
        businessId,
        paymentId,
        status: In([
          InvoiceStatus.DRAFT,
          InvoiceStatus.SENT,
          InvoiceStatus.PAID,
        ]),
      },
    });
    if (yaFacturado) {
      throw new ConflictException("Ese cobro ya tiene una factura");
    }

    const total = Number(cobro.amount);
    const lineas = await this.lineasDelCobro(businessId, cobro, total);

    // La base de cada línea se redondea, y el impuesto se calcula por
    // diferencia: así los céntimos del redondeo no descuadran el total.
    let subtotal = 0;
    const items = lineas.map((linea) => {
      const base = redondear(linea.importe / (1 + tasa));
      subtotal += base;
      return this.itemRepo.create({
        description: linea.descripcion,
        quantity: 1,
        unitPrice: base,
        total: base,
      });
    });
    subtotal = redondear(subtotal);

    return {
      clientId: cobro.clientId,
      items,
      subtotal,
      tax: redondear(total - subtotal),
      total,
    };
  }

  /**
   * Qué se le factura al cliente por ese cobro. Si el cobro viene de una cita,
   * sus servicios; si no —un cobro suelto—, una sola línea con el importe,
   * porque el pago no guarda el detalle de lo que se vendió.
   */
  private async lineasDelCobro(
    businessId: string,
    cobro: PaymentEntity,
    total: number
  ): Promise<{ descripcion: string; importe: number }[]> {
    if (!cobro.appointmentId) {
      return [{ descripcion: "Servicios prestados", importe: total }];
    }

    const cita = await this.http.pedirONulo<CobroDeCita | null>(
      "booking",
      `/internal/appointments/${cobro.appointmentId}/cobro?businessId=${businessId}`
    );
    const servicios = cita?.services ?? [];

    // Los precios de la cita solo sirven si suman lo cobrado: un descuento o
    // un canje de puntos los deja por encima, y la factura tiene que cuadrar
    // con lo que se pagó.
    const suma = redondear(servicios.reduce((t, s) => t + Number(s.price), 0));
    if (servicios.length === 0 || suma !== redondear(total)) {
      return [{ descripcion: "Servicios prestados", importe: total }];
    }

    return servicios.map((servicio) => ({
      descripcion: servicio.name,
      importe: Number(servicio.price),
    }));
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
    serie: string,
    manager: EntityManager
  ): Promise<string> {
    const year = new Date().getFullYear();

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

  /**
   * Serie y tipo impositivo con los que factura el negocio. Sin datos fiscales
   * configurados, la serie por defecto y el IVA colombiano.
   */
  private async datosFiscalesDe(businessId: string): Promise<DatosFiscales> {
    const perfil = await this.http.pedirONulo<ProfileResolution>(
      "core",
      `/internal/profiles/resolve?businessId=${businessId}`
    );
    const facturacion = perfil?.business?.facturacion;
    const serie = facturacion?.serie?.trim();
    const porcentaje = facturacion?.tasaDeImpuesto;

    return {
      serie: serie ? serie.toUpperCase() : SERIE_POR_DEFECTO,
      // El negocio la escribe en porcentaje; la factura la guarda en tanto por
      // uno, que es como la lee el PDF.
      tasa:
        typeof porcentaje === "number" && porcentaje >= 0
          ? porcentaje / 100
          : IVA,
    };
  }

  /** Fecha de vencimiento por defecto: 30 días desde hoy. */
  private getDefaultDueDate(): string {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return due.toISOString().split("T")[0];
  }
}
