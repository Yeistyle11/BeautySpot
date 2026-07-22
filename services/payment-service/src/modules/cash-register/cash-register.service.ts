import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, IsNull } from "typeorm";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashMovementType } from "@beautyspot/shared-types";
import {
  OpenSessionDto,
  CloseSessionDto,
  RegisterMovementDto,
} from "./dto/cash-register.dto";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

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
   * Abre una sesión de caja para el negocio.
   *
   * El índice único parcial uq_cash_sessions_open_per_business es la garantía
   * real de "una sola sesión abierta": la consulta previa solo sirve para dar un
   * mensaje claro en el caso común, pero dos aperturas concurrentes que la
   * superen chocan en el insert, y esa violación se traduce al mismo error.
   */
  async openSession(
    businessId: string,
    openedBy: string,
    dto: OpenSessionDto
  ): Promise<CashSessionEntity> {
    const openSession = await this.sessionRepo.findOne({
      where: { businessId, closedAt: IsNull() },
    });
    if (openSession) {
      throw new BadRequestException("Ya existe una sesión de caja abierta");
    }

    try {
      return await this.sessionRepo.save(
        this.sessionRepo.create({
          businessId,
          branchId: dto.branchId,
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

    let totalIn = 0;
    let totalOut = 0;
    for (const m of session.movements) {
      if (m.type === CashMovementType.IN) totalIn += Number(m.amount);
      else totalOut += Number(m.amount);
    }

    session.closedBy = closedBy;
    session.closingAmount = dto.closingAmount;
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
          expectedTotal: Number(session.openingAmount) + totalIn - totalOut,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          notes: dto.notes,
        },
      });

      return closedSession;
    });
  }

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

  async getSessionSummary(sessionId: string, businessId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, businessId },
      relations: ["movements"],
    });
    if (!session) throw new NotFoundException("Sesión de caja no encontrada");

    let totalIn = 0;
    let totalOut = 0;
    for (const m of session.movements) {
      if (m.type === CashMovementType.IN) totalIn += Number(m.amount);
      else totalOut += Number(m.amount);
    }

    return {
      session: {
        id: session.id,
        openingAmount: Number(session.openingAmount),
        closingAmount: session.closingAmount
          ? Number(session.closingAmount)
          : null,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        isOpen: session.isOpen,
      },
      movements: session.movements,
      summary: {
        totalIn,
        totalOut,
        movementCount: session.movements.length,
        expectedTotal: Number(session.openingAmount) + totalIn - totalOut,
      },
    };
  }

  async getActiveSession(
    businessId: string
  ): Promise<CashSessionEntity | null> {
    return this.sessionRepo.findOne({
      where: { businessId, closedAt: IsNull() },
      relations: ["movements"],
      order: { openedAt: "DESC" },
    });
  }

  async getSessionHistory(businessId: string): Promise<CashSessionEntity[]> {
    return this.sessionRepo.find({
      where: { businessId },
      order: { openedAt: "DESC" },
      take: 50,
    });
  }
}
