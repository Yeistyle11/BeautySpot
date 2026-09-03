/**
 * Guarda de la siembra, que corre sin base de datos (`npm run seed:comprobar`).
 *
 * Cubre las dos formas en que esto se rompe solo:
 *
 * 1. **Una columna renombrada en un servicio.** La siembra construye las filas
 *    con `Object.assign(new Entidad(), { … })`, y una propiedad que ya no
 *    existe no da error: se descarta en silencio y la fila se escribe con ese
 *    campo vacío. Aquí se compara cada clave contra los metadatos reales de la
 *    entidad, que TypeORM construye sin conectarse a nada.
 * 2. **Un escenario incoherente.** Que las citas de un profesional se solapen,
 *    que un cobro no cuadre con su reparto, que una caja cierre con un esperado
 *    que no sale de sus movimientos. Nada de eso lo detecta la base: se
 *    escribiría tal cual y luego el panel enseñaría números imposibles.
 */
import "reflect-metadata";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { DataSource } from "typeorm";
import { entities as auth } from "../../../services/auth-service/src/orm-entities";
import { entities as core } from "../../../services/core-service/src/orm-entities";
import { entities as booking } from "../../../services/booking-service/src/orm-entities";
import { entities as payment } from "../../../services/payment-service/src/orm-entities";
import { entities as market } from "../../../services/marketplace-service/src/orm-entities";
import { entities as analytics } from "../../../services/analytics-service/src/orm-entities";
import { construirSiembra } from "./datos";
import { aMinutos } from "./fechas";

const fallos: string[] = [];
const exigir = (condicion: boolean, queja: string) => {
  if (!condicion) fallos.push(queja);
};

/** Nombres de propiedad que cada entidad admite de verdad. */
async function columnasPorEntidad(): Promise<Map<string, Set<string>>> {
  const porEntidad = new Map<string, Set<string>>();
  for (const entidades of [auth, core, booking, payment, market, analytics]) {
    const ds = new DataSource({ type: "postgres", entities: entidades });
    // `buildMetadatas` es interno, pero es lo único que hace falta: leer los
    // metadatos no abre ninguna conexión.
    await (
      ds as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
    for (const meta of ds.entityMetadatas) {
      const nombres = new Set<string>();
      for (const columna of meta.columns) nombres.add(columna.propertyName);
      for (const relacion of meta.relations) nombres.add(relacion.propertyName);
      porEntidad.set(meta.targetName, nombres);
    }
  }
  return porEntidad;
}

/** Comprueba los literales de los escritores contra esos metadatos. */
function comprobarMapeo(porEntidad: Map<string, Set<string>>): number {
  const dir = join(__dirname, "escritura");
  let comprobadas = 0;

  for (const fichero of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const fuente = readFileSync(join(dir, fichero), "utf8");
    const bloques = fuente.matchAll(
      /Object\.assign\(new (\w+)\(\), \{([\s\S]*?)\n(\s*)\}\)/g
    );
    for (const [, entidad, cuerpo] of bloques) {
      const columnas = porEntidad.get(entidad);
      if (!columnas) {
        fallos.push(`${fichero}: no hay metadatos de ${entidad}`);
        continue;
      }
      for (const [, clave] of cuerpo.matchAll(/^\s{8,10}(\w+):/gm)) {
        comprobadas++;
        exigir(
          columnas.has(clave),
          `${fichero}: ${entidad}.${clave} no es una columna`
        );
      }
    }
  }
  return comprobadas;
}

/** Comprueba que el escenario que se va a escribir se sostiene. */
function comprobarEscenario() {
  const siembra = construirSiembra();

  // Determinista: dos construcciones tienen que dar lo mismo, o el escenario de
  // un hallazgo no se le puede pedir a otra persona.
  exigir(
    JSON.stringify(siembra) === JSON.stringify(construirSiembra()),
    "dos construcciones no coinciden: la siembra no es determinista"
  );

  const unicos = (ids: string[], que: string) =>
    exigir(
      new Set(ids).size === ids.length,
      `identificadores repetidos en ${que}`
    );
  unicos(
    siembra.citas.map((c) => c.id),
    "citas"
  );
  unicos(
    siembra.cobros.map((c) => c.id),
    "cobros"
  );
  unicos(
    siembra.resenas.map((r) => r.citaId),
    "reseñas (una por cita)"
  );

  // Ninguna cita se solapa con otra del mismo profesional el mismo día.
  const agenda = new Map<string, { desde: number; hasta: number }[]>();
  for (const cita of siembra.citas) {
    const clave = `${cita.profesionalId}|${cita.fecha}`;
    const previas = agenda.get(clave) ?? [];
    const desde = aMinutos(cita.inicio);
    const hasta = aMinutos(cita.fin);
    for (const otra of previas) {
      exigir(
        desde >= otra.hasta || hasta <= otra.desde,
        `solape en la agenda de ${clave} a las ${cita.inicio}`
      );
    }
    previas.push({ desde, hasta });
    agenda.set(clave, previas);
  }

  // Un cobro por cita atendida, ni uno más.
  const atendidas = siembra.citas.filter((c) => c.estado === "COMPLETED");
  exigir(
    siembra.cobros.length === atendidas.length,
    `${siembra.cobros.length} cobros para ${atendidas.length} citas atendidas`
  );

  // El reparto de un cobro suma lo cobrado más la propina: es el dinero que
  // entró, y de ahí la caja se queda solo la parte en efectivo.
  for (const cobro of siembra.cobros) {
    const suma = cobro.lineas.reduce((total, l) => total + l.importe, 0);
    exigir(
      suma === cobro.importe + cobro.propina,
      `el reparto del cobro ${cobro.id} no suma su importe`
    );
  }

  // Toda caja cerrada cuadra con sus movimientos.
  for (const caja of siembra.cajas) {
    if (caja.esperado === null) continue;
    const entradas = caja.movimientos.reduce((t, m) => t + m.importe, 0);
    exigir(
      caja.aperturaImporte + entradas === caja.esperado,
      `la caja ${caja.id} espera un total que no sale de sus movimientos`
    );
    exigir(
      caja.cierreImporte! - caja.esperado === caja.diferencia,
      `la diferencia de la caja ${caja.id} no es cierre menos esperado`
    );
  }
  unicos(
    siembra.cajas.filter((c) => c.cerradaEn === null).map((c) => c.sedeId),
    "cajas abiertas (solo una por sede)"
  );

  // Nada apunta fuera de su negocio: es justo lo que estos datos sirven para
  // probar, así que no pueden nacer ya cruzados.
  for (const negocio of siembra.negocios) {
    const clientes = new Set(negocio.clientes.map((c) => c.id));
    const profesionales = new Set(negocio.profesionales.map((p) => p.id));
    const servicios = new Set(negocio.servicios.map((s) => s.id));
    for (const cita of siembra.citas.filter(
      (c) => c.negocioId === negocio.id
    )) {
      exigir(
        clientes.has(cita.clienteId),
        `${cita.id}: cliente de otro negocio`
      );
      exigir(
        profesionales.has(cita.profesionalId),
        `${cita.id}: profesional de otro negocio`
      );
      exigir(
        cita.lineas.every((l) => servicios.has(l.servicioId)),
        `${cita.id}: servicio de otro negocio`
      );
    }
  }

  // La factura despeja la base de lo cobrado; no le suma el impuesto encima.
  for (const factura of siembra.facturas) {
    exigir(
      factura.base + factura.impuesto === factura.total,
      `la factura ${factura.numero} no cuadra con su impuesto`
    );
  }

  return {
    citas: siembra.citas.length,
    cobros: siembra.cobros.length,
    cajas: siembra.cajas.length,
    resenas: siembra.resenas.length,
  };
}

async function principal() {
  const propiedades = comprobarMapeo(await columnasPorEntidad());
  const escenario = comprobarEscenario();

  process.stdout.write(
    `Propiedades comprobadas contra las entidades: ${propiedades}\n` +
      `Escenario: ${escenario.citas} citas, ${escenario.cobros} cobros, ` +
      `${escenario.cajas} cajas, ${escenario.resenas} reseñas\n`
  );

  if (fallos.length === 0) {
    process.stdout.write("Todo cuadra.\n");
    return;
  }
  process.exitCode = 1;
  process.stdout.write(`\n${fallos.length} fallos:\n`);
  for (const fallo of fallos.slice(0, 20)) {
    process.stdout.write(`  - ${fallo}\n`);
  }
}

principal().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(error);
});
