import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashMovementType } from "@beautyspot/shared-types";
import { OpenSessionDto, CloseSessionDto, RegisterMovementDto } from "./dto/cash-register.dto";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { EventNames } from "@beautyspot/event-types";

@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(CashSessionEntity)
    private readonly sessionRepo: Repository<CashSessionEntity>,
    @InjectRepository(CashMovementEntity)
    private readonly movementRepo: Repository<CashMovementEntity>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async openSession(businessId: string, openedBy: string, dto: OpenSessionDto): Promise<CashSessionEntity> {
    const openSession = await this.sessionRepo.findOne({
      where: { businessId, closedAt: null as unknown as undefined },
    });
    if (openSession) {
      throw new BadRequestException("Ya existe una sesión de caja abierta");
    }

    return this.sessionRepo.save(
      this.sessionRepo.create({
        businessId,
        branchId: dto.branchId,
        openedBy,
        openingAmount: dto.openingAmount || 0,
        notes: dto.notes,
      }),
    );
  }

  async closeSession(
    sessionId: string,
    businessId: string,
    closedBy: string,
    dto: CloseSessionDto,
  ): Promise<CashSessionEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, businessId },
      relations: ["movements"],
    });
    if (!session) throw new NotFoundException("Sesión de caja no encontrada");
    if (session.closedAt) throw new BadRequestException("La sesión ya está cerrada");

    session.closedBy = closedBy;
    session.closingAmount = dto.closingAmount;
    session.closedAt = new Date();
    if (dto.notes) session.notes = dto.notes;

    const closedSession = await this.sessionRepo.save(session);

    let totalIn = 0;
    let totalOut = 0;
    for (const m of session.movements) {
      if (m.type === CashMovementType.IN) totalIn += Number(m.amount);
      else totalOut += Number(m.amount);
    }

    try {
      await this.amqpConnection.publish('beautyspot.events', EventNames.PAYMENT_CASH_SESSION_CLOSED, {
        eventType: EventNames.PAYMENT_CASH_SESSION_CLOSED,
        timestamp: new Date(),
        correlationId: sessionId,
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`Error publicando evento payment.cash.session.closed: ${errorMessage}`);
    }

    return closedSession;
  }

  async registerMovement(
    sessionId: string,
    businessId: string,
    registeredBy: string,
    dto: RegisterMovementDto,
  ): Promise<CashMovementEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, businessId },
    });
    if (!session) throw new NotFoundException("Sesión de caja no encontrada");
    if (session.closedAt) throw new BadRequestException("No se pueden registrar movimientos en una sesión cerrada");

    return this.movementRepo.save(
      this.movementRepo.create({
        cashSessionId: sessionId,
        type: dto.type,
        amount: dto.amount,
        concept: dto.concept,
        registeredBy,
      }),
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
        closingAmount: session.closingAmount ? Number(session.closingAmount) : null,
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

  async getActiveSession(businessId: string): Promise<CashSessionEntity | null> {
    return this.sessionRepo.findOne({
      where: { businessId, closedAt: null as unknown as undefined },
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
