import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, IsNull } from "typeorm";
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
import { OutboxService } from "@beautyspot/nest-common";
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
    private readonly outbox: OutboxService
  ) {}

  /**
   * Abre una sesión de caja para la sede.
   *
   * Los índices únicos parciales sobre las sesiones sin cerrar son la garantía
   * real de "una sola sesión abierta": la consulta previa solo sirve para dar un
   * mensaje claro en el caso común, pero dos aperturas concurrentes que la
   * superen chocan en el insert, y esa violación se traduce al mismo error.
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
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException("Ya existe una sesión de caja abierta");
      }
      throw error;
    }
  }

  /** Detecta la violación de índice único de Postgres (SQLSTATE 23505). */
  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "23505"
    );
  }

  /** Cierra la sesión, calcula los totales de movimientos y emite el evento de cierre. */
  async closeSession(
    sessionId: string,
    businessId: string,
    closedBy: string,
    dto: CloseSessionDto
  ): Promise<CashSessionEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, businessId },
      relations: ["movements"],
    });
    if (!session) throw new NotFoundException("Sesión de caja no encontrada");
    if (session.closedAt)
      throw new BadRequestException("La sesión ya está cerrada");

    const { totalIn, totalOut, porMetodo, efectivo } = this.arquear(
      session.movements
    );

    // Solo el efectivo, que es lo que hay en el cajón.
    const expectedTotal =
      Number(session.openingAmount) + efectivo.entradas - efectivo.salidas;

    session.closedBy = closedBy;
    session.closingAmount = dto.closingAmount;
    session.expectedTotal = expectedTotal;
    session.difference = Number(dto.closingAmount) - expectedTotal;
    session.closedAt = new Date();
    if (dto.notes) session.notes = dto.notes;

    return this.dataSource.transaction(async (manager) => {
      const closedSession = await manager
        .getRepository(CashSessionEntity)
        .save(session);

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
      movements: session.movements,
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
