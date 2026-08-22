// ─── Proxy ─────────────────────────────────────────────────────────

/** Tiempo máximo (ms) que el gateway espera la respuesta de un servicio antes de abortar. */
export const PROXY_TIMEOUT_MS = 10_000;

// ─── Límite de peticiones ─────────────────────────────────────────────────

/** Máximo de peticiones a rutas de autenticación por ventana (más estricto por seguridad). */
export const RATE_LIMIT_AUTH_REQUESTS = 5;
/** Máximo de peticiones a rutas generales por ventana. */
export const RATE_LIMIT_GENERAL_REQUESTS = 100;
/**
 * Máximo de reservas públicas por ventana. Un invitado reserva una vez y se va;
 * lo que este número corta es llenar la agenda de un salón con citas falsas,
 * que además dispara un correo por cada una.
 */
export const RATE_LIMIT_RESERVA_PUBLICA_REQUESTS = 5;
/** Duración (segundos) de la ventana deslizante del rate limiting. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

// ─── Reglas de negocio ─────────────────────────────────────────────

/** Horas mínimas de antelación para cancelar o reagendar una cita sin coste. */
export const HORAS_MINIMAS_CANCELACION = 2;

/** Proporción del importe de la cita que se convierte en puntos de fidelidad. */
export const PROPORCION_PUNTOS_FIDELIDAD = 0.1;

/**
 * Lo que descuenta un punto al canjearlo, en la moneda del negocio; es el
 * inverso de `PROPORCION_PUNTOS_FIDELIDAD`.
 */
export const VALOR_DEL_PUNTO = 1;

/**
 * Colores con los que se puede pintar un nivel de fidelidad. La lista es
 * cerrada: el color acaba en una clase de Tailwind compilada.
 */
export const COLORES_DE_NIVEL = [
  "bronce",
  "plata",
  "oro",
  "cian",
  "morado",
  "verde",
  "rosa",
  "azul",
] as const;

export type ColorDeNivel = (typeof COLORES_DE_NIVEL)[number];

/** Escalón del programa de fidelidad: a partir de `min` puntos, el cliente es `label`. */
export interface NivelDeFidelidad {
  min: number;
  label: string;
  color: ColorDeNivel;
}

/** Niveles que ve un negocio que no ha configurado los suyos. */
export const NIVELES_FIDELIDAD_POR_DEFECTO: NivelDeFidelidad[] = [
  { min: 0, label: "Bronce", color: "bronce" },
  { min: 100, label: "Plata", color: "plata" },
  { min: 300, label: "Oro", color: "oro" },
  { min: 600, label: "Platino", color: "cian" },
  { min: 1000, label: "Diamante", color: "morado" },
];

/** Escalones que puede tener el programa, para que la pantalla no crezca sin fin. */
export const MAXIMO_NIVELES_FIDELIDAD = 8;

/**
 * Nivel alcanzado con esos puntos, o el mas bajo si no llega a ninguno. Da por
 * hecho que los niveles vienen ordenados de menos a mas.
 */
export function nivelDePuntos(
  puntos: number,
  niveles: NivelDeFidelidad[] = NIVELES_FIDELIDAD_POR_DEFECTO
): NivelDeFidelidad | null {
  let alcanzado: NivelDeFidelidad | null = null;
  for (const nivel of niveles) {
    if (puntos >= nivel.min) alcanzado = nivel;
  }
  return alcanzado ?? niveles[0] ?? null;
}

/** Siguiente nivel por alcanzar, o `null` si ya está en el más alto. */
export function siguienteNivel(
  puntos: number,
  niveles: NivelDeFidelidad[] = NIVELES_FIDELIDAD_POR_DEFECTO
): NivelDeFidelidad | null {
  return niveles.find((nivel) => puntos < nivel.min) ?? null;
}

/** IVA colombiano que se aplica al facturar. */
export const IVA = 0.19;

/** Validez (segundos) de las URLs prefirmadas de subida y descarga de imágenes. */
export const URL_PREFIRMADA_SEGUNDOS = 3600;

/**
 * Lo más que puede pedirse que dure una URL prefirmada: un día. Quien tiene el
 * enlace tiene la imagen mientras el enlace viva, así que la validez la acota
 * el servidor y no quien la pide.
 */
export const URL_PREFIRMADA_MAXIMO_SEGUNDOS = 24 * 3600;

/** Lo mínimo que tiene sentido pedir: por debajo, la subida no da tiempo. */
export const URL_PREFIRMADA_MINIMO_SEGUNDOS = 60;

/**
 * Longitud máxima del texto de una búsqueda. Nadie escribe un nombre de salón
 * de cien caracteres, y sin tope el texto entero entra en el LIKE.
 */
export const LONGITUD_MAXIMA_BUSQUEDA = 100;

// ─── Validación de datos de contacto ───────────────────────────────

/**
 * Telefono aceptado: entre 7 y 20 digitos, con prefijo internacional y
 * separadores opcionales.
 */
export const PATRON_TELEFONO = /^\+?[\d][\d\s().-]{5,19}$/;

/** Mensaje único para el teléfono, para que todos los formularios digan lo mismo. */
export const MENSAJE_TELEFONO =
  "El teléfono debe tener entre 7 y 20 dígitos, con prefijo internacional opcional";

/** Horas que vale el enlace de confirmación de correo. */
export const HORAS_VERIFICACION_CORREO = 24;

/** Fallos de contraseña seguidos que bloquean la cuenta. */
export const MAX_INTENTOS_FALLIDOS = 5;

/** Minutos que dura el primer bloqueo; los siguientes doblan la espera. */
export const BLOQUEO_BASE_MINUTOS = 15;

/** Tope de la espera, para que un bloqueo no se vuelva permanente. */
export const BLOQUEO_MAXIMO_MINUTOS = 24 * 60;

/** Longitud mínima de una contraseña. */
export const LONGITUD_MINIMA_CONTRASENA = 10;

/** Contraseña aceptada: al menos una minúscula, una mayúscula y un dígito. */
export const PATRON_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

/** Mensaje único para la contraseña, para que todos los formularios digan lo mismo. */
export const MENSAJE_CONTRASENA =
  "La contraseña debe combinar mayúsculas, minúsculas y números";

/** Contrasenas descartadas por comunes, las primeras de un diccionario. */
export const CONTRASENAS_PROHIBIDAS = [
  "password",
  "contrasena",
  "contraseña",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "beautyspot",
  "administrador",
];

/**
 * Tipos de negocio que admite la plataforma: `etiqueta` nombra uno,
 * `categoria` nombra al conjunto en la portada e `icono`, su dibujo.
 */
export const TIPOS_DE_NEGOCIO = [
  {
    valor: "BARBERIA",
    etiqueta: "Barbería",
    categoria: "Barberías",
    icono: "scissors",
  },
  {
    valor: "SALON",
    etiqueta: "Salón de belleza",
    categoria: "Salones de belleza",
    icono: "mirror",
  },
  { valor: "SPA", etiqueta: "Spa", categoria: "Spas", icono: "spa" },
  {
    valor: "BELLEZA",
    etiqueta: "Centro estético",
    categoria: "Centros estéticos",
    icono: "sparkles",
  },
] as const;

/** Valores válidos de tipo de negocio, para validar lo que llega por la API. */
export const VALORES_TIPO_DE_NEGOCIO: string[] = TIPOS_DE_NEGOCIO.map(
  (t) => t.valor
);
