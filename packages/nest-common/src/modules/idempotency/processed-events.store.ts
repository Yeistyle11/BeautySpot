import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";
import { ProcessedEventEntity } from "./processed-event.entity";

/** Datos mínimos que necesita el store para identificar un evento entrante. */
export interface EventoEntrante {
  eventId: string;
  eventType: string;
}

/** Descarta los eventos que un handler ya aplicó. */
@Injectable()
export class ProcessedEventsStore {
  private readonly logger = new Logger(ProcessedEventsStore.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Marca el evento y ejecuta `trabajo` en la misma transacción, sólo si este
   * handler no lo había procesado.
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
