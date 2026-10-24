import { formatearDinero, LOCALE_POR_DEFECTO } from "@beautyspot/shared-utils";
import { fechaEnCastellano, horaEnCastellano } from "./fechas-en-castellano";

/** Colores de cada tono de las píldoras y avisos, los mismos del panel. */
const TONOS = {
  exito: { fondo: "#DCFCE7", texto: "#166534", punto: "#16A34A" },
  aviso: { fondo: "#FEF3C7", texto: "#92400E", punto: "#D97706" },
  info: { fondo: "#DBEAFE", texto: "#1E40AF", punto: "#2563EB" },
  neutro: { fondo: "#F1F5F9", texto: "#334155", punto: "#64748B" },
  marca: { fondo: "#F3EEFF", texto: "#5B21B6", punto: "#7C3AED" },
} as const;

type Tono = keyof typeof TONOS;

/** El último argumento de un ayudante es el `options` de Handlebars, no un dato. */
function sinOpciones(args: unknown[]): unknown[] {
  return args.slice(0, -1);
}

/** Fecha "YYYY-MM-DD" como «Sábado 25 de octubre»; vacío si no es una fecha. */
export function diaCompleto(fecha?: unknown): string {
  if (typeof fecha !== "string" || !fecha) return "";
  const valor = new Date(fecha.includes("T") ? fecha : `${fecha}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return fecha;
  const texto = valor.toLocaleDateString(LOCALE_POR_DEFECTO, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // El locale escribe «domingo, 25 de octubre»; sin la coma se lee de corrido.
  const sinComa = texto.replace(",", "");
  return sinComa.charAt(0).toUpperCase() + sinComa.slice(1);
}

/** Minutos como «45 min», «1 h» o «1 h 30 min». */
export function duracion(minutos?: unknown): string {
  const total = Number(minutos);
  if (!Number.isFinite(total) || total <= 0) return "";
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

/** «Corte + Barba · 1 h», o solo el nombre si no se sabe cuánto dura. */
export function conDuracion(nombre?: unknown, minutos?: unknown): string {
  const texto = typeof nombre === "string" ? nombre : "";
  const tiempo = duracion(minutos);
  return tiempo ? `${texto} · ${tiempo}` : texto;
}

/** El primer nombre, para el saludo: «Camila» de «Camila Restrepo». */
export function primerNombre(nombre?: unknown): string {
  if (typeof nombre !== "string") return "";
  return nombre.trim().split(/\s+/)[0] ?? "";
}

/** Importe en pesos; vacío si no es un número. */
export function dinero(monto?: unknown): string {
  const numero = Number(monto);
  return Number.isFinite(numero) ? formatearDinero(numero) : "";
}

/** «1 hora», «24 horas». */
export function plural(n: unknown, singular: string, plural: string): string {
  return `${n} ${Number(n) === 1 ? singular : plural}`;
}

/** Color de una parte (fondo, texto, punto) de un tono. */
export function color(tono: unknown, parte: unknown): string {
  const t = TONOS[(tono as Tono) in TONOS ? (tono as Tono) : "marca"];
  return t[
    (parte as keyof typeof t) in t ? (parte as keyof typeof t) : "texto"
  ];
}

/** El dominio de una dirección, para escribirla sin «https://». */
export function dominio(url?: unknown): string {
  if (typeof url !== "string") return "";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Ayudantes que se registran en Handlebars, con el nombre que usan las plantillas. */
export const AYUDANTES: Record<string, (...args: unknown[]) => unknown> = {
  fecha: (fecha) => fechaEnCastellano(fecha),
  hora: (hora) => horaEnCastellano(hora),
  diaCompleto: (fecha) => diaCompleto(fecha),
  duracion: (minutos) => duracion(minutos),
  conDuracion: (nombre, minutos) => conDuracion(nombre, minutos),
  primerNombre: (nombre) => primerNombre(nombre),
  dinero: (monto) => dinero(monto),
  plural: (n, singular, varios) => plural(n, String(singular), String(varios)),
  color: (tono, parte) => color(tono, parte),
  dominio: (url) => dominio(url),
  /** Une los textos dados; los vacíos no dejan rastro. */
  concat: (...args) =>
    sinOpciones(args)
      .map((a) => (a === undefined || a === null ? "" : String(a)))
      .join(""),
  /** `si cond a b`: el `if` de Handlebars no devuelve valor en una subexpresión. */
  si: (condicion, siSi, siNo) => (condicion ? siSi : siNo),
};
