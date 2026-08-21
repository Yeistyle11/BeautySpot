import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";
import { ServicioDeLaCita } from "@beautyspot/event-types";

/** Si la visita es la primera del cliente en el negocio o una más. */
export type TipoDeVisita = "nueva" | "recurrente";

/** Escribe las métricas por cliente, por servicio y de capacidad. */
@Injectable()
export class NegocioMetricsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Anota la visita del cliente y devuelve si era la primera. */
  async registrarVisita(
    businessId: string,
    clientId: string,
    date: string,
    importe: number,
    manager?: EntityManager
  ): Promise<TipoDeVisita> {
    const filas = (await (manager ?? this.dataSource).query(
      `INSERT INTO client_metrics
         (id, business_id, client_id, primera_visita, ultima_visita, visitas, gasto)
       VALUES (gen_random_uuid(), $1, $2, $3, $3, 1, $4)
       ON CONFLICT (business_id, client_id) DO UPDATE SET
         ultima_visita = GREATEST(client_metrics.ultima_visita, EXCLUDED.ultima_visita),
         primera_visita = LEAST(client_metrics.primera_visita, EXCLUDED.primera_visita),
         visitas = client_metrics.visitas + 1,
         gasto = client_metrics.gasto + EXCLUDED.gasto
       RETURNING visitas`,
      [businessId, clientId, date, importe]
    )) as { visitas: number }[];

    return Number(filas[0]?.visitas) === 1 ? "nueva" : "recurrente";
  }

  /** Suma al servicio las veces prestado, los ingresos y los minutos del día. */
  async registrarServicios(
    businessId: string,
    date: string,
    servicios: ServicioDeLaCita[],
    manager?: EntityManager
  ): Promise<void> {
    if (servicios.length === 0) return;

    // Se agrupan antes de escribir por dos motivos: una cita puede llevar dos
    // veces el mismo servicio, y Postgres rechaza que un ON CONFLICT toque la
    // misma fila dos veces en la misma sentencia.
    const porServicio = new Map<
      string,
      { name: string; veces: number; ingresos: number; minutos: number }
    >();
    for (const servicio of servicios) {
      const acumulado = porServicio.get(servicio.serviceId) ?? {
        name: servicio.name,
        veces: 0,
        ingresos: 0,
        minutos: 0,
      };
      acumulado.name = servicio.name;
      acumulado.veces += 1;
      acumulado.ingresos += Number(servicio.price);
      acumulado.minutos += Number(servicio.duration);
      porServicio.set(servicio.serviceId, acumulado);
    }

    // Una sola sentencia para todos los servicios de la cita: iba dentro de la
    // transaccion del evento, y un UPSERT por servicio la alargaba tanto como
    // servicios llevara.
    const valores: unknown[] = [businessId, date];
    const tuplas = [...porServicio].map(([serviceId, acumulado]) => {
      const primero = valores.length + 1;
      valores.push(
        serviceId,
        acumulado.name,
        acumulado.veces,
        acumulado.ingresos,
        acumulado.minutos
      );
      return `(gen_random_uuid(), $1, $${primero}, $${primero + 1}, $2, $${
        primero + 2
      }, $${primero + 3}, $${primero + 4})`;
    });

    await (manager ?? this.dataSource).query(
      `INSERT INTO service_metrics
         (id, business_id, service_id, service_name, date, veces, ingresos, minutos)
       VALUES ${tuplas.join(", ")}
       ON CONFLICT (business_id, service_id, date) DO UPDATE SET
         service_name = EXCLUDED.service_name,
         veces = service_metrics.veces + EXCLUDED.veces,
         ingresos = service_metrics.ingresos + EXCLUDED.ingresos,
         minutos = service_metrics.minutos + EXCLUDED.minutos`,
      valores
    );
  }

  /** Suma los minutos que la cita ocupó en la agenda del profesional. */
  async registrarMinutosVendidos(
    businessId: string,
    professionalId: string,
    date: string,
    minutos: number,
    manager?: EntityManager
  ): Promise<void> {
    await (manager ?? this.dataSource).query(
      `INSERT INTO capacity_daily
         (id, business_id, professional_id, date, minutos_disponibles, minutos_vendidos)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, $4)
       ON CONFLICT (business_id, professional_id, date) DO UPDATE SET
         minutos_vendidos = capacity_daily.minutos_vendidos + EXCLUDED.minutos_vendidos`,
      [businessId, professionalId, date, minutos]
    );
  }

  /**
   * Fija de una vez la capacidad de todo el equipo de un negocio ese dia, en un
   * solo `INSERT` con varias filas.
   */
  async fijarCapacidadDelDia(
    businessId: string,
    date: string,
    equipo: { professionalId: string; minutosDisponibles: number }[]
  ): Promise<void> {
    if (equipo.length === 0) return;

    // $1 y $2 son el negocio y el día; cada profesional añade su pareja.
    const valores = equipo
      .map(
        (_, i) => `(gen_random_uuid(), $1, $${i * 2 + 3}, $2, $${i * 2 + 4}, 0)`
      )
      .join(", ");

    await this.dataSource.query(
      `INSERT INTO capacity_daily
         (id, business_id, professional_id, date, minutos_disponibles, minutos_vendidos)
       VALUES ${valores}
       ON CONFLICT (business_id, professional_id, date) DO UPDATE SET
         minutos_disponibles = EXCLUDED.minutos_disponibles`,
      [
        businessId,
        date,
        ...equipo.flatMap((p) => [p.professionalId, p.minutosDisponibles]),
      ]
    );
  }
}
