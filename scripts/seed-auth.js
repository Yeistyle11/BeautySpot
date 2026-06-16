const BIZ_ID = "bb8abc3b-62db-48cb-b964-19ea6860c0ab";
const BASE = "http://localhost";

async function api(method, url, body, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function main() {
  const login = await api("POST", BASE + ":3001/auth/login", { email: "owner@beautyspot.co", password: "Owner1234" });
  const token = login.data.accessToken;
  const h = { Authorization: "Bearer " + token, "x-business-id": BIZ_ID };
  console.log("Token:", token ? "OK" : "FAIL");

  // Services
  const svcs = [
    { name: "Corte Clasico", description: "Corte tradicional con maquina y tijera.", price: 25000, duration: 30, category: "Corte" },
    { name: "Corte + Barba", description: "Corte completo mas arreglo de barba.", price: 40000, duration: 45, category: "Combo" },
    { name: "Barba Premium", description: "Arreglo de barba con toalla caliente.", price: 20000, duration: 20, category: "Barba" },
    { name: "Afeitado Clasico", description: "Afeitado tradicional con navaja.", price: 30000, duration: 30, category: "Barba" },
    { name: "Corte Degradado", description: "Corte degradado moderno.", price: 35000, duration: 40, category: "Corte" },
    { name: "Diseno de Cejas", description: "Perfilado de cejas.", price: 10000, duration: 15, category: "Facial" },
    { name: "Tratamiento Capilar", description: "Tratamiento con keratina.", price: 50000, duration: 45, category: "Tratamiento" },
    { name: "Tinte de Cabello", description: "Coloracion completa.", price: 60000, duration: 60, category: "Color" },
    { name: "Paquete Ejecutivo", description: "Corte + barba + facial express.", price: 65000, duration: 60, category: "Combo" },
    { name: "Corte Infantil", description: "Corte para ninos.", price: 18000, duration: 25, category: "Corte" },
  ];
  const svcIds = {};
  for (const s of svcs) {
    const r = await api("POST", BASE + ":3002/services", s, h);
    svcIds[s.name] = r?.data?.id;
    console.log("Service:", s.name, "->", svcIds[s.name] || r);
  }

  // Professionals
  const pros = [
    { name: "Juan Perez", bio: "Barbero 8 anos.", specialties: ["Degradado", "Barba"], yearsExp: 8 },
    { name: "Andres Gomez", bio: "Maestro barbero 12 anos.", specialties: ["Afeitado", "Vintage"], yearsExp: 12 },
    { name: "Laura Ramirez", bio: "Estilista profesional.", specialties: ["Tinte", "Tratamiento"], yearsExp: 6 },
  ];
  const proIds = {};
  for (const p of pros) {
    const r = await api("POST", BASE + ":3002/professionals", p, h);
    proIds[p.name] = r?.data?.id;
    console.log("Pro:", p.name, "->", proIds[p.name] || r);
  }

  // Assign services
  const assigns = [
    { pro: "Juan Perez", svc: ["Corte Clasico", "Corte + Barba", "Corte Degradado", "Corte Infantil", "Paquete Ejecutivo"] },
    { pro: "Andres Gomez", svc: ["Corte Clasico", "Barba Premium", "Afeitado Clasico", "Corte + Barba", "Diseno de Cejas", "Paquete Ejecutivo"] },
    { pro: "Laura Ramirez", svc: ["Tratamiento Capilar", "Tinte de Cabello", "Corte Clasico", "Corte Degradado", "Paquete Ejecutivo"] },
  ];
  for (const a of assigns) {
    let count = 0;
    for (const sn of a.svc) {
      if (proIds[a.pro] && svcIds[sn]) {
        await api("POST", BASE + ":3002/professionals/" + proIds[a.pro] + "/services", { serviceId: svcIds[sn] }, h);
        count++;
      }
    }
    console.log("Assign:", a.pro, "->", count, "services");
  }

  // Clients
  const clients = [
    { name: "Diego Torres", email: "cliente1@beautyspot.co", phone: "+57 300 111 0007", tags: ["VIP", "frecuente"] },
    { name: "Valentina Ruiz", email: "cliente2@beautyspot.co", phone: "+57 300 111 0008", tags: ["nueva"] },
    { name: "Camila Vargas", email: "cliente3@beautyspot.co", phone: "+57 300 111 0009", tags: ["frecuente"] },
    { name: "Santiago Morales", email: "cliente4@beautyspot.co", phone: "+57 300 111 0010", tags: ["corporativo"] },
    { name: "Isabella Castro", email: "cliente5@beautyspot.co", phone: "+57 300 111 0011", tags: ["referida"] },
    { name: "Roberto Sanchez", email: "roberto@email.com", phone: "+57 310 222 3333", tags: ["frecuente"] },
    { name: "Ana Maria Gonzalez", email: "anamaria@email.com", phone: "+57 311 444 5555", tags: ["VIP"] },
    { name: "Felipe Arias", email: "felipe@email.com", phone: "+57 312 666 7777", notes: "Alergico a amoniaco" },
  ];
  const cliIds = {};
  for (const c of clients) {
    const r = await api("POST", BASE + ":3002/clients", c, h);
    cliIds[c.name] = r?.data?.id;
    console.log("Client:", c.name, "->", cliIds[c.name] || r);
  }

  // Marketplace profile
  await api("POST", BASE + ":3006/business-profiles", {
    businessId: BIZ_ID, slug: "elite-barbershop", name: "Elite Barbershop",
    description: "La mejor barberia de Bogota. Mas de 10 anos cuidando tu estilo.",
    phone: "+57 601 234 5678", email: "info@elitebarbershop.co",
    address: "Calle 85 #15-20, Zona Rosa", city: "Bogota", state: "Cundinamarca", country: "Colombia",
    lat: 4.6696, lng: -74.0564, businessType: "BARBERIA",
  });
  console.log("Marketplace: profile created");

  await api("PUT", BASE + ":3006/business-profiles/config", {
    tagline: "Tu estilo, nuestra pasion",
    storyTitle: "Nuestra Historia",
    storyText: "Fundada en 2014, somos referencia de calidad en Bogota.",
    foundedYear: 2014, founders: "Carlos Mendez",
    socialLinks: { instagram: "https://instagram.com/elitebarbershop", facebook: "https://facebook.com/elitebarbershop" },
  }, h);
  console.log("Marketplace: config set");

  await api("POST", BASE + ":3006/business-profiles/gallery", { images: [
    { url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600", title: "Interior", category: "local", featured: true },
    { url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600", title: "Corte", category: "trabajos", featured: true },
    { url: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600", title: "Afeitado", category: "trabajos" },
  ] }, h);
  console.log("Marketplace: gallery added");

  const pub = await api("POST", BASE + ":3006/business-profiles/publish", null, h);
  console.log("Marketplace: PUBLISHED ->", pub?.data?.isPublished);

  // Reviews
  const reviews = [
    { rating: 5, comment: "Excelente servicio! Juan es un crack.", client: "Diego Torres", pro: "Juan Perez", svc: "Corte Degradado" },
    { rating: 4, comment: "El tinte quedo hermoso.", client: "Valentina Ruiz", pro: "Laura Ramirez", svc: "Tinte de Cabello" },
    { rating: 5, comment: "Paquete ejecutivo increible.", client: "Santiago Morales", pro: "Andres Gomez", svc: "Paquete Ejecutivo" },
    { rating: 5, comment: "Tratamiento capilar espectacular.", client: "Camila Vargas", pro: "Laura Ramirez", svc: "Tratamiento Capilar" },
    { rating: 4, comment: "Buen corte y barba.", client: "Roberto Sanchez", pro: "Juan Perez", svc: "Corte + Barba" },
    { rating: 5, comment: "Afeitado clasico: experiencia unica.", client: "Ana Maria Gonzalez", pro: "Andres Gomez", svc: "Afeitado Clasico" },
    { rating: 3, comment: "Buen corte pero espera larga.", client: "Felipe Arias", pro: "Juan Perez", svc: "Corte Clasico" },
    { rating: 5, comment: "Primera vez y quede encantada!", client: "Isabella Castro", svc: "Corte Clasico" },
  ];
  for (const r of reviews) {
    const body = { businessId: BIZ_ID, clientId: cliIds[r.client], rating: r.rating, comment: r.comment, serviceName: r.svc };
    if (proIds[r.pro]) body.professionalId = proIds[r.pro];
    await api("POST", BASE + ":3006/reviews", body);
    console.log("Review:", r.rating + "★", r.client);
  }

  console.log("\nSeed con auth completado!");
}
main().catch(e => console.error("ERROR:", e));
