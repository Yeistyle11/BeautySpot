import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve, relative } from "path";

/**
 * Vigila que ninguna consulta nueva sobre una tabla multi-tenant se olvide del
 * filtro por negocio.
 *
 * El aislamiento entre negocios es lógico (ADR-002): la columna `businessId` de
 * {@link TenantEntity} y un `where` que la nombre en cada consulta. Ese `where`
 * lo escribe quien programa, así que olvidarlo en una consulta nueva no rompe
 * nada visible: devuelve datos de otros negocios y nadie se entera.
 *
 * TypeORM 0.3 no tiene filtros globales, y meterlos a mano supondría envolver
 * el repositorio de las 24 entidades. En vez de eso, esta prueba lee el código
 * de los servicios y exige que cada consulta sobre una entidad con negocio
 * mencione el filtro en su método, o esté en la lista de excepciones de abajo
 * con el motivo escrito.
 */

/** Métodos del repositorio que leen o tocan filas y por tanto necesitan filtro. */
const METODOS_DE_CONSULTA = [
  "find",
  "findOne",
  "findBy",
  "findOneBy",
  "findAndCount",
  "count",
  "exists",
  "existsBy",
  "update",
  "delete",
  "softDelete",
  "increment",
  "decrement",
  "createQueryBuilder",
];

/**
 * Consultas que a propósito no llevan negocio, con el motivo por el que pueden.
 *
 * Todas caen en uno de tres casos: buscan por clave primaria y comprueban la
 * pertenencia después, buscan por una columna única en toda la plataforma
 * (`slug`, `userId`), o responden a una llamada entre servicios que ya viene
 * autenticada con el secreto interno.
 *
 * La clave es `ruta/del/fichero.ts#metodo`.
 */
const SIN_NEGOCIO_A_PROPOSITO: Record<string, string> = {
  "booking-service/src/modules/appointments/appointments.service.ts#findByIdForClientUser":
    "El cliente final no pertenece a ningún negocio: la cita se busca por id y la pertenencia se comprueba contra sus fichas",
  "core-service/src/modules/clients/clients.service.ts#findMineByUser":
    "Un usuario tiene una ficha por cada negocio donde reservó; la más reciente se busca por userId",
  "core-service/src/modules/clients/clients.service.ts#updateMineByUser":
    "Los datos personales del usuario se actualizan en todas sus fichas, sea cual sea el negocio",
  "core-service/src/modules/internal-clients/internal-clients.controller.ts#findByUser":
    "Ruta interna: devuelve precisamente las fichas del usuario en todos los negocios",
  "core-service/src/modules/internal-profiles/internal-profiles.controller.ts#resolveClient":
    "Ruta interna: otro servicio pide por id el cliente que ya tiene en la mano",
  "core-service/src/modules/internal-profiles/internal-profiles.controller.ts#resolveProfessional":
    "Ruta interna: otro servicio pide por id el profesional que ya tiene en la mano",
  "notification-service/src/modules/notifications/notifications.service.ts#markAsRead":
    "El aviso se busca por su id y por el usuario que lo lee, que es su dueño",
  "payment-service/src/modules/invoices/invoices.service.ts#facturaDelUsuario":
    "La factura se busca por id acotada a las fichas del usuario, que pueden ser de varios negocios",
  "marketplace-service/src/modules/business-profiles/business-profiles.service.ts#findById":
    "Perfil público, buscado por su propio id",
  "marketplace-service/src/modules/business-profiles/business-profiles.service.ts#findTopRated":
    "Feed público: los mejor valorados de toda la plataforma",
  "marketplace-service/src/modules/professional-profiles/professional-profiles.service.ts#deactivateFromCore":
    "Baja propagada desde core, que identifica al profesional por su id",
  "marketplace-service/src/modules/professional-profiles/professional-profiles.service.ts#findBySlug":
    "Perfil público, buscado por un slug único en toda la plataforma",
  "marketplace-service/src/modules/professional-profiles/professional-profiles.service.ts#findById":
    "Perfil público, buscado por su propio id",
  "marketplace-service/src/modules/professional-profiles/professional-profiles.service.ts#findTopRated":
    "Feed público: los mejor valorados de toda la plataforma",
  "marketplace-service/src/modules/reviews/reviews.service.ts#denunciar":
    "Cualquiera puede denunciar cualquier reseña; se busca por su id",
  "marketplace-service/src/modules/reviews/reviews.service.ts#reseñaPropia":
    "Se busca por id y se comprueba que sea de quien la pide",
  "marketplace-service/src/modules/reviews/reviews.service.ts#findById":
    "Reseña pública, buscada por su propio id",
  "marketplace-service/src/modules/reviews/reviews.service.ts#findByAppointment":
    "La cita ya identifica al negocio; quien pregunta trae su id",
  "marketplace-service/src/modules/reviews/reviews.service.ts#markHelpful":
    "El voto de útil se cuenta sobre la reseña señalada por su id",
  "marketplace-service/src/modules/reviews/reviews.service.ts#unmarkHelpful":
    "El voto de útil se retira de la reseña señalada por su id",
};

/** Raíz del repositorio, subiendo desde este fichero. */
const RAIZ = resolve(__dirname, "..", "..", "..", "..");
const SERVICIOS = join(RAIZ, "services");

/** Ficheros `.ts` de producción bajo `dir`. */
function fuentes(dir: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      if (entrada === "node_modules" || entrada === "dist") continue;
      encontrados.push(...fuentes(ruta));
    } else if (
      entrada.endsWith(".ts") &&
      !entrada.endsWith(".spec.ts") &&
      !entrada.endsWith(".int-test.ts")
    ) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

/**
 * Bases de las que se hereda la columna de negocio. `AuditableEntity` la trae
 * porque a su vez extiende {@link TenantEntity}.
 */
const BASES_CON_NEGOCIO = ["TenantEntity", "AuditableEntity"];

/** Entidades con columna de negocio, leídas de los propios ficheros de entidad. */
function entidadesConNegocio(ficheros: string[]): Set<string> {
  const nombres = new Set<string>();
  for (const fichero of ficheros) {
    if (!fichero.endsWith(".entity.ts")) continue;
    const codigo = readFileSync(fichero, "utf-8");
    for (const clase of codigo.matchAll(
      /export class (\w+)(?: extends (\w+))?/g
    )) {
      const heredaNegocio = BASES_CON_NEGOCIO.includes(clase[2] ?? "");
      const declaraNegocio = /\n\s+businessId!?\s*:/.test(codigo);
      if (heredaNegocio || declaraNegocio) nombres.add(clase[1]);
    }
  }
  return nombres;
}

/** Nombre del método de clase que contiene la posición dada. */
function metodoQueContiene(codigo: string, posicion: number): string {
  const cabeceras = [
    ...codigo
      .slice(0, posicion)
      .matchAll(
        /\n {2}(?:private |public |protected )?(?:async )?([\wñáéíóú]+)\(/g
      ),
  ];
  const ultima = cabeceras[cabeceras.length - 1];
  return ultima ? ultima[1] : "(nivel de clase)";
}

interface Consulta {
  clave: string;
  descripcion: string;
}

/** Consultas sobre entidades con negocio cuyo método no nombra el filtro. */
function consultasSinFiltro(): Consulta[] {
  const ficheros = fuentes(SERVICIOS);
  const conNegocio = entidadesConNegocio(ficheros);
  const sinFiltro: Consulta[] = [];

  for (const fichero of ficheros) {
    const codigo = readFileSync(fichero, "utf-8");
    const propiedades = new Map<string, string>();
    const inyecciones = codigo.matchAll(
      /@InjectRepository\((\w+)\)\s*(?:private |public |protected )?(?:readonly )?(\w+)\s*:/g
    );
    for (const inyeccion of inyecciones) {
      if (conNegocio.has(inyeccion[1])) {
        propiedades.set(inyeccion[2], inyeccion[1]);
      }
    }
    if (propiedades.size === 0) continue;

    for (const [propiedad, entidad] of propiedades) {
      const llamadas = codigo.matchAll(
        new RegExp(`this\\.${propiedad}\\.(\\w+)\\(`, "g")
      );
      for (const llamada of llamadas) {
        if (!METODOS_DE_CONSULTA.includes(llamada[1])) continue;
        const metodo = metodoQueContiene(codigo, Number(llamada.index));
        const cuerpo = cuerpoDelMetodo(codigo, Number(llamada.index));
        if (/businessId|business_id/.test(cuerpo)) continue;

        const ruta = relative(SERVICIOS, fichero).replace(/\\/g, "/");
        sinFiltro.push({
          clave: `${ruta}#${metodo}`,
          descripcion: `${ruta}#${metodo} → ${propiedad}(${entidad}).${llamada[1]}()`,
        });
      }
    }
  }

  return sinFiltro;
}

/** Texto del método que contiene la posición, para buscar en él el filtro. */
function cuerpoDelMetodo(codigo: string, posicion: number): string {
  const inicio = Math.max(
    codigo.lastIndexOf("\n  async ", posicion),
    codigo.lastIndexOf("\n  private ", posicion),
    codigo.lastIndexOf("\n  public ", posicion),
    codigo.lastIndexOf("\n  protected ", posicion)
  );
  const fin = codigo.indexOf("\n  }", posicion);
  return codigo.slice(inicio < 0 ? 0 : inicio, fin < 0 ? codigo.length : fin);
}

describe("Aislamiento entre negocios: el filtro por tenant es explícito", () => {
  const sinFiltro = consultasSinFiltro();

  it("toda consulta sobre una tabla con negocio lo filtra o está justificada", () => {
    const inesperadas = sinFiltro
      .filter((c) => !(c.clave in SIN_NEGOCIO_A_PROPOSITO))
      .map((c) => c.descripcion);

    expect(inesperadas).toEqual([]);
  });

  // Una excepción que sobra es tan mala como una que falta: significa que la
  // consulta ya filtra y la lista quedó describiendo algo que no existe.
  it("no sobra ninguna excepción de la lista", () => {
    const usadas = new Set(sinFiltro.map((c) => c.clave));
    const huerfanas = Object.keys(SIN_NEGOCIO_A_PROPOSITO).filter(
      (clave) => !usadas.has(clave)
    );

    expect(huerfanas).toEqual([]);
  });

  // Si el barrido deja de encontrar consultas, la prueba pasaría sin mirar nada.
  it("el barrido encuentra código que revisar", () => {
    expect(sinFiltro.length).toBeGreaterThan(0);
  });
});
