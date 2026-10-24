/**
 * Un contexto completo por plantilla, con los mismos campos que les pasan los
 * listeners. Lo usan las pruebas del render y la vista previa
 * (`npm run correos:vista-previa`), que pinta cada correo a un fichero.
 */

const NEGOCIO = {
  businessName: "Barbería La Noche",
  businessAddress: "Cra. 43A #7-50, El Poblado, Medellín",
  businessPhone: "+57 300 123 4567",
};

const APP = "https://appbeautyspot.com";

const CITA = {
  ...NEGOCIO,
  clientName: "Camila Restrepo",
  professionalName: "Julián Cardona",
  serviceName: "Corte y Barba",
  duration: 60,
  appointmentDate: "2026-10-25",
  appointmentTime: "10:30",
  enlaceCita: `${APP}/dashboard/client/appointments/7f1c`,
  enlaceReagendar: `${APP}/dashboard/client/appointments/7f1c/reschedule`,
  enlaceMapa:
    "https://www.google.com/maps/search/?api=1&query=Cra.%2043A%20%237-50%2C%20El%20Poblado%2C%20Medell%C3%ADn",
  enlaceCalendario:
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Corte%20y%20Barba",
  enlaceReservar: `${APP}/marketplace?q=Barber%C3%ADa%20La%20Noche`,
};

export const EJEMPLOS_DE_CORREO: Record<string, Record<string, unknown>> = {
  "appointment-created": CITA,
  "appointment-confirmed": CITA,
  "appointment-reminder-24h": CITA,
  "appointment-reminder-1h": CITA,
  "appointment-cancelled": {
    ...CITA,
    reason: "El profesional no estará disponible",
  },
  "review-request": {
    ...CITA,
    reviewLink: `${APP}/dashboard/client/appointments/7f1c/review`,
  },
  "birthday-greeting": { ...CITA },
  "email-verification": {
    clientName: "Yeison García",
    verificationLink: `${APP}/verify-email?token=8f3a9c`,
    expiryHours: 24,
  },
  "password-reset": {
    clientName: "Yeison García",
    resetLink: `${APP}/reset-password?token=c91d4e`,
    expiryHours: 1,
  },
  "registro-duplicado": {
    clientName: "Yeison García",
    recoveryLink: `${APP}/forgot-password`,
    loginLink: `${APP}/login`,
  },
  "welcome-email": {
    clientName: "Camila Restrepo",
    enlaceExplorar: `${APP}/marketplace`,
  },
  "bienvenida-negocio": {
    clientName: "Yeison García",
    businessName: "Barbería La Noche",
    enlacePanel: `${APP}/dashboard`,
  },
  "bienvenida-equipo": {
    clientName: "Julián Cardona",
    businessName: "Barbería La Noche",
    enlacePanel: `${APP}/login`,
  },
  "invoice-generated": {
    ...NEGOCIO,
    clientName: "Camila Restrepo",
    esRecibo: false,
    invoiceNumber: "FAC-2026-000123",
    invoiceDate: "2026-10-25",
    items: [
      { name: "Corte", amount: 35000 },
      { name: "Barba", amount: 20000 },
    ],
    subtotal: 55000,
    tax: 10450,
    total: 65450,
    enlaceFacturas: `${APP}/dashboard/client/invoices`,
  },
  "monthly-report": {
    clientName: "Yeison García",
    businessName: "Barbería La Noche",
    month: "octubre",
    year: "2026",
    totalRevenue: 8450000,
    totalAppointments: 214,
    topService: "Corte y Barba",
    topServiceRevenue: 2170000,
    enlaceReportes: `${APP}/dashboard/analytics`,
  },
};

/**
 * Los mismos correos con solo lo imprescindible: sin dirección ni teléfono,
 * sin cuenta (invitado) y sin enlaces opcionales. Es lo que tiene que aguantar
 * cada plantilla sin dejar filas vacías.
 */
export const EJEMPLOS_MINIMOS: Record<
  string,
  Record<string, unknown>
> = Object.fromEntries(
  Object.entries(EJEMPLOS_DE_CORREO).map(([nombre, contexto]) => {
    const {
      businessAddress: _d,
      businessPhone: _t,
      enlaceCita: _c,
      enlaceReagendar: _r,
      enlaceMapa: _m,
      enlaceFacturas: _f,
      ...resto
    } = contexto;
    return [nombre, resto];
  })
);
