/**
 * Con qué nace un negocio según su tipo. Preguntar el tipo y luego no usarlo
 * para nada es peor que no preguntarlo: crea la expectativa de que el producto
 * se adapta y entrega un panel de quince secciones vacías sin ninguna pista de
 * por dónde empezar.
 *
 * Los precios son de referencia del mercado colombiano y están para cambiarse:
 * lo que se siembra es indistinguible de lo que el negocio escriba después, sin
 * marca ni bloqueo, y se puede borrar entero.
 */

/** Servicio con el que arranca el catálogo. */
export interface ServicioDePlantilla {
  name: string;
  /** Categoría a la que pertenece; se crea con la plantilla. */
  category: string;
  /** Minutos que ocupa al profesional. */
  duration: number;
  /** Precio orientativo, en pesos. */
  price: number;
}

/** Franja de apertura de un día de la semana (0 domingo … 6 sábado). */
export interface TramoDePlantilla {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface PlantillaDeNegocio {
  /** Categorías del catálogo de servicios. */
  categoriasDeServicio: string[];
  /** Categorías con las que se clasifica al equipo. */
  categoriasDeProfesional: string[];
  servicios: ServicioDePlantilla[];
  horario: TramoDePlantilla[];
}

/** Lunes a sábado con esas horas; el domingo, cerrado. */
function deLunesASabado(
  openTime: string,
  closeTime: string
): TramoDePlantilla[] {
  return [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    openTime,
    closeTime,
  }));
}

/** Martes a sábado; los spas y centros suelen cerrar también el lunes. */
function deMartesASabado(
  openTime: string,
  closeTime: string
): TramoDePlantilla[] {
  return [2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    openTime,
    closeTime,
  }));
}

const BARBERIA: PlantillaDeNegocio = {
  categoriasDeServicio: ["Cabello", "Barba", "Combos"],
  categoriasDeProfesional: ["Barbero", "Barbero senior"],
  servicios: [
    { name: "Corte clásico", category: "Cabello", duration: 30, price: 25000 },
    { name: "Corte y lavado", category: "Cabello", duration: 45, price: 32000 },
    { name: "Corte infantil", category: "Cabello", duration: 30, price: 20000 },
    { name: "Arreglo de barba", category: "Barba", duration: 20, price: 15000 },
    { name: "Afeitado clásico", category: "Barba", duration: 30, price: 22000 },
    { name: "Corte y barba", category: "Combos", duration: 50, price: 38000 },
    { name: "Cejas", category: "Barba", duration: 10, price: 8000 },
  ],
  horario: deLunesASabado("09:00", "20:00"),
};

const SALON: PlantillaDeNegocio = {
  categoriasDeServicio: ["Cabello", "Coloración", "Uñas", "Maquillaje"],
  categoriasDeProfesional: ["Estilista", "Colorista", "Manicurista"],
  servicios: [
    { name: "Corte de dama", category: "Cabello", duration: 45, price: 40000 },
    {
      name: "Lavado y peinado",
      category: "Cabello",
      duration: 45,
      price: 35000,
    },
    { name: "Cepillado", category: "Cabello", duration: 40, price: 30000 },
    {
      name: "Tinte completo",
      category: "Coloración",
      duration: 120,
      price: 130000,
    },
    {
      name: "Retoque de raíz",
      category: "Coloración",
      duration: 90,
      price: 90000,
    },
    { name: "Manicure", category: "Uñas", duration: 45, price: 30000 },
    { name: "Pedicure", category: "Uñas", duration: 60, price: 40000 },
    {
      name: "Maquillaje social",
      category: "Maquillaje",
      duration: 60,
      price: 80000,
    },
  ],
  horario: deMartesASabado("09:00", "19:00"),
};

const SPA: PlantillaDeNegocio = {
  categoriasDeServicio: ["Masajes", "Faciales", "Corporales"],
  categoriasDeProfesional: ["Terapeuta", "Esteticista"],
  servicios: [
    {
      name: "Masaje relajante",
      category: "Masajes",
      duration: 60,
      price: 110000,
    },
    {
      name: "Masaje descontracturante",
      category: "Masajes",
      duration: 60,
      price: 130000,
    },
    {
      name: "Masaje con piedras calientes",
      category: "Masajes",
      duration: 90,
      price: 170000,
    },
    {
      name: "Limpieza facial",
      category: "Faciales",
      duration: 60,
      price: 95000,
    },
    {
      name: "Facial hidratante",
      category: "Faciales",
      duration: 75,
      price: 120000,
    },
    {
      name: "Exfoliación corporal",
      category: "Corporales",
      duration: 60,
      price: 100000,
    },
  ],
  horario: deMartesASabado("10:00", "19:00"),
};

const BELLEZA: PlantillaDeNegocio = {
  categoriasDeServicio: ["Facial", "Depilación", "Pestañas y cejas", "Uñas"],
  categoriasDeProfesional: ["Esteticista", "Especialista en cejas"],
  servicios: [
    {
      name: "Limpieza facial profunda",
      category: "Facial",
      duration: 60,
      price: 95000,
    },
    {
      name: "Peeling químico",
      category: "Facial",
      duration: 45,
      price: 120000,
    },
    {
      name: "Depilación con cera (piernas)",
      category: "Depilación",
      duration: 45,
      price: 60000,
    },
    {
      name: "Depilación de axilas",
      category: "Depilación",
      duration: 15,
      price: 20000,
    },
    {
      name: "Diseño de cejas",
      category: "Pestañas y cejas",
      duration: 30,
      price: 30000,
    },
    {
      name: "Lifting de pestañas",
      category: "Pestañas y cejas",
      duration: 60,
      price: 90000,
    },
    {
      name: "Manicure semipermanente",
      category: "Uñas",
      duration: 60,
      price: 55000,
    },
  ],
  horario: deMartesASabado("09:00", "19:00"),
};

/** Plantilla de cada tipo del catálogo `TIPOS_DE_NEGOCIO`. */
export const PLANTILLAS_POR_TIPO: Record<string, PlantillaDeNegocio> = {
  BARBERIA,
  SALON,
  SPA,
  BELLEZA,
};

/** Con qué nace ese tipo de negocio, o nada si el tipo no tiene plantilla. */
export function plantillaDe(
  businessType?: string | null
): PlantillaDeNegocio | null {
  if (!businessType) return null;
  return PLANTILLAS_POR_TIPO[businessType] ?? null;
}
