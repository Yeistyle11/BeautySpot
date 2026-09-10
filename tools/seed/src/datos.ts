import { Role } from "@beautyspot/shared-types";
import { generateSlug } from "@beautyspot/shared-utils";
import { IVA } from "@beautyspot/shared-constants";
import {
  plantillaDe,
  type PlantillaDeNegocio,
} from "../../../services/core-service/src/modules/businesses/plantillas-por-tipo";
import { entero, generador, idDe, unoDe } from "./identidades";
import {
  aHora,
  aMinutos,
  diaDeLaSemana,
  hoy,
  instante,
  rangoDeDias,
  sumarDias,
} from "./fechas";

/** Contraseña común de todas las cuentas sembradas. */
export const CONTRASENA = "Prueba2026!";

/** Días de historia que se siembran hacia atrás, y de agenda hacia delante. */
const DIAS_DE_HISTORIA = 60;
const DIAS_DE_AGENDA = 7;

// ─── Formas del escenario ────────────────────────────────────────────────────

export interface Cuenta {
  id: string;
  email: string;
  nombre: string;
  telefono: string;
  /** Rol de su membresía, o `null` si es un cliente final sin negocio. */
  rol: Role | null;
  negocioId: string | null;
}

export interface Sede {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
}

export interface ServicioSembrado {
  id: string;
  nombre: string;
  categoria: string;
  categoriaId: string;
  duracion: number;
  precio: number;
}

export interface Profesional {
  id: string;
  sedeId: string;
  nombre: string;
  categoria: string;
  categoriaId: string;
  especialidades: string[];
  aniosExp: number;
  bio: string;
  /** Cuenta con la que entra al panel, si la tiene. */
  usuarioId: string | null;
}

export interface ClienteSembrado {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  usuarioId: string | null;
  cumple: string | null;
  puntos: number;
}

export interface LineaDeCita {
  id: string;
  servicioId: string;
  nombre: string;
  precio: number;
  duracion: number;
  orden: number;
}

export type EstadoDeCita =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Cita {
  id: string;
  negocioId: string;
  sedeId: string;
  clienteId: string;
  profesionalId: string;
  fecha: string;
  inicio: string;
  fin: string;
  estado: EstadoDeCita;
  total: number;
  lineas: LineaDeCita[];
}

export interface LineaDeCobro {
  id: string;
  metodo: "CASH" | "CARD" | "TRANSFER";
  importe: number;
}

export interface Cobro {
  id: string;
  negocioId: string;
  sedeId: string;
  citaId: string;
  clienteId: string;
  profesionalId: string;
  /** Lo que se queda el negocio: servicios menos descuento comercial. */
  importe: number;
  descuentoComercial: number;
  motivoDescuento: string | null;
  propina: number;
  metodo: "CASH" | "CARD" | "TRANSFER" | "MIXED";
  lineas: LineaDeCobro[];
  registradoPor: string;
  fecha: string;
  hora: string;
}

export interface MovimientoDeCaja {
  id: string;
  tipo: "IN" | "OUT";
  importe: number;
  concepto: string;
  metodo: "CASH" | null;
  cobroId: string | null;
  registradoPor: string;
}

export interface SesionDeCaja {
  id: string;
  negocioId: string;
  sedeId: string;
  abiertaPor: string;
  cerradaPor: string | null;
  aperturaImporte: number;
  abiertaEn: Date;
  cerradaEn: Date | null;
  cierreImporte: number | null;
  esperado: number | null;
  diferencia: number | null;
  notas: string | null;
  movimientos: MovimientoDeCaja[];
}

export interface Factura {
  id: string;
  negocioId: string;
  clienteId: string;
  cobroId: string;
  numero: string;
  fecha: string;
  vence: string;
  base: number;
  tasa: number;
  impuesto: number;
  total: number;
  estado: "PAID";
  lineas: {
    id: string;
    descripcion: string;
    cantidad: number;
    precio: number;
  }[];
}

export interface Resena {
  id: string;
  negocioId: string;
  citaId: string;
  clienteId: string;
  profesionalId: string;
  profesionalNombre: string;
  servicioNombre: string;
  nota: number;
  comentario: string;
  respuesta: string | null;
  fecha: Date;
}

export interface Bloqueo {
  id: string;
  negocioId: string;
  profesionalId: string;
  fecha: string;
  inicio: string;
  fin: string;
  motivo: string;
}

export interface Negocio {
  id: string;
  nombre: string;
  slug: string;
  tipo: string;
  descripcion: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  lat: number;
  lng: number;
  /** Frase del escaparate y relato, que es lo que pinta el perfil inmersivo. */
  lema: string;
  relato: string;
  sedes: Sede[];
  categoriasDeServicio: Categoria[];
  categoriasDeProfesional: Categoria[];
  servicios: ServicioSembrado[];
  horario: { dia: number; abre: string; cierra: string }[];
  profesionales: Profesional[];
  clientes: ClienteSembrado[];
}

export interface Siembra {
  cuentas: Cuenta[];
  negocios: Negocio[];
  citas: Cita[];
  cobros: Cobro[];
  cajas: SesionDeCaja[];
  facturas: Factura[];
  resenas: Resena[];
  bloqueos: Bloqueo[];
}

// ─── Definición de los dos negocios ──────────────────────────────────────────

/**
 * Los identificadores de los dos negocios van fijos y no derivados: los citan
 * los documentos de QA para las pruebas de aislamiento por URL, donde hace
 * falta poder escribir a mano el negocio ajeno.
 */
export const NEGOCIO_A = "632f8391-d9ba-4d76-bc2c-1d20dae78ff6";
export const NEGOCIO_B = "0878891c-9bf9-4d28-8d28-ba5cdb3b6f69";

/** Las seis cuentas, una por rol más el segundo dueño que hace de tenant B. */
export const CUENTAS: Cuenta[] = [
  {
    id: idDe("usuario:owner"),
    email: "owner@beautyspot.local",
    nombre: "Camilo Restrepo",
    telefono: "+573001110001",
    rol: Role.OWNER,
    negocioId: NEGOCIO_A,
  },
  {
    id: idDe("usuario:admin"),
    email: "admin@beautyspot.local",
    nombre: "Laura Mejía",
    telefono: "+573001110002",
    rol: Role.ADMIN,
    negocioId: NEGOCIO_A,
  },
  {
    id: idDe("usuario:pro"),
    email: "pro@beautyspot.local",
    nombre: "Andrés Quintero",
    telefono: "+573001110003",
    rol: Role.PROFESSIONAL,
    negocioId: NEGOCIO_A,
  },
  {
    id: idDe("usuario:recep"),
    email: "recep@beautyspot.local",
    nombre: "Valentina Ríos",
    telefono: "+573001110004",
    rol: Role.RECEPTIONIST,
    negocioId: NEGOCIO_A,
  },
  {
    // Cliente final: sin membresía a propósito. Con memberships vacías el
    // token sale como CLIENT y sin businessId, que es la situación real de
    // quien reserva por el escaparate.
    id: idDe("usuario:cliente"),
    email: "cliente@beautyspot.local",
    nombre: "Sofía Herrera",
    telefono: "+573001110005",
    rol: null,
    negocioId: null,
  },
  {
    id: idDe("usuario:ownerb"),
    email: "ownerb@beautyspot.local",
    nombre: "Marcela Ospina",
    telefono: "+573001110006",
    rol: Role.OWNER,
    negocioId: NEGOCIO_B,
  },
];

/** Nombres con los que se rellenan las fichas de cliente. */
const NOMBRES = [
  "Ana Lucía Cárdenas",
  "Jorge Beltrán",
  "Mariana Osorio",
  "Felipe Zuluaga",
  "Catalina Duque",
  "Sebastián Arango",
  "Daniela Peña",
  "Óscar Villamil",
  "Juliana Castaño",
  "Ricardo Naranjo",
  "Paola Guerrero",
  "Tomás Escobar",
  "Lucía Bermúdez",
  "Emilio Vargas",
];

const COMENTARIOS = [
  "Quedé feliz con el resultado, muy puntuales.",
  "Buen trato y el local impecable. Vuelvo seguro.",
  "Me atendieron a la hora exacta, sin esperas.",
  "Muy buen servicio, aunque el parqueadero es complicado.",
  "Excelente trabajo, se nota la experiencia.",
  "Salí muy conforme, repetiré el mes que viene.",
];

/** Crea las categorías de la plantilla con identificador estable. */
function categorias(
  negocioId: string,
  clase: "servicio" | "profesional",
  nombres: string[]
): Categoria[] {
  return nombres.map((nombre, orden) => ({
    id: idDe(`categoria:${clase}:${negocioId}:${nombre}`),
    nombre,
    orden,
  }));
}

/** Expande la plantilla del tipo de negocio en catálogo y horario. */
function desdePlantilla(negocioId: string, tipo: string) {
  const plantilla = plantillaDe(tipo) as PlantillaDeNegocio;
  const deServicio = categorias(
    negocioId,
    "servicio",
    plantilla.categoriasDeServicio
  );
  const porNombre = new Map(deServicio.map((c) => [c.nombre, c]));

  return {
    categoriasDeServicio: deServicio,
    categoriasDeProfesional: categorias(
      negocioId,
      "profesional",
      plantilla.categoriasDeProfesional
    ),
    servicios: plantilla.servicios.map((s) => ({
      id: idDe(`servicio:${negocioId}:${s.name}`),
      nombre: s.name,
      categoria: s.category,
      categoriaId: porNombre.get(s.category)!.id,
      duracion: s.duration,
      precio: s.price,
    })),
    horario: plantilla.horario.map((t) => ({
      dia: t.dayOfWeek,
      abre: t.openTime,
      cierra: t.closeTime,
    })),
  };
}

/** Fichas de cliente de un negocio, la primera ligada al usuario que se indique. */
function clientesDe(
  negocioId: string,
  cuantos: number,
  usuarioCliente: string | null
): ClienteSembrado[] {
  const azar = generador(`clientes:${negocioId}`);
  return Array.from({ length: cuantos }, (_, i) => {
    const nombre = NOMBRES[i % NOMBRES.length];
    const ligado = i === 0 ? usuarioCliente : null;
    const cuenta = ligado ? CUENTAS.find((c) => c.id === ligado) : undefined;
    return {
      id: idDe(`cliente:${negocioId}:${i}`),
      nombre: cuenta ? cuenta.nombre : nombre,
      email: cuenta
        ? cuenta.email
        : `${generateSlug(nombre)}@correo.local`.replace(/-/g, "."),
      telefono: cuenta
        ? cuenta.telefono
        : `+5730020${String(i).padStart(5, "0")}`,
      usuarioId: ligado,
      // Un puñado con cumpleaños para que el aviso tenga a quién felicitar.
      cumple: i % 4 === 0 ? `199${i % 10}-0${(i % 9) + 1}-1${i % 9}` : null,
      puntos: entero(azar, 0, 240),
    };
  });
}

/** El negocio A: la barbería sobre la que se prueba casi todo. */
function barberia(): Negocio {
  const sedes: Sede[] = [
    {
      id: idDe(`sede:${NEGOCIO_A}:centro`),
      nombre: "Sede Centro",
      direccion: "Calle 85 #12-34",
      ciudad: "Bogotá",
      telefono: "+576014440001",
    },
    {
      id: idDe(`sede:${NEGOCIO_A}:norte`),
      nombre: "Sede Norte",
      direccion: "Carrera 15 #127-08",
      ciudad: "Bogotá",
      telefono: "+576014440002",
    },
  ];
  const catalogo = desdePlantilla(NEGOCIO_A, "BARBERIA");
  const [senior, barbero] = catalogo.categoriasDeProfesional;

  const profesionales: Profesional[] = [
    {
      id: idDe(`profesional:${NEGOCIO_A}:andres`),
      sedeId: sedes[0].id,
      nombre: "Andrés Quintero",
      categoria: senior.nombre,
      categoriaId: senior.id,
      especialidades: ["Fade", "Barba"],
      aniosExp: 9,
      bio: "Barbero desde 2016, especializado en degradados y perfilado de barba.",
      usuarioId: idDe("usuario:pro"),
    },
    {
      id: idDe(`profesional:${NEGOCIO_A}:julian`),
      sedeId: sedes[0].id,
      nombre: "Julián Cardona",
      categoria: barbero.nombre,
      categoriaId: barbero.id,
      especialidades: ["Corte clásico", "Afeitado"],
      aniosExp: 4,
      bio: "Corte clásico y afeitado a navaja.",
      usuarioId: null,
    },
    {
      id: idDe(`profesional:${NEGOCIO_A}:steven`),
      sedeId: sedes[1].id,
      nombre: "Steven Mora",
      categoria: barbero.nombre,
      categoriaId: barbero.id,
      especialidades: ["Corte infantil"],
      aniosExp: 2,
      bio: "Paciente con los más pequeños; su agenda se llena los sábados.",
      usuarioId: null,
    },
  ];

  return {
    id: NEGOCIO_A,
    nombre: "Barbería La Noche",
    slug: generateSlug("Barbería La Noche"),
    tipo: "BARBERIA",
    descripcion:
      "Barbería de barrio con dos sedes en Bogotá. Cortes clásicos, degradados y afeitado a navaja.",
    telefono: "+576014440001",
    email: "hola@barberialanoche.local",
    direccion: sedes[0].direccion,
    ciudad: "Bogotá",
    departamento: "Cundinamarca",
    lat: 4.6721,
    lng: -74.0554,
    lema: "Cortes que se notan al día siguiente",
    relato:
      "Abrimos en 2016 con una silla prestada y la idea de que un corte se juzga a la semana, no al salir. Hoy somos dos sedes y el mismo criterio.",
    sedes,
    ...catalogo,
    profesionales,
    clientes: clientesDe(NEGOCIO_A, 12, idDe("usuario:cliente")),
  };
}

/** El negocio B: existe para que el aislamiento entre tenants sea probable. */
function spa(): Negocio {
  const sedes: Sede[] = [
    {
      id: idDe(`sede:${NEGOCIO_B}:principal`),
      nombre: "Sede El Poblado",
      direccion: "Carrera 37 #8-15",
      ciudad: "Medellín",
      telefono: "+576044440003",
    },
  ];
  const catalogo = desdePlantilla(NEGOCIO_B, "SPA");
  const [terapeuta, esteticista] = catalogo.categoriasDeProfesional;

  const profesionales: Profesional[] = [
    {
      id: idDe(`profesional:${NEGOCIO_B}:paula`),
      sedeId: sedes[0].id,
      nombre: "Paula Andrade",
      categoria: terapeuta.nombre,
      categoriaId: terapeuta.id,
      especialidades: ["Masaje descontracturante"],
      aniosExp: 7,
      bio: "Terapeuta con formación en masaje deportivo.",
      usuarioId: null,
    },
    {
      id: idDe(`profesional:${NEGOCIO_B}:diana`),
      sedeId: sedes[0].id,
      nombre: "Diana Salgado",
      categoria: esteticista.nombre,
      categoriaId: esteticista.id,
      especialidades: ["Limpieza facial"],
      aniosExp: 5,
      bio: "Faciales y cuidado de la piel.",
      usuarioId: null,
    },
  ];

  return {
    id: NEGOCIO_B,
    nombre: "Spa Aurora",
    slug: generateSlug("Spa Aurora"),
    tipo: "SPA",
    descripcion:
      "Spa urbano en El Poblado. Masajes, faciales y tratamientos corporales.",
    telefono: "+576044440003",
    email: "hola@spaaurora.local",
    direccion: sedes[0].direccion,
    ciudad: "Medellín",
    departamento: "Antioquia",
    lat: 6.2088,
    lng: -75.5674,
    lema: "Una hora para ti, sin prisa",
    relato:
      "Nacimos en 2019 con tres cabinas y la manía de no encadenar citas: cada sesión termina cuando tiene que terminar.",
    sedes,
    ...catalogo,
    profesionales,
    clientes: clientesDe(NEGOCIO_B, 5, null),
  };
}

// ─── Generación de la actividad ──────────────────────────────────────────────

/**
 * Reparte citas por los días abiertos del negocio, con estados coherentes con
 * el calendario: lo pasado está cerrado (atendida, cancelada o no asistió), lo
 * de hoy está en curso y lo de mañana, por confirmar.
 */
function citasDe(negocio: Negocio, porDia: [number, number]): Cita[] {
  const azar = generador(`citas:${negocio.id}`);
  const dia0 = hoy();
  const abre = new Map(negocio.horario.map((h) => [h.dia, h]));
  const citas: Cita[] = [];

  for (const fecha of rangoDeDias(
    sumarDias(dia0, -DIAS_DE_HISTORIA),
    sumarDias(dia0, DIAS_DE_AGENDA)
  )) {
    const tramo = abre.get(diaDeLaSemana(fecha));
    if (!tramo) continue; // día cerrado

    const cuantas = entero(azar, porDia[0], porDia[1]);
    // Cada profesional lleva su propio reloj para que dos citas suyas no se
    // pisen: la agenda tiene que poder pintarse sin solapes inventados.
    const ocupadoHasta = new Map(
      negocio.profesionales.map((p) => [p.id, aMinutos(tramo.abre)])
    );

    for (let i = 0; i < cuantas; i++) {
      const profesional = unoDe(azar, negocio.profesionales);
      const servicio = unoDe(azar, negocio.servicios);
      const desde = ocupadoHasta.get(profesional.id)!;
      const hasta = desde + servicio.duracion;
      if (hasta > aMinutos(tramo.cierra)) continue; // ya no cabe

      // Un hueco entre citas, que ni la agenda ni la ocupación deben cuadrar
      // al minuto.
      ocupadoHasta.set(profesional.id, hasta + entero(azar, 0, 25));

      const cliente = unoDe(azar, negocio.clientes);
      const id = idDe(`cita:${negocio.id}:${fecha}:${i}`);
      const linea: LineaDeCita = {
        id: idDe(`linea:${id}`),
        servicioId: servicio.id,
        nombre: servicio.nombre,
        precio: servicio.precio,
        duracion: servicio.duracion,
        orden: 0,
      };

      citas.push({
        id,
        negocioId: negocio.id,
        sedeId: profesional.sedeId,
        clienteId: cliente.id,
        profesionalId: profesional.id,
        fecha,
        inicio: aHora(desde),
        fin: aHora(hasta),
        estado: estadoDeLaCita(fecha, dia0, azar),
        total: servicio.precio,
        lineas: [linea],
      });
    }
  }
  return citas;
}

/** El estado que le toca a una cita según dónde caiga respecto de hoy. */
function estadoDeLaCita(
  fecha: string,
  dia0: string,
  azar: () => number
): EstadoDeCita {
  if (fecha < dia0) {
    const suerte = azar();
    if (suerte < 0.84) return "COMPLETED";
    if (suerte < 0.93) return "CANCELLED";
    return "NO_SHOW";
  }
  if (fecha === dia0) {
    return unoDe(azar, [
      "COMPLETED",
      "IN_PROGRESS",
      "CONFIRMED",
      "CONFIRMED",
    ] as const);
  }
  return unoDe(azar, ["CONFIRMED", "CONFIRMED", "PENDING"] as const);
}

/**
 * Un cobro por cita atendida. Uno de cada seis se reparte entre dos medios y uno
 * de cada diez lleva descuento comercial, para que el panel tenga con qué
 * enseñar las dos cosas.
 */
function cobrosDe(negocio: Negocio, citas: Cita[], cajero: string): Cobro[] {
  const azar = generador(`cobros:${negocio.id}`);
  const cobros: Cobro[] = [];

  for (const cita of citas.filter((c) => c.estado === "COMPLETED")) {
    const descuento =
      azar() < 0.1 ? Math.round((cita.total * 0.1) / 100) * 100 : 0;
    const importe = cita.total - descuento;
    const propina = azar() < 0.35 ? entero(azar, 2, 10) * 1000 : 0;
    const total = importe + propina;
    const id = idDe(`cobro:${cita.id}`);

    const mixto = azar() < 0.16;
    const lineas: LineaDeCobro[] = mixto
      ? repartir(id, total, azar)
      : [
          {
            id: idDe(`linea-cobro:${id}:0`),
            metodo: unoDe(azar, ["CASH", "CARD", "CARD", "TRANSFER"] as const),
            importe: total,
          },
        ];

    cobros.push({
      id,
      negocioId: negocio.id,
      sedeId: cita.sedeId,
      citaId: cita.id,
      clienteId: cita.clienteId,
      profesionalId: cita.profesionalId,
      importe,
      descuentoComercial: descuento,
      motivoDescuento: descuento ? "Promoción entre semana" : null,
      propina,
      metodo: mixto ? "MIXED" : lineas[0].metodo,
      lineas,
      registradoPor: cajero,
      fecha: cita.fecha,
      hora: cita.fin,
    });
  }
  return cobros;
}

/** Parte un importe en dos medios, en múltiplos de mil para que sea creíble. */
function repartir(
  cobroId: string,
  total: number,
  azar: () => number
): LineaDeCobro[] {
  const enEfectivo = Math.max(
    1000,
    Math.round((total * (0.3 + azar() * 0.4)) / 1000) * 1000
  );
  const resto = total - enEfectivo;
  if (resto <= 0) {
    return [
      { id: idDe(`linea-cobro:${cobroId}:0`), metodo: "CASH", importe: total },
    ];
  }
  return [
    {
      id: idDe(`linea-cobro:${cobroId}:0`),
      metodo: "CASH",
      importe: enEfectivo,
    },
    { id: idDe(`linea-cobro:${cobroId}:1`), metodo: "CARD", importe: resto },
  ];
}

/**
 * Una caja por sede y día con cobros: cerradas las de los días pasados y abierta
 * la de hoy. Solo entra el efectivo, y una de cada doce cierra descuadrada para
 * que el arqueo tenga algo que señalar.
 */
function cajasDe(
  negocio: Negocio,
  cobros: Cobro[],
  cajero: string
): SesionDeCaja[] {
  const azar = generador(`caja:${negocio.id}`);
  const dia0 = hoy();
  const porSedeYDia = new Map<string, Cobro[]>();

  for (const cobro of cobros) {
    if (cobro.fecha > dia0) continue;
    const clave = `${cobro.sedeId}|${cobro.fecha}`;
    porSedeYDia.set(clave, [...(porSedeYDia.get(clave) ?? []), cobro]);
  }

  const cajas: SesionDeCaja[] = [];
  for (const [clave, delDia] of [...porSedeYDia.entries()].sort()) {
    const [sedeId, fecha] = clave.split("|");
    const apertura = 100000;
    const movimientos: MovimientoDeCaja[] = [];

    for (const cobro of delDia) {
      const efectivo = cobro.lineas
        .filter((l) => l.metodo === "CASH")
        .reduce((suma, l) => suma + l.importe, 0);
      if (efectivo === 0) continue;
      movimientos.push({
        id: idDe(`movimiento:${cobro.id}`),
        tipo: "IN",
        importe: efectivo,
        concepto: `Cobro de la cita de ${fecha}`,
        metodo: "CASH",
        cobroId: cobro.id,
        registradoPor: cajero,
      });
    }

    const entradas = movimientos.reduce((suma, m) => suma + m.importe, 0);
    const esperado = apertura + entradas;
    const abierta = fecha === dia0;
    // El descuadre es la excepción, y siempre a la baja: lo que de verdad pasa
    // en un mostrador es que falte, no que sobre.
    const descuadre =
      !abierta && azar() < 1 / 12 ? -entero(azar, 1, 9) * 1000 : 0;

    cajas.push({
      id: idDe(`caja:${sedeId}:${fecha}`),
      negocioId: negocio.id,
      sedeId,
      abiertaPor: cajero,
      cerradaPor: abierta ? null : cajero,
      aperturaImporte: apertura,
      abiertaEn: instante(fecha, "08:30"),
      cerradaEn: abierta ? null : instante(fecha, "20:30"),
      cierreImporte: abierta ? null : esperado + descuadre,
      esperado: abierta ? null : esperado,
      diferencia: abierta ? null : descuadre,
      notas: descuadre ? "Falta efectivo, pendiente de revisar" : null,
      movimientos,
    });
  }
  return cajas;
}

/** Factura los cobros más recientes, que es lo que un negocio suele emitir. */
function facturasDe(negocio: Negocio, cobros: Cobro[]): Factura[] {
  const facturables = cobros
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, 8);

  return facturables.map((cobro, i) => {
    const id = idDe(`factura:${cobro.id}`);
    // Lo cobrado en el mostrador lleva el impuesto dentro: la base se despeja
    // del total, no se le suma encima.
    const base = Math.round(cobro.importe / (1 + IVA));
    const impuesto = cobro.importe - base;
    return {
      id,
      negocioId: negocio.id,
      clienteId: cobro.clienteId,
      cobroId: cobro.id,
      numero: `A-${String(i + 1).padStart(5, "0")}`,
      fecha: cobro.fecha,
      vence: sumarDias(cobro.fecha, 30),
      base,
      tasa: IVA,
      impuesto,
      total: cobro.importe,
      estado: "PAID" as const,
      lineas: [
        {
          id: idDe(`linea-factura:${id}`),
          descripcion: "Servicios prestados",
          cantidad: 1,
          precio: base,
        },
      ],
    };
  });
}

/** Reseña un tercio de las citas atendidas, con alguna respuesta del negocio. */
function resenasDe(negocio: Negocio, citas: Cita[]): Resena[] {
  const azar = generador(`resenas:${negocio.id}`);
  const porId = new Map(negocio.profesionales.map((p) => [p.id, p]));
  const resenas: Resena[] = [];

  for (const cita of citas.filter((c) => c.estado === "COMPLETED")) {
    if (azar() > 0.33) continue;
    const nota = azar() < 0.78 ? 5 : azar() < 0.7 ? 4 : 3;
    resenas.push({
      id: idDe(`resena:${cita.id}`),
      negocioId: negocio.id,
      citaId: cita.id,
      clienteId: cita.clienteId,
      profesionalId: cita.profesionalId,
      profesionalNombre: porId.get(cita.profesionalId)!.nombre,
      servicioNombre: cita.lineas[0].nombre,
      nota,
      comentario: unoDe(azar, COMENTARIOS),
      respuesta:
        azar() < 0.25 ? "¡Gracias por venir! Te esperamos pronto." : null,
      fecha: instante(cita.fecha, "21:00"),
    });
  }
  return resenas;
}

/** Un par de ausencias por profesional, para que la agenda tenga bloqueos. */
function bloqueosDe(negocio: Negocio): Bloqueo[] {
  const dia0 = hoy();
  return negocio.profesionales.flatMap((p, i) => [
    {
      id: idDe(`bloqueo:${p.id}:almuerzo`),
      negocioId: negocio.id,
      profesionalId: p.id,
      fecha: sumarDias(dia0, i + 1),
      inicio: "13:00",
      fin: "14:00",
      motivo: "Almuerzo",
    },
    {
      id: idDe(`bloqueo:${p.id}:cita-medica`),
      negocioId: negocio.id,
      profesionalId: p.id,
      fecha: sumarDias(dia0, i + 3),
      inicio: "09:00",
      fin: "11:00",
      motivo: "Cita médica",
    },
  ]);
}

/** Construye el escenario entero en memoria; nada de esto toca todavía la base. */
export function construirSiembra(): Siembra {
  const negocios = [barberia(), spa()];
  const cajeros = new Map([
    [NEGOCIO_A, idDe("usuario:recep")],
    [NEGOCIO_B, idDe("usuario:ownerb")],
  ]);

  const citas: Cita[] = [];
  const cobros: Cobro[] = [];
  const cajas: SesionDeCaja[] = [];
  const facturas: Factura[] = [];
  const resenas: Resena[] = [];
  const bloqueos: Bloqueo[] = [];

  for (const negocio of negocios) {
    // El tenant B lleva menos volumen a propósito: existe para probar el
    // aislamiento, no para duplicar el escenario.
    const densidad: [number, number] =
      negocio.id === NEGOCIO_A ? [4, 11] : [1, 4];
    const cajero = cajeros.get(negocio.id)!;

    const suyas = citasDe(negocio, densidad);
    const suyos = cobrosDe(negocio, suyas, cajero);

    citas.push(...suyas);
    cobros.push(...suyos);
    cajas.push(...cajasDe(negocio, suyos, cajero));
    facturas.push(...facturasDe(negocio, suyos));
    resenas.push(...resenasDe(negocio, suyas));
    bloqueos.push(...bloqueosDe(negocio));
  }

  return {
    cuentas: CUENTAS,
    negocios,
    citas,
    cobros,
    cajas,
    facturas,
    resenas,
    bloqueos,
  };
}
