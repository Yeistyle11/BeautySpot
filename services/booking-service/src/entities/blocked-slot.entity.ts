import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

/** Bloqueo puntual de la agenda de un profesional (vacaciones, descanso) que impide reservar. */
@Entity("blocked_slots")
@Index(["businessId", "professionalId", "date"])
export class BlockedSlot extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" }) professionalId!: string;
  @Column({ type: "date" }) date!: string;
  @Column({ name: "start_time" }) startTime!: string;
  @Column({ name: "end_time" }) endTime!: string;
  @Column({ nullable: true }) reason!: string;
  /**
   * Serie a la que pertenece el bloqueo cuando se creó repetido.
   *
   * Las repeticiones se materializan como filas sueltas —una por día— en vez de
   * guardar la regla: el cálculo de disponibilidad ya lee fechas concretas y no
   * tiene que aprender a expandir nada. Este identificador es lo único que las
   * mantiene unidas, para poder levantar la serie entera de una vez.
   */
  @Index("idx_blocked_slots_serie")
  @Column({ type: "uuid", name: "serie_id", nullable: true })
  serieId!: string | null;
}
