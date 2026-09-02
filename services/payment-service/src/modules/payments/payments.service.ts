import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  DataSource,
  EntityManager,
  Between,
  In,
  IsNull,
} from "typeorm";
import {
  InternalHttpClient,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import {
  diaSiguiente,
  fechaDeHoyEn,
  instanteDe,
} from "@beautyspot/shared-utils";
import { PaymentEntity } from "./payment.entity";
import { PaymentSplitEntity } from "./payment-split.entity";
import { CashSessionEntity } from "../cash-register/cash-session.entity";
import { CashMovementEntity } from "../cash-register/cash-movement.entity";
import {
  METODO_MIXTO,
  MetodoDeCobro,
  PaymentMethod,
  PaymentStatus,
  CashMovementType,
  IPaginatedResponse,
  Role,
} from "@beautyspot/shared-types";
import { esViolacionDeUnicidad, OutboxService } from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import { EventNames, ServicioDeLaCita } from "@beautyspot/event-types";
import { VALOR_DEL_PUNTO } from "@beautyspot/shared-constants";

/** Redondea a céntimos, que es la escala con la que se guarda el dinero. */
function redondearAPesos(importe: number): number {
  return Math.round(importe * 100) / 100;
}

/** Días desde el pago dentro de los que se admite un reembolso. */
const REFUND_WINDOW_DAYS = 30;

/** Datos de cobro de una cita, tal y como los devuelve booking. */
interface CobroDeCita {
  clientId: string;
  totalAmount: number;
  services?: ServicioDeLaCita[];
}

/**
 * Que se vendio, para el listado de movimientos de caja; el cliente se
 * resuelve al leer y no se copia aqui.
 */
export function conceptoDelCobro(servicios?: ServicioDeLaCita[]): string {
  const nombres = (servicios ?? []).map((s) => s.name).filter(Boolean);
  return nombres.length > 0 ? nombres.join(", ") : "Venta en mostrador";
}

/**
 * Registra pagos manuales y sus reembolsos, publicando cada operación vía Outbox
 * y protegiendo los reembolsos contra dobles aplicaciones concurrentes.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly zonas: ZonaDelNegocioService,
    private readonly http: InternalHttpClient
  ) {}

  /** Registra un pago y emite el evento PAYMENT_REGISTERED en la misma transacción. */
  async create(
    businessId: string,
    data: {
      appointmentId?: string;
      clientId: string;
      amount: number;
      method: PaymentMethod;
      reference?: string;
      notes?: string;
      registeredBy: string;
      branchId?: string;
      puntosUsados?: number;
      solicitudId?: string;
      descuentoComercial?: number;
      motivoDescuento?: string;
      propina?: number;
      metodos?: { method: PaymentMethod; amount: number }[];
      rol?: Role;
    }
  ): Promise<PaymentEntity> {
    const puntosUsados = data.puntosUsados ?? 0;
    const descuento = puntosUsados * VALOR_DEL_PUNTO;
    const descuentoComercial = data.descuentoComercial ?? 0;
    const propina = data.propina ?? 0;

    // El descuento sale del margen del negocio, asi que lo concede quien
    // responde por el. Recepcion cobra, pero no regala.
    if (descuentoComercial > 0 && data.rol === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        "Solo el dueño o un administrador pueden aplicar un descuento"
      );
    }
    if (descuentoComercial > 0 && !data.motivoDescuento?.trim()) {
      throw new BadRequestException(
        "Escribe el motivo del descuento: sin él no se sabe qué se regaló"
      );
    }

    const splits = this.repartoDelCobro(data, propina);

    // Un cobro de cero no es una operacion: o es un error de tecleo o es una
    // cortesia, que merece su propio concepto. La excepcion es el canje, donde
    // `amount` es lo que el cliente pone de su bolsillo y los puntos cubren el
    // resto: ahi el cero es legitimo.
    if (data.amount <= 0 && puntosUsados === 0) {
      throw new BadRequestException("El monto tiene que ser mayor que cero");
    }

    // Lo que se cobró solo lo sabe booking: payment guarda el importe, no el
    // detalle. Se toma de la misma consulta que ya valida la cita.
    let services: ServicioDeLaCita[] | undefined;
    if (data.appointmentId) {
      services = await this.validarContraLaCita(
        businessId,
        data.appointmentId,
        data.amount + descuento + descuentoComercial
      );
    }

    // Los puntos se descuentan antes de escribir nada, porque es el descuento
    // lo que decide el importe. Va lo último de las validaciones para que un
    // cobro rechazado por otro motivo no obligue a devolverlos.
    if (puntosUsados > 0) {
      await this.reservarLosPuntos(businessId, data.clientId, puntosUsados);
    }

    try {
      return await this.registrar(
        businessId,
        data,
        puntosUsados,
        descuento,
        services,
        splits
      );
    } catch (error) {
      // El cobro no llegó a escribirse, así que los puntos reservados vuelven a
      // su sitio. También cuando el intento resulta ser un reenvío: el cobro
      // que se devuelve ya gastó los suyos.
      if (puntosUsados > 0) {
        await this.devolverLosPuntos(businessId, data.clientId, puntosUsados);
      }

      // El segundo envio del mismo intento choca contra el indice: se devuelve
      // el cobro que ya se hizo.
      const yaCobrado = esViolacionDeUnicidad(error) && data.solicitudId;
      if (!yaCobrado) throw error;

      const previo = await this.repo.findOne({
        where: { businessId, solicitudId: data.solicitudId },
      });
      if (!previo) throw error;
      return previo;
    }
  }

  /** Escribe el cobro, su entrada en caja y sus eventos, todo en una transacción. */
  private async registrar(
    businessId: string,
    data: Parameters<PaymentsService["create"]>[1],
    puntosUsados: number,
    descuento: number,
    services: ServicioDeLaCita[] | undefined,
    splits: { method: PaymentMethod; amount: number }[]
  ): Promise<PaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const payment = this.repo.create({
        ...data,
        businessId,
        puntosUsados,
        descuento,
        descuentoComercial: data.descuentoComercial ?? 0,
        motivoDescuento: data.motivoDescuento?.trim() || null,
        propina: data.propina ?? 0,
        // Las lineas se guardan con el cobro; el `cascade` de insercion las
        // escribe con el id que acaba de recibir.
        splits: splits.map((linea) =>
          manager.getRepository(PaymentSplitEntity).create(linea)
        ),
        method:
          splits.length > 1
            ? (METODO_MIXTO as MetodoDeCobro)
            : splits[0].method,
      });
      const savedPayment = await manager
        .getRepository(PaymentEntity)
        .save(payment);

      await this.registrarEntradaEnCaja(
        manager,
        businessId,
        savedPayment,
        splits,
        services
      );

      await this.outbox.enqueue(manager, {
        eventType: EventNames.PAYMENT_PAYMENT_REGISTERED,
        aggregateType: "payment",
        aggregateId: savedPayment.id,
        payload: {
          paymentId: savedPayment.id,
          businessId,
          appointmentId: savedPayment.appointmentId,
          clientId: savedPayment.clientId,
          amount: Number(savedPayment.amount),
          propina: Number(savedPayment.propina),
          method: savedPayment.method,
          metodos: splits,
          date: await this.diaDelCobro(businessId, savedPayment.createdAt),
          services,
        },
      });

      // El saldo ya lo movió core al reservar; este evento deja constancia del
      // canje para quien lleve la cuenta de lo gastado en fidelización.
      if (puntosUsados > 0) {
        await this.outbox.enqueue(manager, {
          eventType: EventNames.PAYMENT_POINTS_REDEEMED,
          aggregateType: "payment",
          aggregateId: savedPayment.id,
          payload: {
            paymentId: savedPayment.id,
            businessId,
            clientId: savedPayment.clientId,
            points: puntosUsados,
            discount: descuento,
          },
        });
      }

      return savedPayment;
    });
  }

  /**
   * Las lineas del cobro: las que vengan, o una sola con el medio indicado.
   *
   * Suman el importe mas la propina, que es el dinero que entra de verdad; el
   * cuadre se comprueba aqui y no en el DTO porque depende de los dos campos.
   */
  private repartoDelCobro(
    data: Parameters<PaymentsService["create"]>[1],
    propina: number
  ): { method: PaymentMethod; amount: number }[] {
    const total = redondearAPesos(data.amount + propina);

    if (!data.metodos?.length) {
      return [{ method: data.method, amount: total }];
    }

    const repartido = redondearAPesos(
      data.metodos.reduce((suma, linea) => suma + linea.amount, 0)
    );
    if (repartido !== total) {
      throw new BadRequestException(
        `El reparto suma $${repartido} y el cobro es de $${total}: revisa las partes`
      );
    }

    const medios = new Set(data.metodos.map((linea) => linea.method));
    if (medios.size !== data.metodos.length) {
      throw new BadRequestException(
        "Cada medio de pago va una sola vez en el reparto"
      );
    }

    return data.metodos.map((linea) => ({
      method: linea.method,
      amount: redondearAPesos(linea.amount),
    }));
  }

  /** Dia del cobro en el huso del negocio, para quien agrega por dia. */
  private async diaDelCobro(businessId: string, cuando: Date): Promise<string> {
    return fechaDeHoyEn(await this.zonas.de(businessId), cuando);
  }

  /**
   * De las citas indicadas, las que ya tienen un cobro vivo; un cobro anulado
   * no cuenta.
   */
  async citasYaCobradas(
    businessId: string,
    appointmentIds: string[]
  ): Promise<string[]> {
    if (appointmentIds.length === 0) return [];

    const cobros = await this.repo.find({
      where: {
        businessId,
        appointmentId: In(appointmentIds),
        status: In([PaymentStatus.PENDING, PaymentStatus.COMPLETED]),
      },
      select: { appointmentId: true },
    });

    return cobros.map((c) => c.appointmentId);
  }

  /**
   * Descuenta en core los puntos que va a gastar el cobro. El saldo lo guarda
   * core y lo mueve él en una sola sentencia condicionada, de modo que dos
   * cobros simultáneos del mismo cliente no puedan gastar el mismo saldo: el
   * segundo recibe un 409 y no llega a registrarse.
   */
  private async reservarLosPuntos(
    businessId: string,
    clientId: string,
    puntos: number
  ): Promise<void> {
    if (!Number.isInteger(puntos) || puntos <= 0) {
      throw new BadRequestException("Los puntos a canjear no son válidos");
    }

    try {
      await this.http.enviar<{ loyaltyPoints: number }>(
        "core",
        `/internal/clients/${clientId}/puntos/reservar`,
        { businessId, puntos }
      );
    } catch {
      throw new BadRequestException(
        "El cliente no tiene puntos suficientes o no pertenece a este negocio"
      );
    }
  }

  /**
   * Devuelve a core los puntos reservados para un cobro que no llegó a
   * registrarse. Es el compensatorio de {@link reservarLosPuntos}: sin él, un
   * fallo posterior a la reserva dejaría al cliente sin puntos y sin descuento.
   */
  private async devolverLosPuntos(
    businessId: string,
    clientId: string,
    puntos: number
  ): Promise<void> {
    try {
      await this.http.enviar<{ loyaltyPoints: number }>(
        "core",
        `/internal/clients/${clientId}/puntos/devolver`,
        { businessId, puntos }
      );
    } catch (error) {
      // No puede tumbar la petición: el cobro ya falló y lo que el usuario debe
      // ver es ese error, no el del compensatorio.
      this.logger.error(
        `No se pudieron devolver ${puntos} puntos al cliente ${clientId} del negocio ${businessId}: ${
          error instanceof Error ? error.message : "error desconocido"
        }`
      );
    }
  }

  /**
   * Comprueba que la cita existe, es del negocio, no está ya cobrada y que el
   * importe coincide con el suyo.
   */
  private async validarContraLaCita(
    businessId: string,
    appointmentId: string,
    amount: number
  ): Promise<ServicioDeLaCita[] | undefined> {
    const cita = await this.http.pedir<CobroDeCita | null>(
      "booking",
      `/internal/appointments/${appointmentId}/cobro?businessId=${businessId}`
    );
    if (!cita) {
      throw new BadRequestException(
        "La cita no existe o no pertenece a este negocio"
      );
    }

    const yaCobrada = await this.repo.findOne({
      where: {
        businessId,
        appointmentId,
        status: In([PaymentStatus.PENDING, PaymentStatus.COMPLETED]),
      },
    });
    if (yaCobrada) {
      throw new BadRequestException("Esta cita ya tiene un pago registrado");
    }

    if (Number(amount) !== cita.totalAmount) {
      throw new BadRequestException(
        `El importe no coincide con el de la cita ($${cita.totalAmount})`
      );
    }

    return cita.services;
  }

  /**
   * Anota el efectivo en la sesión de caja abierta, en la misma transacción que
   * el pago: si el arqueo no lo recoge, el cierre nunca cuadra.
   */
  private async registrarEntradaEnCaja(
    manager: EntityManager,
    businessId: string,
    payment: PaymentEntity,
    splits: { method: PaymentMethod; amount: number }[],
    services?: ServicioDeLaCita[]
  ): Promise<void> {
    const session = await this.cajaAbierta(
      manager,
      businessId,
      payment.branchId,
      splits.some((linea) => linea.method === PaymentMethod.CASH),
      "registrar un pago en efectivo"
    );
    if (!session) return;

    // Un movimiento por linea: el arqueo desglosa por medio y solo cuadra el
    // cajon contra el efectivo, asi que un cobro repartido tiene que llegarle
    // separado.
    const movimientos = manager.getRepository(CashMovementEntity);
    await movimientos.save(
      splits.map((linea) =>
        movimientos.create({
          cashSessionId: session.id,
          type: CashMovementType.IN,
          amount: linea.amount,
          concept: conceptoDelCobro(services),
          method: linea.method,
          paymentId: payment.id,
          registeredBy: payment.registeredBy,
        })
      )
    );
  }

  /**
   * Caja abierta del negocio. El efectivo la exige; los demás métodos devuelven
   * nulo cuando no la hay.
   */
  private async cajaAbierta(
    manager: EntityManager,
    businessId: string,
    branchId: string | null,
    hayEfectivo: boolean,
    accion: string
  ): Promise<CashSessionEntity | null> {
    // Se bloquea la fila mientras dure la transacción del cobro: sin esto, un
    // cierre en paralelo puede arquear la caja justo antes de que entre este
    // efectivo, y el movimiento queda fuera del cuadre.
    const session = await manager.getRepository(CashSessionEntity).findOne({
      where: { businessId, branchId: branchId ?? IsNull(), closedAt: IsNull() },
      lock: { mode: "pessimistic_write" },
    });
    if (session) return session;

    if (hayEfectivo) {
      throw new BadRequestException(
        `No hay una caja abierta: abre la caja antes de ${accion}`
      );
    }
    return null;
  }

  /** Devuelve el efectivo reembolsado a la caja abierta, si la hay. */
  private async registrarSalidaEnCaja(
    manager: EntityManager,
    businessId: string,
    payment: PaymentEntity,
    amount: number,
    refundedBy: string
  ): Promise<void> {
    // Del cajon solo puede salir lo que entro en efectivo: de un cobro
    // repartido se devuelve por caja esa parte, y el resto por donde entro.
    const enEfectivo = await this.efectivoDelCobro(manager, payment);
    if (enEfectivo <= 0) return;
    const salida = Math.min(amount, enEfectivo);

    const session = await this.cajaAbierta(
      manager,
      businessId,
      payment.branchId,
      true,
      "reembolsar en efectivo"
    );
    if (!session) return;

    await manager.getRepository(CashMovementEntity).save(
      manager.getRepository(CashMovementEntity).create({
        cashSessionId: session.id,
        type: CashMovementType.OUT,
        amount: salida,
        concept: `Reembolso ${payment.id}`,
        method: PaymentMethod.CASH,
        paymentId: payment.id,
        registeredBy: refundedBy,
      })
    );
  }

  /** Lo que entro en efectivo en un cobro, mirando sus lineas. */
  private async efectivoDelCobro(
    manager: EntityManager,
    payment: PaymentEntity
  ): Promise<number> {
    const lineas = await manager.getRepository(PaymentSplitEntity).find({
      where: { paymentId: payment.id },
    });
    return lineas
      .filter((linea) => linea.method === PaymentMethod.CASH)
      .reduce((suma, linea) => suma + Number(linea.amount), 0);
  }

  /** Lista los pagos del negocio con filtros (método, estado, rango de fechas) y paginación. */
  async findByBusiness(
    businessId: string,
    filters: {
      method?: PaymentMethod;
      status?: PaymentStatus;
      from?: string;
      to?: string;
      branchId?: string;
    },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<PaymentEntity>> {
    const where: Record<string, unknown> = { businessId };
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.method) where.method = filters.method;
    if (filters.status) where.status = filters.status;
    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    }
    return paginate(this.repo, pagination, { where });
  }

  /** Obtiene un pago del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<PaymentEntity> {
    const payment = await this.repo.findOne({ where: { id, businessId } });
    if (!payment) throw new NotFoundException("Pago no encontrado");
    return payment;
  }

  /**
   * Resumen de pagos completados de un dia, agregado por metodo y sumado en
   * SQL.
   */
  async getDailySummary(businessId: string, date: string, branchId?: string) {
    // El día va de medianoche a medianoche en el huso del negocio, con el fin
    // exclusivo.
    const zona = await this.zonas.de(businessId);
    const start = instanteDe(zona, date, "00:00");
    const end = instanteDe(zona, diaSiguiente(date), "00:00");

    const rows = await this.repo
      .createQueryBuilder("p")
      .select("p.method", "method")
      .addSelect("SUM(p.amount)", "total")
      .addSelect("COUNT(*)", "count")
      .where("p.business_id = :businessId", { businessId })
      .andWhere("p.status = :status", { status: PaymentStatus.COMPLETED })
      .andWhere("p.created_at >= :start AND p.created_at < :end", {
        start,
        end,
      })
      .andWhere(branchId ? "p.branch_id = :branchId" : "TRUE", { branchId })
      .groupBy("p.method")
      .getRawMany<{ method: string; total: string; count: string }>();

    const byMethod: Record<string, number> = {};
    let total = 0;
    let count = 0;
    for (const row of rows) {
      const amount = Number(row.total);
      byMethod[row.method] = amount;
      total += amount;
      count += Number(row.count);
    }

    return { date, total, count, byMethod };
  }

  /**
   * Corrige un cobro ya registrado: importe, metodo, referencia o notas.
   *
   * Solo se admite mientras la caja que recogio el cobro siga abierta. Cerrada
   * la caja el arqueo ya esta firmado, y reescribir el importe lo descuadraria
   * hacia atras sin que nadie lo note; a partir de ahi la via es la devolucion.
   */
  async correctPayment(
    id: string,
    businessId: string,
    cambios: {
      amount?: number;
      method?: PaymentMethod;
      reference?: string;
      notes?: string;
      reason: string;
      editedBy: string;
    }
  ): Promise<PaymentEntity> {
    const payment = await this.findById(id, businessId);
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Solo se puede corregir un cobro completado. Estado actual: ${payment.status}`
      );
    }
    // Esta via corrige un importe y un medio, que es lo que el formulario
    // ofrece. Un cobro repartido tiene varias partes y varios movimientos de
    // caja: reescribirlo desde aqui dejaria el arqueo contando otra cosa.
    if (payment.method === METODO_MIXTO) {
      throw new BadRequestException(
        "Un cobro repartido entre varios medios no se corrige: registra una devolución y vuelve a cobrarlo"
      );
    }

    const importeAnterior = Number(payment.amount);
    const importeNuevo = cambios.amount ?? importeAnterior;
    const metodoNuevo = cambios.method ?? payment.method;
    const zona = await this.zonas.de(businessId);
    const diaDelCobro = fechaDeHoyEn(zona, payment.createdAt);

    return this.dataSource.transaction(async (manager) => {
      await this.ajustarCajaDeLaCorreccion(
        manager,
        businessId,
        payment,
        importeNuevo,
        metodoNuevo,
        cambios.editedBy
      );

      // La linea del cobro es de donde leen la caja y el arqueo: se corrige
      // con el.
      await manager.getRepository(PaymentSplitEntity).update(
        { paymentId: id },
        {
          amount: importeNuevo + Number(payment.propina),
          method: metodoNuevo,
        }
      );

      await manager.getRepository(PaymentEntity).update(
        { id, businessId },
        {
          amount: importeNuevo,
          method: metodoNuevo,
          reference: cambios.reference ?? payment.reference,
          notes: cambios.notes ?? payment.notes,
          editedAt: new Date(),
          editedBy: cambios.editedBy,
          editReason: cambios.reason,
        }
      );

      // Quien agrega ingresos ya sumo el importe viejo: necesita la diferencia
      // y el dia del cobro original, no el dia en que se corrige.
      if (importeNuevo !== importeAnterior) {
        await this.outbox.enqueue(manager, {
          eventType: EventNames.PAYMENT_PAYMENT_CORRECTED,
          aggregateType: "payment",
          aggregateId: payment.id,
          payload: {
            paymentId: payment.id,
            businessId,
            date: diaDelCobro,
            previousAmount: importeAnterior,
            amount: importeNuevo,
            difference: importeNuevo - importeAnterior,
            method: metodoNuevo,
            reason: cambios.reason,
            editedBy: cambios.editedBy,
          },
        });
      }

      return manager.getRepository(PaymentEntity).findOneOrFail({
        where: { id, businessId },
      });
    });
  }

  /**
   * Deja la caja contando lo mismo que el cobro corregido. El movimiento solo
   * se toca si su sesion sigue abierta; si ya se arqueo, la correccion no
   * procede.
   */
  private async ajustarCajaDeLaCorreccion(
    manager: EntityManager,
    businessId: string,
    payment: PaymentEntity,
    importeNuevo: number,
    metodoNuevo: PaymentMethod,
    editedBy: string
  ): Promise<void> {
    const movimientos = manager.getRepository(CashMovementEntity);
    const movimiento = await movimientos.findOne({
      where: { paymentId: payment.id, type: CashMovementType.IN },
    });

    if (movimiento) {
      const sesion = await manager.getRepository(CashSessionEntity).findOne({
        where: { id: movimiento.cashSessionId },
        lock: { mode: "pessimistic_write" },
      });
      if (sesion?.closedAt) {
        throw new BadRequestException(
          "Este cobro entró en una caja que ya se cerró: para corregirlo, registra una devolución"
        );
      }

      // El dinero deja de pasar por el cajón: el movimiento sobra. Se puede
      // borrar sin falsear nada porque la sesión aún no se ha arqueado.
      if (metodoNuevo !== PaymentMethod.CASH) {
        await movimientos.delete({ id: movimiento.id });
        return;
      }

      await movimientos.update(
        { id: movimiento.id },
        { amount: importeNuevo, method: metodoNuevo }
      );
      return;
    }

    // No habia movimiento porque el cobro no era en efectivo; si ahora lo es,
    // el dinero entra al cajon y la caja tiene que recogerlo.
    if (metodoNuevo === PaymentMethod.CASH) {
      const sesion = await this.cajaAbierta(
        manager,
        businessId,
        payment.branchId,
        true,
        "corregir un cobro a efectivo"
      );
      if (!sesion) return;
      await movimientos.save(
        movimientos.create({
          cashSessionId: sesion.id,
          type: CashMovementType.IN,
          amount: importeNuevo,
          concept: "Corrección de cobro",
          method: metodoNuevo,
          paymentId: payment.id,
          registeredBy: editedBy,
        })
      );
    }
  }

  /**
   * Reembolsa un pago completado, total o parcialmente, con un UPDATE
   * condicionado al estado y anotando en `refundedBy` quien lo autorizo.
   */
  async refundPayment(
    id: string,
    businessId: string,
    options: { reason?: string; refundAmount?: number; refundedBy: string }
  ): Promise<PaymentEntity> {
    const payment = await this.loadRefundablePayment(id, businessId);
    this.validateRefundWindow(payment);
    const finalAmount = this.calculateRefundAmount(
      payment,
      options.refundAmount
    );
    const finalReason = options.reason || "Reembolso solicitado";

    return this.dataSource.transaction(async (manager) => {
      const refunded = await this.applyRefund(manager, payment, {
        amount: finalAmount,
        reason: finalReason,
        refundedBy: options.refundedBy,
      });
      await this.registrarSalidaEnCaja(
        manager,
        businessId,
        payment,
        finalAmount,
        options.refundedBy
      );
      await this.enqueueRefundEvent(
        manager,
        refunded,
        payment,
        finalAmount,
        finalReason,
        businessId
      );
      return refunded;
    });
  }

  /** Carga el pago y verifica que esté COMPLETED (única situación reembolsable). */
  private async loadRefundablePayment(
    id: string,
    businessId: string
  ): Promise<PaymentEntity> {
    const payment = await this.findById(id, businessId);
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Solo se pueden reembolsar pagos completados. Estado actual: ${payment.status}`
      );
    }
    return payment;
  }

  /** Verifica que el pago siga dentro de la ventana de reembolso. */
  private validateRefundWindow(payment: PaymentEntity): void {
    const refundWindowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - payment.createdAt.getTime() > refundWindowMs) {
      throw new BadRequestException(
        `El periodo de reembolso de ${REFUND_WINDOW_DAYS} días ha expirado`
      );
    }
  }

  /** Resuelve el monto a reembolsar (total por defecto) validando que sea válido. */
  private calculateRefundAmount(
    payment: PaymentEntity,
    requested?: number
  ): number {
    const amount = requested ?? Number(payment.amount);
    if (amount <= 0 || amount > Number(payment.amount)) {
      throw new BadRequestException(
        `El monto del reembolso debe ser mayor a 0 y menor o igual al monto original ($${payment.amount})`
      );
    }
    return amount;
  }

  /** Aplica el reembolso con un UPDATE condicionado al estado, evitando dobles reembolsos. */
  private async applyRefund(
    manager: EntityManager,
    payment: PaymentEntity,
    data: { amount: number; reason: string; refundedBy: string }
  ): Promise<PaymentEntity> {
    const refundedAt = new Date();
    // El WHERE sobre status = COMPLETED es la guarda anti doble-reembolso: si
    // otra transacción ya cambió el estado, este UPDATE no toca ninguna fila.
    const result = await manager.getRepository(PaymentEntity).update(
      { id: payment.id, status: PaymentStatus.COMPLETED },
      {
        status: PaymentStatus.REFUNDED,
        refundedAt,
        refundAmount: data.amount,
        refundReason: data.reason,
        refundedBy: data.refundedBy,
      }
    );

    if (!result.affected) {
      throw new BadRequestException("El pago ya fue reembolsado");
    }

    return Object.assign(payment, {
      status: PaymentStatus.REFUNDED,
      refundedAt,
      refundAmount: data.amount,
      refundReason: data.reason,
      refundedBy: data.refundedBy,
    });
  }

  /** Encola el evento PAYMENT_REFUND_PROCESSED dentro de la transacción del reembolso. */
  private async enqueueRefundEvent(
    manager: EntityManager,
    refundedPayment: PaymentEntity,
    originalPayment: PaymentEntity,
    refundAmount: number,
    reason: string,
    businessId: string
  ): Promise<void> {
    await this.outbox.enqueue(manager, {
      eventType: EventNames.PAYMENT_REFUND_PROCESSED,
      aggregateType: "payment",
      aggregateId: refundedPayment.id,
      payload: {
        paymentId: refundedPayment.id,
        businessId,
        clientId: originalPayment.clientId,
        appointmentId: originalPayment.appointmentId,
        originalAmount: Number(originalPayment.amount),
        refundAmount,
        reason,
        refundedAt: refundedPayment.refundedAt,
      },
    });
  }
}
