import { DEFAULT_WEAK_SECRETS, MIN_SECRET_LENGTH } from "../security/secretos";

/** Qué exige un servicio de su entorno para poder arrancar. */
export interface RequisitosDeEntorno {
  /** Variables que deben existir y no venir vacías. */
  obligatorias?: string[];
  /**
   * Variables que además son secretos: en producción se rechazan las de
   * ejemplo y las demasiado cortas.
   */
  secretos?: string[];
  /** Variables que deben ser una URL que el runtime sepa parsear. */
  urls?: string[];
}

/**
 * Marca de los valores que traen los `.env.example` para que el proyecto
 * arranque en local. Son válidos en desarrollo y nunca en producción.
 */
const MARCA_DE_EJEMPLO = "change-in-production";

/** El entorno, tal y como llega del proceso. */
export type Entorno = Record<string, string | undefined>;

/**
 * Comprueba que el entorno permite arrancar y devuelve todos los problemas que
 * encuentre, no solo el primero.
 */
export function problemasDelEntorno(
  entorno: Entorno,
  requisitos: RequisitosDeEntorno,
  esProduccion: boolean
): string[] {
  const problemas: string[] = [];

  for (const nombre of requisitos.obligatorias ?? []) {
    if (!entorno[nombre]?.trim()) problemas.push(`${nombre} no está definida`);
  }

  for (const nombre of requisitos.secretos ?? []) {
    const valor = entorno[nombre]?.trim();
    if (!valor) {
      problemas.push(`${nombre} no está definida`);
      continue;
    }

    // Fuera de producción se admiten los secretos de ejemplo: son los que
    // hacen que el proyecto arranque recién clonado.
    if (!esProduccion) continue;

    if (DEFAULT_WEAK_SECRETS.includes(valor)) {
      problemas.push(`${nombre} tiene un valor de ejemplo conocido`);
    } else if (valor.includes(MARCA_DE_EJEMPLO)) {
      problemas.push(
        `${nombre} conserva el valor de ejemplo ("...${MARCA_DE_EJEMPLO}")`
      );
    } else if (valor.length < MIN_SECRET_LENGTH) {
      problemas.push(
        `${nombre} es demasiado corta (mínimo ${MIN_SECRET_LENGTH} caracteres)`
      );
    }
  }

  for (const nombre of requisitos.urls ?? []) {
    const valor = entorno[nombre]?.trim();
    if (!valor) {
      problemas.push(`${nombre} no está definida`);
    } else if (!esUrlValida(valor)) {
      problemas.push(`${nombre} no es una URL válida: "${valor}"`);
    }
  }

  return problemas;
}

/** Aborta el arranque si el entorno no da para funcionar. */
export function validarEntorno(
  entorno: Entorno,
  requisitos: RequisitosDeEntorno,
  servicio: string
): void {
  const esProduccion = entorno.NODE_ENV === "production";
  const problemas = problemasDelEntorno(entorno, requisitos, esProduccion);
  if (problemas.length === 0) return;

  throw new Error(
    [
      `${servicio} no puede arrancar: la configuración tiene ${problemas.length} problema(s).`,
      ...problemas.map((p) => `  - ${p}`),
      "Revisa el .env del servicio contra su .env.example.",
    ].join("\n")
  );
}

/**
 * Si el valor es una URL absoluta con destino; se exige `host` porque
 * `new URL()` toma `"localhost:3002"` por esquema.
 */
function esUrlValida(valor: string): boolean {
  try {
    return new URL(valor).host !== "";
  } catch {
    return false;
  }
}
