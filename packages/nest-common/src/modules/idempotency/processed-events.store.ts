import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";
import { ProcessedEventEntity } from "./processed-event.entity";

/** Datos mínimos que necesita el store para identificar un evento entrante. */
export interface EventoEntrante {
  eventId: string;
  eventType: string;
}

/**
 * Descarta los eventos que un handler ya aplicó.
 *
 * La entrega del bus es at-least-once: el relay del outbox reintenta si falla la
 * publicación, y RabbitMQ reentrega si el consumidor no confirma. Sin este
 * filtro, un evento entregado dos veces se aplica dos veces, y en los
 * consumidores que acumulan contadores eso corrompe los datos de forma
 * permanente y silenciosa: no hay forma de distinguir después un contador
 * inflado de uno legítimo.
 */
@Injectable()
export class ProcessedEventsStore {
  private readonly logger = new Logger(ProcessedEventsStore.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Ejecuta `trabajo` sólo si este handler no había procesado ya el evento.
   *
   * La marca se inserta y el trabajo se ejecuta **en la misma transacción**, y
   * por eso `trabajo` recibe el EntityManager: si escribe fuera de él, la
   * atomicidad se pierde y un fallo posterior deja el evento marcado sin
   * haberse aplicado. La marca va primero para que dos entregas simultáneas del
   * mismo evento choquen en la clave primaria en vez de duplicar el trabajo.
   *
   * @returns true si se aplicó, false si ya estaba procesado.
   */
  async once(
    evento: EventoEntrante,
    handler: string,
    trabajo: (manager: EntityManager) => Promise<void>
  ): Promise<boolean> {
    if (!evento?.eventId) {
      // Un evento sin identidad no se puede deduplicar. Se procesa igualmente
      // —perderlo sería peor— pero queda constancia, porque significa que
      // alguien está publicando fuera del contrato.
      this.logger.warn(
        `Evento ${evento?.eventType ?? "desconocido"} sin eventId: se procesa sin control de duplicados`
      );
      return this.dataSource.transaction(async (manager) => {
        await trabajo(manager);
        return true;
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const insercion = await manager
        .createQueryBuilder()
        .insert()
        .into(ProcessedEventEntity)
        .values({
          eventId: evento.eventId,
          handler,
          eventType: evento.eventType,
        })
        .orIgnore()
        .execute();

      // orIgnore() traduce a ON CONFLICT DO NOTHING: sin filas afectadas, otro
      // intento ya lo procesó.
      if (!insercion.raw?.length) {
        this.logger.debug(
          `Evento ${evento.eventId} ya procesado por ${handler}, se descarta`
        );
        return false;
      }

      await trabajo(manager);
      return true;
    });
  }
}
