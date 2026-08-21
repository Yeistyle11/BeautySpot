import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, IsNull } from "typeorm";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashMovementType, PaymentMethod } from "@beautyspot/shared-types";

/** Clave del desglose para lo que se anota a mano, sin cobro detrás. */
const MOVIMIENTO_MANUAL = "MANUAL";
import {
  OpenSessionDto,
  CloseSessionDto,
  RegisterMovementDto,
} from "./dto/cash-register.dto";
import {
  esViolacionDeUnicidad,
  OutboxService,
  InternalHttpClient,
} from "@beautyspot/nest-common";
import { PaymentEntity } from "../payments/payment.entity";
import { paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";
import { EventNames } from "@beautyspot/event-types";

/**
 * Gestiona el arqueo de caja: apertura y cierre de sesiones (una abierta por
 * sede), registro de movimientos y cálculo del total esperado.
 */
@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(CashSessionEntity)
    private readonly sessionRepo: Repository<CashSessionEntity>,
    @InjectRepository(CashMovementEntity)
    private readonly movementRepo: Repository<CashMovementEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly http: InternalHttpClient
  ) {}

  /**
   * Abre una sesion de caja para la sede. Dos aperturas a la vez chocan en el
   * indice unico parcial, que se traduce al mismo error que la consulta previa.
   */
  async openSession(
    businessId: string,
    openedBy: string,
    dto: OpenSessionDto,
    branchId?: string
  ): Promise<CashSessionEntity> {
    const sede = dto.branchId ?? branchId ?? null;
    const openSession = await this.sessionRepo.findOne({
      where: { businessId, branchId: sede ?? IsNull(), closedAt: IsNull() },
    });
    if (openSession) {
      throw new BadRequestException("Ya existe una sesión de caja abierta");
    }

    try {
      return await this.sessionRepo.save(
        this.sessionRepo.create({
          businessId,
          branchId: sede,
          openedBy,
          openingAmount: dto.openingAmount || 0,
          notes: dto.notes,
        })
      );
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new BadRequestException("Ya existe una sesión de caja abierta");
      }
      throw error;
    }
  }

  /** Cierra la sesión, calcula los totales de movimientos y emite el evento de cierre. */
  async closeSession(
    sessionId: string,
    businessId: string,
    closedBy: string,
    dto: CloseSessionDto
  ): Promise<CashSessionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);

      // El arqueo se calcula con la fila bloqueada: leer los movimientos fuera
      // de la transacción dejaba entrar un cobro entre la cuenta y el cierre, y
      // ese efectivo se quedaba sin arquear. El bloqueo también impide que dos
      // cierres simultáneos pasen los dos.
      const session = await sessionRepo.findOne({
        where: { id: sessionId, businessId },
        lock: { mode: "pessimistic_write" },
      });
      if (!session) throw new NotFoundException("Sesión de caja no encontrada");
      if (session.closedAt)
        throw new BadRequestException("La sesión ya está cerrada");

      session.movements = await manager.getRepository(CashMovementEntity).find({
        where: { cashSessionId: sessionId },
      });

      const { totalIn, totalOut, porMetodo, efectivo } = this.arquear(
        session.movements
      );

      // Solo el efectivo, que es lo que hay en el cajón.
      const expectedTotal =
        Number(session.openingAmount) + efectivo.entradas - efectivo.salidas;

      const diferencia = Number(dto.closingAmount) - expectedTotal;

      // Un descuadre obliga a dejar escrito el motivo.
      if (diferencia !== 0 && !dto.notes?.trim()) {
        throw new BadRequestException(
          `La caja descuadra en ${Math.abs(diferencia)}: anota el motivo para poder cerrarla`
        );
      }

      session.closedBy = closedBy;
      session.closingAmount = dto.closingAmount;
      session.expectedTotal = expectedTotal;
      session.difference = diferencia;
      session.closedAt = new Date();
      if (dto.notes) session.notes = dto.notes;

      const closedSession = await sessionRepo.save(session);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.PAYMENT_CASH_SESSION_CLOSED,
        aggregateType: "cash_session",
        aggregateId: sessionId,
        payload: {
          sessionId,
          businessId,
          branchId: session.branchId,
          openedBy: session.openedBy,
          closedBy,
          openingAmount: Number(session.openingAmount),
          closingAmount: Number(dto.closingAmount),
          totalIn,
          totalOut,
          movementCount: session.movements.length,
          porMetodo,
          expectedTotal,
          difference: session.difference,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          notes: dto.notes,
        },
      });

      return closedSession;
    });
  }

  /** Registra un ingreso o egreso en una sesión abierta; rechaza si ya está cerrada. */
  async registerMovement(
    sessionId: string,
    businessId: string,
    registeredBy: string,
    dto: RegisterMovementDto
  ): Promise<CashMovementEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, businessId },
    });
    if (!session) throw new NotFoundException("Sesión de caja no encontrada");
    if (session.closedAt)
      throw new BadRequestException(
        "No se pueden registrar movimientos en una sesión cerrada"
      );

    return this.movementRepo.save(
      this.movementRepo.create({
        cashSessionId: sessionId,
        type: dto.type,
        amount: dto.amount,
        concept: dto.concept,
        registeredBy,
      })
    );
  }

  /** Devuelve el detalle de una sesión con sus movimientos y el total esperado. */
  async getSessionSummary(sessionId: string, businessId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, businessId },
      relations: ["movements"],
    });
    if (!session) throw new NotFoundException("Sesión de caja no encontrada");

    const { totalIn, totalOut, porMetodo, efectivo } = this.arquear(
      session.movements
    );

    return {
      session: {
        id: session.id,
        openingAmount: Number(session.openingAmount),
        closingAmount: session.closingAmount
          ? Number(session.closingAmount)
          : null,
        difference: session.closedAt ? Number(session.difference) : null,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        isOpen: session.isOpen,
      },
      movements: await this.conCliente(session.movements, businessId),
      summary: {
        totalIn,
        totalOut,
        movementCount: session.movements.length,
        porMetodo,
        expectedTotal:
          Number(session.openingAmount) + efectivo.entradas - efectivo.salidas,
      },
    };
  }

  /**
   * Anade a cada movimiento el cliente que lo origino, resuelto al leer. Si el
   * core no responde, los movimientos salen sin nombre.
   */
  private async conCliente(
    movements: CashMovementEntity[],
    businessId: string
  ): Promise<(CashMovementEntity & { clientName?: string })[]> {
    const conPago = movements.filter((m) => m.paymentId);
    if (conPago.length === 0) return movements;

    const pagos = await this.dataSource.getRepository(PaymentEntity).find({
      where: { id: In(conPago.map((m) => m.paymentId as string)), businessId },
      select: { id: true, clientId: true },
    });
    if (pagos.length === 0) return movements;

    const nombres = await this.nombresDeClientes(businessId, [
      ...new Set(pagos.map((p) => p.clientId)),
    ]);
    const clientePorPago = new Map(pagos.map((p) => [p.id, p.clientId]));

    return movements.map((m) => {
      const clientId = m.paymentId
        ? clientePorPago.get(m.paymentId)
        : undefined;
      const clientName = clientId ? nombres.get(clientId) : undefined;
      return clientName ? Object.assign(m, { clientName }) : m;
    });
  }

  /** Nombre de cada cliente pedido, o el mapa vacío si el core no contesta. */
  private async nombresDeClientes(
    businessId: string,
    ids: string[]
  ): Promise<Map<string, string>> {
    const fichas = await this.http.pedirONulo<{ id: string; name: string }[]>(
      "core",
      `/internal/clients/names?businessId=${businessId}&ids=${ids.join(",")}`
    );
    return new Map((fichas ?? []).map((f) => [f.id, f.name]));
  }

  /** Suma los movimientos: totales, desglose por método y el efectivo aparte. */
  private arquear(movements: CashMovementEntity[]): {
    totalIn: number;
    totalOut: number;
    porMetodo: Record<string, { entradas: number; salidas: number }>;
    efectivo: { entradas: number; salidas: number };
  } {
    const porMetodo: Record<string, { entradas: number; salidas: number }> = {};
    let totalIn = 0;
    let totalOut = 0;

    for (const m of movements) {
      const importe = Number(m.amount);
      const clave = m.method ?? MOVIMIENTO_MANUAL;
      const acumulado = (porMetodo[clave] ??= { entradas: 0, salidas: 0 });

      if (m.type === CashMovementType.IN) {
        totalIn += importe;
        acumulado.entradas += importe;
      } else {
        totalOut += importe;
        acumulado.salidas += importe;
      }
    }

    return {
      totalIn,
      totalOut,
      porMetodo,
      // Lo anotado a mano también es dinero del cajón.
      efectivo: {
        entradas:
          (porMetodo[PaymentMethod.CASH]?.entradas ?? 0) +
          (porMetodo[MOVIMIENTO_MANUAL]?.entradas ?? 0),
        salidas:
          (porMetodo[PaymentMethod.CASH]?.salidas ?? 0) +
          (porMetodo[MOVIMIENTO_MANUAL]?.salidas ?? 0),
      },
    };
  }

  /** Devuelve la sesión de caja abierta de la sede, o null si no hay ninguna. */
  async getActiveSession(
    businessId: string,
    branchId?: string
  ): Promise<CashSessionEntity | null> {
    return this.sessionRepo.findOne({
      where: {
        businessId,
        ...(branchId ? { branchId } : {}),
        closedAt: IsNull(),
      },
      relations: ["movements"],
      order: { openedAt: "DESC" },
    });
  }

  /** Lista las sesiones de caja de la sede, de la más reciente a la más antigua. */
  async getSessionHistory(
    businessId: string,
    pagination: PaginateParams,
    branchId?: string
  ): Promise<IPaginatedResponse<CashSessionEntity>> {
    return paginate(this.sessionRepo, pagination, {
      where: { businessId, ...(branchId ? { branchId } : {}) },
      order: { openedAt: "DESC" },
    });
  }
}
