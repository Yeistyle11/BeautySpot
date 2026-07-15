/**
 * Script de seed para BeautySpot - Crea datos de prueba completos
 * Uso: node scripts/seed.js
 */
const BASE_URL = "http://localhost";
const INTERNAL_SECRET = "dev-internal-secret-change-in-production";

const services = {
  auth: `${BASE_URL}:3001`,
  core: `${BASE_URL}:3002`,
  booking: `${BASE_URL}:3003`,
  payment: `${BASE_URL}:3004`,
  notification: `${BASE_URL}:3005`,
  marketplace: `${BASE_URL}:3006`,
  analytics: `${BASE_URL}:3007`,
};

let token = "";
let businessId = "";
let branchId = "";
const userIds = {};
const professionalIds = {};
const serviceIds = {};
const clientIds = {};
const appointmentIds = {};
const paymentIds = {};

async function api(method, url, body = null, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (businessId) headers["x-business-id"] = businessId;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json?.data || json;
  } catch {
    return text;
  }
}

function log(step, msg) {
  console.log(`✅ ${step}: ${msg}`);
}

function logError(step, err) {
  console.error(`❌ ${step}: ${JSON.stringify(err).substring(0, 200)}`);
}

// ─── 1. REGISTRAR USUARIOS ──────────────────────────────────────────
async function seedUsers() {
  const users = [
    { email: "owner@beautyspot.co", password: "Owner1234", name: "Carlos Méndez", phone: "+57 300 111 0001" },
    { email: "admin@beautyspot.co", password: "Admin1234", name: "María López", phone: "+57 300 111 0002" },
    { email: "professionalo1@beautyspot.co", password: "Professional123", name: "Juan Pérez", phone: "+57 300 111 0003" },
    { email: "professionalo2@beautyspot.co", password: "Professional123", name: "Andrés Gómez", phone: "+57 300 111 0004" },
    { email: "estilista@beautyspot.co", password: "Style1234", name: "Laura Ramírez", phone: "+57 300 111 0005" },
    { email: "recepcionista@beautyspot.co", password: "Recep1234", name: "Sofía Herrera", phone: "+57 300 111 0006" },
    { email: "cliente1@beautyspot.co", password: "Client123", name: "Diego Torres", phone: "+57 300 111 0007" },
    { email: "cliente2@beautyspot.co", password: "Client123", name: "Valentina Ruiz", phone: "+57 300 111 0008" },
    { email: "cliente3@beautyspot.co", password: "Client123", name: "Camila Vargas", phone: "+57 300 111 0009" },
    { email: "cliente4@beautyspot.co", password: "Client123", name: "Santiago Morales", phone: "+57 300 111 0010" },
    { email: "cliente5@beautyspot.co", password: "Client123", name: "Isabella Castro", phone: "+57 300 111 0011" },
  ];

  for (const u of users) {
    try {
      const res = await api("POST", `${services.auth}/register`, u);
      userIds[u.email] = res?.user?.id || res?.id;
      if (!userIds[u.email]) console.log(`  ⚠️ Debug: register response keys = ${Object.keys(res || {}).join(", ")}, user = ${JSON.stringify(res?.user)?.substring(0, 100)}`);
      log("User", `${u.name} (${u.email}) → ${userIds[u.email] || "registrado"}`);
    } catch (err) {
      logError("User", `${u.email}: ${err}`);
    }
  }

  // Login como owner
  const loginRes = await api("POST", `${services.auth}/login`, {
    email: "owner@beautyspot.co",
    password: "Owner1234",
  });
  token = loginRes?.accessToken || loginRes?.token || "";
  log("Auth", `Token obtenido: ${token ? "✓" : "✗"}`);
}

// ─── 2. CREAR NEGOCIO (vía endpoint interno) ──────────────────────────
async function seedBusiness() {
  const res = await api("POST", `${services.core}/internal/businesses`, {
    name: "BeautySpot",
    description: "La mejor professionalía de Bogotá. Cortes clásicos y modernos con los mejores profesionales.",
    phone: "+57 601 234 5678",
    email: "info@elitebeautyspot.co",
    website: "https://elitebeautyspot.co",
    address: "Calle 85 #15-20, Zona Rosa",
    city: "Bogotá",
    state: "Cundinamarca",
    country: "Colombia",
    latitude: 4.6696,
    longitude: -74.0564,
    timezone: "America/Bogota",
    currency: "COP",
    locale: "es-CO",
    businessType: "beautyspot",
  }, { "x-internal-secret": INTERNAL_SECRET });
  businessId = res?.id || res?.data?.id || "";
  log("Business", `BeautySpot → ${businessId}`);
}

// ─── 3. CREAR MEMBERSHIPS (vía endpoint interno) ───────────────────────
async function seedMemberships() {
  const memberships = [
    { userId: userIds["owner@beautyspot.co"], businessId, role: "OWNER" },
    { userId: userIds["admin@beautyspot.co"], businessId, role: "ADMIN" },
    { userId: userIds["professionalo1@beautyspot.co"], businessId, role: "PROFESSIONAL" },
    { userId: userIds["professionalo2@beautyspot.co"], businessId, role: "PROFESSIONAL" },
    { userId: userIds["estilista@beautyspot.co"], businessId, role: "PROFESSIONAL" },
    { userId: userIds["recepcionista@beautyspot.co"], businessId, role: "RECEPTIONIST" },
    { userId: userIds["cliente1@beautyspot.co"], businessId, role: "CLIENT" },
    { userId: userIds["cliente2@beautyspot.co"], businessId, role: "CLIENT" },
    { userId: userIds["cliente3@beautyspot.co"], businessId, role: "CLIENT" },
    { userId: userIds["cliente4@beautyspot.co"], businessId, role: "CLIENT" },
    { userId: userIds["cliente5@beautyspot.co"], businessId, role: "CLIENT" },
  ];

  for (const m of memberships) {
    if (!m.userId) { log("Membership", `SKIP: sin userId para ${m.role}`); continue; }
    const res = await api("POST", `${services.auth}/internal/memberships`, m, { "x-internal-secret": INTERNAL_SECRET });
    log("Membership", `${m.role} → ${m.userId}`);
  }

  // Re-login como owner para obtener JWT con role y businessId correctos
  const loginRes = await api("POST", `${services.auth}/login`, {
    email: "owner@beautyspot.co",
    password: "Owner1234",
  });
  token = loginRes?.accessToken || loginRes?.token || "";
  log("Re-Auth", `Token con businessId obtenido: ${token ? "✓" : "✗"}`);
}

// ─── 4. CREAR SUCURSALES ────────────────────────────────────────────
async function seedBranches() {
  const branches = [
    { name: "Sede Zona Rosa", address: "Calle 85 #15-20", city: "Bogotá", state: "Cundinamarca", country: "Colombia", phone: "+57 601 234 5678" },
    { name: "Sede Chapinero", address: "Carrera 7 #63-45", city: "Bogotá", state: "Cundinamarca", country: "Colombia", phone: "+57 601 345 6789" },
    { name: "Sede Norte", address: "Calle 116 #20-60", city: "Bogotá", state: "Cundinamarca", country: "Colombia", phone: "+57 601 456 7890" },
  ];

  for (const b of branches) {
    const res = await api("POST", `${services.core}/branches`, b);
    if (!branchId) branchId = res?.id || "";
    log("Branch", `${b.name} → ${res?.id || "creada"}`);
  }
}

// ─── 4. CREAR SERVICIOS ─────────────────────────────────────────────
async function seedServices() {
  const servicesList = [
    { name: "Corte Clásico", description: "Corte de cabello tradicional con máquina y tijera, incluye lavado.", price: 25000, duration: 30, category: "Corte" },
    { name: "Corte + Barba", description: "Corte de cabello completo más arreglo de barba con navaja.", price: 40000, duration: 45, category: "Combo" },
    { name: "Barba Premium", description: "Arreglo de barba con toalla caliente, aceite y cera para bigote.", price: 20000, duration: 20, category: "Barba" },
    { name: "Afeitado Clásico", description: "Afeitado tradicional con navaja, toalla caliente y espuma artesanal.", price: 30000, duration: 30, category: "Barba" },
    { name: "Corte Degradado", description: "Corte degradado (fade) moderno con detalles personalizados.", price: 35000, duration: 40, category: "Corte" },
    { name: "Diseño de Cejas", description: "Diseño y perfilado de cejas con cera y pinza.", price: 10000, duration: 15, category: "Facial" },
    { name: "Tratamiento Capilar", description: "Tratamiento profundo con keratina y masaje capilar.", price: 50000, duration: 45, category: "Tratamiento" },
    { name: "Tinte de Cabello", description: "Coloración completa con productos de alta calidad.", price: 60000, duration: 60, category: "Color" },
    { name: "Paquete Ejecutivo", description: "Corte + barba + tratamiento facial express para profesionales.", price: 65000, duration: 60, category: "Combo" },
    { name: "Corte Infantil", description: "Corte de cabello para niños hasta 12 años. Ambiente divertido.", price: 18000, duration: 25, category: "Corte" },
  ];

  for (const s of servicesList) {
    const res = await api("POST", `${services.core}/services`, s);
    serviceIds[s.name] = res?.id || "";
    log("Service", `${s.name} ($${s.price}) → ${res?.id || "creado"}`);
  }
}

// ─── 5. CREAR PROFESIONALES ─────────────────────────────────────────
async function seedProfessionals() {
  const professionals = [
    { name: "Juan Pérez", bio: "Professionalo con 8 años de experiencia. Especialista en cortes degradados y clásicos.", specialties: ["Corte Clásico", "Degradado", "Barba"], yearsExp: 8, userId: userIds["professionalo1@beautyspot.co"], branchId },
    { name: "Andrés Gómez", bio: "Maestro professionalo, 12 años de trayectoria. Experto en afeitado clásico y estilos vintage.", specialties: ["Afeitado Clásico", "Corte Vintage", "Barba"], yearsExp: 12, userId: userIds["professionalo2@beautyspot.co"], branchId },
    { name: "Laura Ramírez", bio: "Estilista profesional certificado. Especialista en colorimetría y tratamientos capilares.", specialties: ["Tinte", "Tratamiento Capilar", "Corte Femenino"], yearsExp: 6, userId: userIds["estilista@beautyspot.co"], branchId },
  ];

  for (const p of professionals) {
    const res = await api("POST", `${services.core}/professionals`, p);
    professionalIds[p.name] = res?.id || "";
    log("Professional", `${p.name} (${p.specialties.join(", ")}) → ${res?.id || "creado"}`);
  }

  // Asignar servicios a profesionales
  const assignments = [
    { pro: "Juan Pérez", services: ["Corte Clásico", "Corte + Barba", "Corte Degradado", "Corte Infantil", "Paquete Ejecutivo"] },
    { pro: "Andrés Gómez", services: ["Corte Clásico", "Barba Premium", "Afeitado Clásico", "Corte + Barba", "Diseño de Cejas", "Paquete Ejecutivo"] },
    { pro: "Laura Ramírez", services: ["Tratamiento Capilar", "Tinte de Cabello", "Corte Clásico", "Corte Degradado", "Paquete Ejecutivo"] },
  ];

  for (const a of assignments) {
    for (const sName of a.services) {
      if (serviceIds[sName] && professionalIds[a.pro]) {
        await api("POST", `${services.core}/professionals/${professionalIds[a.pro]}/services`, {
          serviceId: serviceIds[sName],
        });
      }
    }
    log("Assign", `${a.pro} → ${a.services.length} servicios`);
  }
}

// ─── 6. CREAR CLIENTES ──────────────────────────────────────────────
async function seedClients() {
  const clients = [
    { name: "Diego Torres", email: "cliente1@beautyspot.co", phone: "+57 300 111 0007", tags: ["VIP", "frecuente"], userId: userIds["cliente1@beautyspot.co"] },
    { name: "Valentina Ruiz", email: "cliente2@beautyspot.co", phone: "+57 300 111 0008", tags: ["nueva"], userId: userIds["cliente2@beautyspot.co"] },
    { name: "Camila Vargas", email: "cliente3@beautyspot.co", phone: "+57 300 111 0009", tags: ["frecuente"], userId: userIds["cliente3@beautyspot.co"] },
    { name: "Santiago Morales", email: "cliente4@beautyspot.co", phone: "+57 300 111 0010", tags: ["corporativo"], userId: userIds["cliente4@beautyspot.co"] },
    { name: "Isabella Castro", email: "cliente5@beautyspot.co", phone: "+57 300 111 0011", tags: ["nueva", "referida"], userId: userIds["cliente5@beautyspot.co"] },
    { name: "Roberto Sánchez", email: "roberto@email.com", phone: "+57 310 222 3333", tags: ["frecuente"] },
    { name: "Ana María González", email: "anamaria@email.com", phone: "+57 311 444 5555", tags: ["VIP"] },
    { name: "Felipe Arias", email: "felipe@email.com", phone: "+57 312 666 7777", notes: "Alérgico a productos con amoniaco" },
  ];

  for (const c of clients) {
    const res = await api("POST", `${services.core}/clients`, c);
    clientIds[c.name] = res?.id || "";
    log("Client", `${c.name} → ${res?.id || "creado"}`);
  }
}

// ─── 7. CREAR CITAS ─────────────────────────────────────────────────
async function seedAppointments() {
  const today = new Date();
  const fmt = (d) => d.toISOString().split("T")[0];

  const appointments = [
    { client: "Diego Torres", pro: "Juan Pérez", date: fmt(today), time: "09:00", services: [{ id: serviceIds["Corte Clásico"] || "x", name: "Corte Clásico", price: 25000, duration: 30 }], notes: "Corte habitual mensual" },
    { client: "Valentina Ruiz", pro: "Laura Ramírez", date: fmt(today), time: "10:00", services: [{ id: serviceIds["Tinte de Cabello"] || "x", name: "Tinte de Cabello", price: 60000, duration: 60 }], notes: "Cambiar a castaño claro" },
    { client: "Santiago Morales", pro: "Andrés Gómez", date: fmt(today), time: "11:00", services: [{ id: serviceIds["Paquete Ejecutivo"] || "x", name: "Paquete Ejecutivo", price: 65000, duration: 60 }], notes: "Reunión importante a las 2pm" },
    { client: "Camila Vargas", pro: "Laura Ramírez", date: fmt(today), time: "14:00", services: [{ id: serviceIds["Tratamiento Capilar"] || "x", name: "Tratamiento Capilar", price: 50000, duration: 45 }] },
    { client: "Roberto Sánchez", pro: "Juan Pérez", date: fmt(today), time: "15:30", services: [{ id: serviceIds["Corte + Barba"] || "x", name: "Corte + Barba", price: 40000, duration: 45 }] },
    { client: "Ana María González", pro: "Andrés Gómez", date: fmt(today), time: "16:30", services: [{ id: serviceIds["Afeitado Clásico"] || "x", name: "Afeitado Clásico", price: 30000, duration: 30 }] },
    // Citas pasadas (ayer)
    { client: "Diego Torres", pro: "Andrés Gómez", date: fmt(new Date(today.getTime() - 86400000)), time: "10:00", services: [{ id: serviceIds["Corte + Barba"] || "x", name: "Corte + Barba", price: 40000, duration: 45 }] },
    { client: "Felipe Arias", pro: "Juan Pérez", date: fmt(new Date(today.getTime() - 86400000)), time: "14:00", services: [{ id: serviceIds["Corte Degradado"] || "x", name: "Corte Degradado", price: 35000, duration: 40 }] },
    // Citas futuras (mañana)
    { client: "Isabella Castro", pro: "Laura Ramírez", date: fmt(new Date(today.getTime() + 86400000)), time: "09:00", services: [{ id: serviceIds["Corte Clásico"] || "x", name: "Corte Clásico", price: 25000, duration: 30 }], notes: "Primera visita" },
    { client: "Santiago Morales", pro: "Juan Pérez", date: fmt(new Date(today.getTime() + 86400000)), time: "11:00", services: [{ id: serviceIds["Corte + Barba"] || "x", name: "Corte + Barba", price: 40000, duration: 45 }] },
  ];

  for (const a of appointments) {
    const res = await api("POST", `${services.booking}/appointments`, {
      professionalId: professionalIds[a.pro],
      clientId: clientIds[a.client],
      serviceIds: a.services,
      date: a.date,
      startTime: a.time,
      notes: a.notes,
      branchId,
    });
    appointmentIds[`${a.client}-${a.date}`] = res?.id || "";
    log("Appointment", `${a.client} con ${a.pro} el ${a.date} a las ${a.time} → ${res?.id || "creada"}`);
  }
}

// ─── 8. CREAR PAGOS ─────────────────────────────────────────────────
async function seedPayments() {
  const payments = [
    { client: "Diego Torres", amount: 25000, method: "CASH", notes: "Corte clásico - efectivo" },
    { client: "Valentina Ruiz", amount: 60000, method: "CARD", notes: "Tinte de cabello - tarjeta" },
    { client: "Santiago Morales", amount: 65000, method: "TRANSFER", reference: "TXN-001-ABCD", notes: "Paquete ejecutivo - transferencia" },
    { client: "Camila Vargas", amount: 50000, method: "CARD", notes: "Tratamiento capilar" },
    { client: "Roberto Sánchez", amount: 40000, method: "CASH", notes: "Corte + barba" },
    { client: "Ana María González", amount: 30000, method: "CASH", notes: "Afeitado clásico" },
    { client: "Diego Torres", amount: 40000, method: "CARD", notes: "Corte + barba (día anterior)" },
    { client: "Felipe Arias", amount: 35000, method: "TRANSFER", reference: "TXN-002-EFGH", notes: "Corte degradado" },
  ];

  for (const p of payments) {
    const res = await api("POST", `${services.payment}/payments`, {
      clientId: clientIds[p.client],
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
    });
    paymentIds[p.notes] = res?.id || "";
    log("Payment", `$${p.amount} ${p.method} - ${p.client} → ${res?.id || "creado"}`);
  }
}

// ─── 9. CREAR FACTURAS ──────────────────────────────────────────────
async function seedInvoices() {
  const today = new Date();
  const invoices = [
    {
      client: "Diego Torres", notes: "Factura corte clásico",
      items: [{ description: "Corte Clásico", quantity: 1, unitPrice: 25000 }],
    },
    {
      client: "Santiago Morales", notes: "Factura paquete ejecutivo",
      items: [{ description: "Paquete Ejecutivo (Corte + Barba + Facial)", quantity: 1, unitPrice: 65000 }],
    },
    {
      client: "Ana María González", notes: "Factura VIP",
      items: [
        { description: "Afeitado Clásico", quantity: 1, unitPrice: 30000 },
        { description: "Diseño de Cejas", quantity: 1, unitPrice: 10000 },
      ],
    },
    {
      client: "Valentina Ruiz", notes: "Factura tinte",
      dueDate: new Date(today.getTime() + 15 * 86400000).toISOString().split("T")[0],
      items: [
        { description: "Tinte de Cabello", quantity: 1, unitPrice: 60000 },
        { description: "Tratamiento Capilar Post-Color", quantity: 1, unitPrice: 25000 },
      ],
    },
  ];

  for (const inv of invoices) {
    const res = await api("POST", `${services.payment}/invoices`, {
      clientId: clientIds[inv.client],
      notes: inv.notes,
      dueDate: inv.dueDate,
      items: inv.items,
    });
    log("Invoice", `${inv.client} - ${inv.items.length} items → ${res?.id || "creada"}`);
  }
}

// ─── 10. CREAR PERFIL MARKETPLACE Y RESEÑAS ─────────────────────────
async function seedMarketplace() {
  // Crear perfil de negocio en marketplace
  const profileRes = await api("POST", `${services.marketplace}/business-profiles`, {
    businessId,
    slug: "elite-beautyspot",
    name: "BeautySpot",
    description: "La mejor experiencia de professionalía en Bogotá. Más de 10 años cuidando tu estilo con los mejores profesionales del sector.",
    phone: "+57 601 234 5678",
    email: "info@elitebeautyspot.co",
    address: "Calle 85 #15-20, Zona Rosa",
    city: "Bogotá",
    state: "Cundinamarca",
    country: "Colombia",
    lat: 4.6696,
    lng: -74.0564,
    businessType: "beautyspot",
  });
  log("Profile", `BeautySpot marketplace → ${profileRes?.id || "creado"}`);

  // Configurar perfil inmersivo
  await api("PUT", `${services.marketplace}/business-profiles/config`, {
    tagline: "Tu estilo, nuestra pasión",
    storyTitle: "Nuestra Historia",
    storyText: "Fundada en 2014 por Carlos Méndez, BeautySpot nació con la visión de transformar la experiencia de professionalía en Colombia. Comenzamos como un pequeño local en la Zona Rosa y hoy somos referencia de calidad y estilo en Bogotá.",
    storyImage: "https://images.unsplash.com/photo-1585747860019-8084de357de0?w=800",
    foundedYear: 2014,
    founders: "Carlos Méndez",
    socialLinks: {
      instagram: "https://instagram.com/elitebeautyspot",
      facebook: "https://facebook.com/elitebeautyspot",
      tiktok: "https://tiktok.com/@elitebeautyspot",
    },
    sectionConfig: [
      { id: "about", enabled: true, order: 1, customTitle: "Sobre Nosotros" },
      { id: "services", enabled: true, order: 2, customTitle: "Nuestros Servicios" },
      { id: "team", enabled: true, order: 3, customTitle: "Nuestro Equipo" },
      { id: "gallery", enabled: true, order: 4, customTitle: "Galería" },
      { id: "reviews", enabled: true, order: 5, customTitle: "Opiniones" },
      { id: "booking", enabled: true, order: 6, customTitle: "Reservar Cita" },
    ],
  });
  log("Profile Config", "Configuración inmersiva aplicada");

  // Agregar galería
  await api("POST", `${services.marketplace}/business-profiles/gallery`, {
    images: [
      { url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600", title: "Interior principal", category: "local", featured: true },
      { url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600", title: "Corte degradado", category: "trabajos", featured: true },
      { url: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600", title: "Afeitado clásico", category: "trabajos" },
      { url: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600", title: "Professional chair", category: "local" },
      { url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600", title: "Detalle de corte", category: "trabajos" },
      { url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600", title: "Ambiente VIP", category: "local" },
    ],
  });
  log("Gallery", "6 imágenes agregadas");

  // Publicar perfil
  await api("POST", `${services.marketplace}/business-profiles/publish`);
  log("Publish", "Perfil publicado en el marketplace");

  // Crear reseñas
  const reviews = [
    { client: "Diego Torres", rating: 5, comment: "Excelente servicio como siempre. Juan es un crack con los degradados. Llevo 3 años yendo y nunca me falla.", professionalId: professionalIds["Juan Pérez"], serviceName: "Corte Degradado" },
    { client: "Valentina Ruiz", rating: 4, comment: "Muy buena atención de Laura. El tinte quedó hermoso, justo lo que quería. El único detalle es que demoraron un poco en atenderte.", professionalId: professionalIds["Laura Ramírez"], serviceName: "Tinte de Cabello" },
    { client: "Santiago Morales", rating: 5, comment: "El paquete ejecutivo es increíble. Salí como nuevo para mi reunión. Andrés tiene unas manos mágicas con la navaja. 100% recomendado.", professionalId: professionalIds["Andrés Gómez"], serviceName: "Paquete Ejecutivo" },
    { client: "Camila Vargas", rating: 5, comment: "El tratamiento capilar dejó mi cabello sedoso y brillante. Laura me explicó todo el proceso. Volveré pronto!", professionalId: professionalIds["Laura Ramírez"], serviceName: "Tratamiento Capilar" },
    { client: "Roberto Sánchez", rating: 4, comment: "Muy buen corte y barba. Ambiente agradable y buena música. Los precios son justos para la calidad.", professionalId: professionalIds["Juan Pérez"], serviceName: "Corte + Barba" },
    { client: "Ana María González", rating: 5, comment: "El afeitado clásico es una experiencia única. Toalla caliente, espuma artesanal y una navaja impecable. Me sentí como en un spa.", professionalId: professionalIds["Andrés Gómez"], serviceName: "Afeitado Clásico" },
    { client: "Felipe Arias", rating: 3, comment: "El corte estuvo bien pero la espera fue larga. Creo que deberían organizar mejor los horarios. El resultado final fue bueno.", professionalId: professionalIds["Juan Pérez"], serviceName: "Corte Clásico" },
    { client: "Isabella Castro", rating: 5, comment: "Primera vez y quedé encantada! El lugar es precioso y el servicio de primera. Ya agendé mi próxima cita.", serviceName: "Corte Clásico" },
  ];

  for (const r of reviews) {
    const res = await api("POST", `${services.marketplace}/reviews`, {
      businessId,
      clientId: clientIds[r.client],
      professionalId: r.professionalId,
      rating: r.rating,
      comment: r.comment,
      serviceName: r.serviceName,
    });
    log("Review", `${r.rating}★ ${r.client}: "${r.comment.substring(0, 40)}..." → ${res?.id || "creada"}`);
  }
}

// ─── 11. CREAR NOTIFICACIONES ────────────────────────────────────────
async function seedNotifications() {
  const notifications = [
    { userId: userIds["owner@beautyspot.co"], type: "APPOINTMENT_CONFIRMED", title: "Cita confirmada", message: "La cita de Diego Torres para hoy a las 9:00 AM ha sido confirmada.", channel: "IN_APP" },
    { userId: userIds["recepcionista@beautyspot.co"], type: "APPOINTMENT_REMINDER", title: "Recordatorio de cita", message: "Tienes una cita con Valentina Ruiz a las 10:00 AM. Servicio: Tinte de Cabello.", channel: "IN_APP" },
    { userId: userIds["professionalo1@beautyspot.co"], type: "APPOINTMENT_REMINDER", title: "Tu agenda de hoy", message: "Tienes 4 citas programadas para hoy. La primera es a las 9:00 AM con Diego Torres.", channel: "IN_APP" },
    { userId: userIds["owner@beautyspot.co"], type: "REVIEW_RECEIVED", title: "Nueva reseña", message: "Diego Torres dejó una reseña de 5 estrellas: 'Excelente servicio como siempre...'", channel: "IN_APP" },
    { userId: userIds["cliente1@beautyspot.co"], type: "APPOINTMENT_CONFIRMED", title: "Tu cita está confirmada", message: "Tu cita en BeautySpot para el día de hoy a las 9:00 AM ha sido confirmada. Profesional: Juan Pérez.", channel: "IN_APP" },
    { userId: userIds["cliente2@beautyspot.co"], type: "APPOINTMENT_REMINDER", title: "Recordatorio: Cita mañana", message: "Tienes una cita mañana a las 10:00 AM en BeautySpot. Servicio: Tinte de Cabello.", channel: "IN_APP" },
    { userId: userIds["owner@beautyspot.co"], type: "PROMOTION", title: "Promoción activa", message: "La promoción 'Martes de Barba Gratis' ha generado 15 reservas nuevas esta semana.", channel: "IN_APP" },
    { userId: userIds["professionalo2@beautyspot.co"], type: "APPOINTMENT_CANCELLED", title: "Cita cancelada", message: "La cita de las 3:00 PM ha sido cancelada por el cliente. Horario disponible.", channel: "IN_APP" },
    { userId: userIds["cliente4@beautyspot.co"], type: "APPOINTMENT_RESCHEDULED", title: "Cita reprogramada", message: "Tu cita ha sido reprogramada para mañana a las 11:00 AM. Profesional: Juan Pérez.", channel: "IN_APP" },
    { userId: userIds["admin@beautyspot.co"], type: "MEMBERSHIP_INVITATION", title: "Nuevo miembro", message: "Isabella Castro se ha registrado como nueva cliente. Revisa su perfil.", channel: "IN_APP" },
  ];

  for (const n of notifications) {
    if (!n.userId) { log("Notification", `SKIP: sin userId para ${n.title}`); continue; }
    const res = await api("POST", `${services.notification}/notifications`, {
      businessId,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      channel: n.channel,
    });
    log("Notification", `${n.type} → ${n.title} → ${res?.id || "creada"}`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱 Iniciando seed de BeautySpot...\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    console.log("📋 1. Registrando usuarios...");
    await seedUsers();

    console.log("\n🏢 2. Creando negocio...");
    await seedBusiness();

    console.log("\n🔗 3. Creando memberships...");
    await seedMemberships();

    console.log("\n📍 4. Creando sucursales...");
    await seedBranches();

    console.log("\n✂️  5. Creando servicios...");
    await seedServices();

    console.log("\n👨‍🔧 6. Creando profesionales...");
    await seedProfessionals();

    console.log("\n👥 7. Creando clientes...");
    await seedClients();

    console.log("\n📅 8. Creando citas...");
    await seedAppointments();

    console.log("\n💰 9. Creando pagos...");
    await seedPayments();

    console.log("\n🧾 10. Creando facturas...");
    await seedInvoices();

    console.log("\n🌐 11. Creando marketplace...");
    await seedMarketplace();

    console.log("\n🔔 12. Creando notificaciones...");
    await seedNotifications();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n🎉 Seed completado exitosamente!\n");

    console.log("📊 Resumen de datos creados:");
    console.log(`   👤 Usuarios: ${Object.keys(userIds).length}`);
    console.log(`   🏢 Negocio: BeautySpot (${businessId})`);
    console.log(`   📍 Sucursales: 3`);
    console.log(`   ✂️  Servicios: ${Object.keys(serviceIds).length}`);
    console.log(`   👨‍🔧 Profesionales: ${Object.keys(professionalIds).length}`);
    console.log(`   👥 Clientes: ${Object.keys(clientIds).length}`);
    console.log(`   📅 Citas: ${Object.keys(appointmentIds).length}`);
    console.log(`   💰 Pagos: ${Object.keys(paymentIds).length}`);
    console.log(`   🌐 Reseñas: 8`);
    console.log(`   🔔 Notificaciones: 10`);

    console.log("\n🔑 Credenciales de acceso:");
    console.log("   Owner:    owner@beautyspot.co / Owner1234");
    console.log("   Admin:    admin@beautyspot.co / Admin1234");
    console.log("   Professionalo:  professionalo1@beautyspot.co / Professional123");
    console.log("   Estilista: estilista@beautyspot.co / Style1234");
    console.log("   Recepción: recepcionista@beautyspot.co / Recep1234");
    console.log("   Cliente:  cliente1@beautyspot.co / Client123");

  } catch (err) {
    console.error("\n💥 Error en seed:", err);
  }
}

main();
