import { DataSource } from "typeorm";
import { DailyMetricEntity } from "../../../../services/analytics-service/src/entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../../../services/analytics-service/src/entities/professional-metric.entity";
import { ServiceMetricEntity } from "../../../../services/analytics-service/src/entities/service-metric.entity";
import { ClientMetricEntity } from "../../../../services/analytics-service/src/entities/client-metric.entity";
import { CapacityDailyEntity } from "../../../../services/analytics-service/src/entities/capacity-daily.entity";
import type { Cita, Cobro, Siembra } from "../datos";
import { aMinutos, diaDeLaSemana } from "../fechas";
import { idDe } from "../identidades";
import { borrarPorNegocio, guardar } from "./comun";

/** Acumula en un mapa, creando la entrada la primera vez. */
function acumular<T>(mapa: Map<string, T>, clave: string, inicial: () => T): T {
  const actual = mapa.get(clave) ?? inicial();
  mapa.set(clave, actual);
  return actual;
}

/**
 * Las métricas agregadas del panel.
 *
 * En marcha las construye analytics-service escuchando el bus, evento a
 * evento; la siembra escribe directamente en la base, así que las calcula aquí
 * a partir de las mismas citas y cobros que acaba de sembrar. Salen por
 * construcción cuadradas con ellos, que es lo que importa para poder mirar el
 * panel y contrastarlo con la agenda.
 *
 * Los criterios son los del servicio, no otros: el ingreso es lo que entró por
 * cobros —sin la propina, que no es del negocio—, `ventas` cuenta cobros y no
 * citas, y la métrica se fecha por el día del cobro y no por el de proceso.
 */
export async function sembrarAnalytics(
  dataSource: DataSource,
  siembra: Siembra
) {
  const cobrosPorCita = new Map(siembra.cobros.map((c) => [c.citaId, c]));

  const diarias = new Map<string, DailyMetricEntity>();
  const porProfesional = new Map<string, ProfessionalMetricEntity>();
  const porServicio = new Map<string, ServiceMetricEntity>();
  const porCliente = new Map<string, ClientMetricEntity>();
  const capacidad = new Map<string, CapacityDailyEntity>();

  // La primera visita de cada cliente decide si el día lo cuenta como nuevo o
  // como recurrente, así que hay que conocerla antes de recorrer los días.
  const primeraVisita = new Map<string, string>();
  for (const cita of siembra.citas) {
    if (cita.estado !== "COMPLETED") continue;
    const previa = primeraVisita.get(cita.clienteId);
    if (!previa || cita.fecha < previa) {
      primeraVisita.set(cita.clienteId, cita.fecha);
    }
  }

  for (const cita of siembra.citas) {
    const cobro = cobrosPorCita.get(cita.id);
    sumarDiaria(diarias, cita, cobro, primeraVisita);
    if (cita.estado !== "COMPLETED") continue;
    sumarProfesional(porProfesional, cita, cobro);
    sumarServicio(porServicio, cita);
    sumarCliente(porCliente, cita, cobro);
  }

  // Capacidad: los minutos que el horario del negocio pone a disposición de
  // cada profesional frente a los que llegó a vender. Es el denominador de la
  // ocupación, y sin él la métrica sale en cero por no tener con qué dividir.
  for (const negocio of siembra.negocios) {
    const abre = new Map(negocio.horario.map((h) => [h.dia, h]));
    for (const cita of siembra.citas.filter(
      (c) => c.negocioId === negocio.id
    )) {
      const tramo = abre.get(diaDeLaSemana(cita.fecha));
      if (!tramo) continue;
      const clave = `${cita.profesionalId}|${cita.fecha}`;
      const fila = acumular(capacidad, clave, () =>
        Object.assign(new CapacityDailyEntity(), {
          id: idDe(`capacidad:${clave}`),
          businessId: negocio.id,
          professionalId: cita.profesionalId,
          date: cita.fecha,
          minutosDisponibles: aMinutos(tramo.cierra) - aMinutos(tramo.abre),
          minutosVendidos: 0,
        })
      );
      if (cita.estado === "COMPLETED") {
        fila.minutosVendidos += aMinutos(cita.fin) - aMinutos(cita.inicio);
      }
    }
  }

  return {
    diarias: await guardar(dataSource, DailyMetricEntity, [
      ...diarias.values(),
    ]),
    profesionales: await guardar(dataSource, ProfessionalMetricEntity, [
      ...porProfesional.values(),
    ]),
    servicios: await guardar(dataSource, ServiceMetricEntity, [
      ...porServicio.values(),
    ]),
    clientes: await guardar(dataSource, ClientMetricEntity, [
      ...porCliente.values(),
    ]),
    capacidad: await guardar(dataSource, CapacityDailyEntity, [
      ...capacidad.values(),
    ]),
  };
}

function sumarDiaria(
  diarias: Map<string, DailyMetricEntity>,
  cita: Cita,
  cobro: Cobro | undefined,
  primeraVisita: Map<string, string>
) {
  const clave = `${cita.negocioId}|${cita.fecha}`;
  const fila = acumular(diarias, clave, () =>
    Object.assign(new DailyMetricEntity(), {
      id: idDe(`diaria:${clave}`),
      businessId: cita.negocioId,
      date: cita.fecha,
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      totalRevenue: 0,
      ventas: 0,
      newClients: 0,
      returningClients: 0,
    })
  );

  fila.totalAppointments += 1;
  if (cita.estado === "CANCELLED") fila.cancelledAppointments += 1;
  if (cita.estado === "NO_SHOW") fila.noShowAppointments += 1;
  if (cita.estado !== "COMPLETED") return;

  fila.completedAppointments += 1;
  if (primeraVisita.get(cita.clienteId) === cita.fecha) fila.newClients += 1;
  else fila.returningClients += 1;

  if (cobro) {
    // La propina entra con el cobro pero sale para el profesional: no suma a
    // las ventas del negocio.
    fila.totalRevenue += cobro.importe;
    fila.ventas += 1;
  }
}

function sumarProfesional(
  porProfesional: Map<string, ProfessionalMetricEntity>,
  cita: Cita,
  cobro: Cobro | undefined
) {
  const clave = `${cita.profesionalId}|${cita.fecha}`;
  const fila = acumular(porProfesional, clave, () =>
    Object.assign(new ProfessionalMetricEntity(), {
      id: idDe(`metrica-pro:${clave}`),
      businessId: cita.negocioId,
      professionalId: cita.profesionalId,
      date: cita.fecha,
      appointments: 0,
      revenue: 0,
      rating: 0,
      avgServiceTime: 0,
    })
  );

  const minutos = aMinutos(cita.fin) - aMinutos(cita.inicio);
  // La media se recalcula con la cita que entra, sin guardar el total aparte.
  fila.avgServiceTime = Math.round(
    (fila.avgServiceTime * fila.appointments + minutos) /
      (fila.appointments + 1)
  );
  fila.appointments += 1;
  if (cobro) fila.revenue += cobro.importe;
}

function sumarServicio(
  porServicio: Map<string, ServiceMetricEntity>,
  cita: Cita
) {
  for (const linea of cita.lineas) {
    const clave = `${linea.servicioId}|${cita.fecha}`;
    const fila = acumular(porServicio, clave, () =>
      Object.assign(new ServiceMetricEntity(), {
        id: idDe(`metrica-servicio:${clave}`),
        businessId: cita.negocioId,
        serviceId: linea.servicioId,
        serviceName: linea.nombre,
        date: cita.fecha,
        veces: 0,
        ingresos: 0,
        minutos: 0,
      })
    );
    fila.veces += 1;
    fila.ingresos += linea.precio;
    fila.minutos += linea.duracion;
  }
}

function sumarCliente(
  porCliente: Map<string, ClientMetricEntity>,
  cita: Cita,
  cobro: Cobro | undefined
) {
  const clave = `${cita.negocioId}|${cita.clienteId}`;
  const fila = acumular(porCliente, clave, () =>
    Object.assign(new ClientMetricEntity(), {
      id: idDe(`metrica-cliente:${clave}`),
      businessId: cita.negocioId,
      clientId: cita.clienteId,
      primeraVisita: cita.fecha,
      ultimaVisita: cita.fecha,
      visitas: 0,
      gasto: 0,
    })
  );

  if (cita.fecha < fila.primeraVisita) fila.primeraVisita = cita.fecha;
  if (cita.fecha > fila.ultimaVisita) fila.ultimaVisita = cita.fecha;
  fila.visitas += 1;
  if (cobro) fila.gasto += cobro.importe;
}

/** Retira las métricas de los negocios sembrados. */
export async function limpiarAnalytics(
  dataSource: DataSource,
  negocios: string[]
) {
  for (const tabla of [
    "daily_metrics",
    "professional_metrics",
    "service_metrics",
    "client_metrics",
    "capacity_daily",
  ]) {
    await borrarPorNegocio(dataSource, tabla, negocios);
  }
}
