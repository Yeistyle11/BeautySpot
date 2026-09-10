import "reflect-metadata";
import { DataSource } from "typeorm";
import { entities as entidadesAuth } from "../../../services/auth-service/src/orm-entities";
import { entities as entidadesCore } from "../../../services/core-service/src/orm-entities";
import { entities as entidadesBooking } from "../../../services/booking-service/src/orm-entities";
import { entities as entidadesPayment } from "../../../services/payment-service/src/orm-entities";
import { entities as entidadesMarketplace } from "../../../services/marketplace-service/src/orm-entities";
import { entities as entidadesAnalytics } from "../../../services/analytics-service/src/orm-entities";
import { conectar, rechazarProduccion } from "./entorno";
import { CONTRASENA, construirSiembra, type Siembra } from "./datos";
import { limpiarAuth, sembrarAuth } from "./escritura/auth";
import { limpiarCore, sembrarCore } from "./escritura/core";
import { limpiarBooking, sembrarBooking } from "./escritura/booking";
import { limpiarPayment, sembrarPayment } from "./escritura/payment";
import {
  limpiarMarketplace,
  sembrarMarketplace,
} from "./escritura/marketplace";
import { limpiarAnalytics, sembrarAnalytics } from "./escritura/analytics";

/** Escribe en la salida estándar; esto es una herramienta de línea de órdenes. */
function decir(linea = "") {
  process.stdout.write(`${linea}\n`);
}

const AYUDA = `
Siembra el entorno de desarrollo: dos negocios, seis cuentas por rol y la
actividad necesaria para que agenda, caja, facturas, escaparate y métricas
tengan algo que enseñar.

  npm run seed                 siembra (o resiembra sobre lo ya sembrado)
  npm run seed -- --limpiar    borra lo sembrado y vuelve a sembrarlo
  npm run seed -- --solo-borrar   borra lo sembrado y no siembra
  npm run seed -- --forzar     acepta una base que no sea local
  npm run seed -- --ayuda      esto

Es repetible: los identificadores se derivan del nombre de cada cosa, así que
una segunda pasada reescribe las mismas filas en lugar de duplicarlas. El
borrado solo alcanza a los dos negocios sembrados y a sus seis cuentas; lo que
haya escrito otra persona en la base de desarrollo se queda donde está.
`.trimStart();

async function principal() {
  const argumentos = process.argv.slice(2);
  if (argumentos.includes("--ayuda") || argumentos.includes("-h")) {
    decir(AYUDA);
    return;
  }

  const soloBorrar = argumentos.includes("--solo-borrar");
  const limpiar = soloBorrar || argumentos.includes("--limpiar");
  const forzar = argumentos.includes("--forzar");

  rechazarProduccion();

  const siembra = construirSiembra();
  const negocios = siembra.negocios.map((n) => n.id);
  const opciones = { forzar };

  const conexiones: DataSource[] = [];
  try {
    const auth = await conectar("auth", entidadesAuth, opciones);
    const core = await conectar("core", entidadesCore, opciones);
    const booking = await conectar("booking", entidadesBooking, opciones);
    const payment = await conectar("payment", entidadesPayment, opciones);
    const market = await conectar(
      "marketplace",
      entidadesMarketplace,
      opciones
    );
    const analytics = await conectar("analytics", entidadesAnalytics, opciones);
    conexiones.push(auth, core, booking, payment, market, analytics);

    if (limpiar) {
      decir("Borrando lo sembrado…");
      // De lo derivado a lo que lo sostiene: las métricas y el escaparate
      // cuelgan de citas y cobros, y todo cuelga del negocio.
      await limpiarAnalytics(analytics, negocios);
      await limpiarMarketplace(market, negocios);
      await limpiarPayment(payment, negocios);
      await limpiarBooking(booking, negocios);
      await limpiarCore(core, negocios);
      await limpiarAuth(auth, siembra);
      decir("Listo.");
      if (soloBorrar) return;
      decir();
    }

    const resumen: Record<string, Record<string, number>> = {};
    decir("Sembrando…");
    resumen["auth"] = await sembrarAuth(auth, siembra);
    resumen["core"] = await sembrarCore(core, siembra);
    resumen["booking"] = await sembrarBooking(booking, siembra);
    resumen["payment"] = await sembrarPayment(payment, siembra);
    resumen["marketplace"] = await sembrarMarketplace(market, siembra);
    resumen["analytics"] = await sembrarAnalytics(analytics, siembra);

    informar(siembra, resumen);
  } finally {
    for (const conexion of conexiones) {
      if (conexion.isInitialized) await conexion.destroy();
    }
  }
}

/** El parte de lo sembrado, que es lo que se copia a un informe de QA. */
function informar(
  siembra: Siembra,
  resumen: Record<string, Record<string, number>>
) {
  decir();
  for (const [servicio, filas] of Object.entries(resumen)) {
    const detalle = Object.entries(filas)
      .map(([que, cuantas]) => `${que} ${cuantas}`)
      .join(", ");
    decir(`  ${servicio.padEnd(12)} ${detalle}`);
  }

  decir();
  decir(`Contraseña de todas las cuentas: ${CONTRASENA}`);
  decir();
  for (const cuenta of siembra.cuentas) {
    const negocio = siembra.negocios.find((n) => n.id === cuenta.negocioId);
    decir(
      `  ${(cuenta.rol ?? "CLIENT").padEnd(13)} ${cuenta.email.padEnd(28)} ${
        negocio ? negocio.nombre : "—"
      }`
    );
  }

  decir();
  decir("Negocios (los identificadores valen para probar el aislamiento):");
  for (const negocio of siembra.negocios) {
    decir(`  ${negocio.nombre.padEnd(20)} ${negocio.id}  /${negocio.slug}`);
  }
}

principal().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
});
