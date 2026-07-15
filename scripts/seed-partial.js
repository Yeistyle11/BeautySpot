const BASE_URL = "http://localhost";
const services = { auth: BASE_URL+":3001", core: BASE_URL+":3002", booking: BASE_URL+":3003", payment: BASE_URL+":3004", notification: BASE_URL+":3005", marketplace: BASE_URL+":3006" };
let token = "", businessId = "", branchId = "";
const serviceIds = {}, professionalIds = {}, clientIds = {};

async function api(method, url, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers["Authorization"] = "Bearer " + token;
  if (businessId) headers["x-business-id"] = businessId;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try { const json = JSON.parse(text); return json?.data || json; } catch { return text; }
}

async function run() {
  // Login
  const loginRes = await api("POST", services.auth + "/login", {email:"owner@beautyspot.co", password:"Owner1234"});
  token = loginRes?.accessToken;
  console.log("Login:", token ? "OK" : "FAIL");

  // Get business via internal endpoint (no auth/biz-id required)
  const bizRes = await api("GET", services.core + "/internal/businesses/resolve?slug=elite-beautyspot", null, {"x-internal-secret": "dev-internal-secret-change-in-production"});
  businessId = bizRes?.id;
  console.log("Business:", businessId || "NOT FOUND");
  if (!businessId) { console.log("Cannot continue"); return; }

  // Re-login for fresh JWT with businessId
  const login2 = await api("POST", services.auth + "/login", {email:"owner@beautyspot.co", password:"Owner1234"});
  token = login2?.accessToken || token;
  console.log("Fresh token:", "OK");

  // Branches
  const branches = [
    {name:"Sede Zona Rosa",address:"Calle 85 #15-20",city:"Bogota",state:"Cundinamarca",country:"Colombia",phone:"+57 601 234 5678"},
    {name:"Sede Chapinero",address:"Carrera 7 #63-45",city:"Bogota",state:"Cundinamarca",country:"Colombia",phone:"+57 601 345 6789"},
    {name:"Sede Norte",address:"Calle 116 #20-60",city:"Bogota",state:"Cundinamarca",country:"Colombia",phone:"+57 601 456 7890"},
  ];
  for (const b of branches) { const r = await api("POST", services.core+"/branches", b); if (!branchId) branchId = r?.id; console.log("Branch:", b.name, r?.id ? "OK" : "FAIL"); }

  // Services
  const svcs = [
    {name:"Corte Clasico",description:"Corte tradicional",price:25000,duration:30,category:"Corte"},
    {name:"Corte + Barba",description:"Corte completo mas barba",price:40000,duration:45,category:"Combo"},
    {name:"Barba Premium",description:"Arreglo de barba",price:20000,duration:20,category:"Barba"},
    {name:"Afeitado Clasico",description:"Afeitado con navaja",price:30000,duration:30,category:"Barba"},
    {name:"Corte Degradado",description:"Degradado moderno",price:35000,duration:40,category:"Corte"},
    {name:"Diseno de Cejas",description:"Perfilado de cejas",price:10000,duration:15,category:"Facial"},
    {name:"Tratamiento Capilar",description:"Tratamiento con keratina",price:50000,duration:45,category:"Tratamiento"},
    {name:"Tinte de Cabello",description:"Coloracion completa",price:60000,duration:60,category:"Color"},
    {name:"Paquete Ejecutivo",description:"Corte+barba+facial",price:65000,duration:60,category:"Combo"},
    {name:"Corte Infantil",description:"Corte para ninos",price:18000,duration:25,category:"Corte"},
  ];
  for (const s of svcs) { const r = await api("POST", services.core+"/services", s); serviceIds[s.name] = r?.id; console.log("Service:", s.name, r?.id ? "OK" : "FAIL"); }

  // Professionals
  const pros = [
    {name:"Juan Perez",bio:"Professionalo 8 anos",specialties:["Corte"],yearsExp:8,branchId},
    {name:"Andres Gomez",bio:"Maestro professionalo 12 anos",specialties:["Afeitado"],yearsExp:12,branchId},
    {name:"Laura Ramirez",bio:"Estilista profesional",specialties:["Tinte"],yearsExp:6,branchId},
  ];
  for (const p of pros) { const r = await api("POST", services.core+"/professionals", p); professionalIds[p.name] = r?.id; console.log("Professional:", p.name, r?.id ? "OK" : "FAIL"); }

  // Assign services
  const assignments = [
    {pro:"Juan Perez", svcs:["Corte Clasico","Corte + Barba","Corte Degradado","Corte Infantil","Paquete Ejecutivo"]},
    {pro:"Andres Gomez", svcs:["Corte Clasico","Barba Premium","Afeitado Clasico","Corte + Barba","Diseno de Cejas","Paquete Ejecutivo"]},
    {pro:"Laura Ramirez", svcs:["Tratamiento Capilar","Tinte de Cabello","Corte Clasico","Corte Degradado","Paquete Ejecutivo"]},
  ];
  for (const a of assignments) {
    for (const sn of a.svcs) {
      if (serviceIds[sn] && professionalIds[a.pro]) await api("POST", services.core+"/professionals/"+professionalIds[a.pro]+"/services", {serviceId:serviceIds[sn]});
    }
    console.log("Assign:", a.pro, "OK");
  }

  // Clients
  const clients = [
    {name:"Diego Torres",email:"cliente1@beautyspot.co",phone:"+57 300 111 0007",tags:["VIP"]},
    {name:"Valentina Ruiz",email:"cliente2@beautyspot.co",phone:"+57 300 111 0008",tags:["nueva"]},
    {name:"Camila Vargas",email:"cliente3@beautyspot.co",phone:"+57 300 111 0009",tags:["frecuente"]},
    {name:"Santiago Morales",email:"cliente4@beautyspot.co",phone:"+57 300 111 0010",tags:["corporativo"]},
    {name:"Isabella Castro",email:"cliente5@beautyspot.co",phone:"+57 300 111 0011",tags:["nueva"]},
    {name:"Roberto Sanchez",email:"roberto@email.com",phone:"+57 310 222 3333",tags:["frecuente"]},
    {name:"Ana Maria Gonzalez",email:"anamaria@email.com",phone:"+57 311 444 5555",tags:["VIP"]},
    {name:"Felipe Arias",email:"felipe@email.com",phone:"+57 312 666 7777",notes:"Alergico a amoniaco"},
  ];
  for (const c of clients) { const r = await api("POST", services.core+"/clients", c); clientIds[c.name] = r?.id; console.log("Client:", c.name, r?.id ? "OK" : "FAIL"); }

  // Appointments
  const today = new Date();
  const fmt = d => d.toISOString().split("T")[0];
  const apts = [
    {client:"Diego Torres",pro:"Juan Perez",date:fmt(today),time:"09:00",svcs:[{id:serviceIds["Corte Clasico"],name:"Corte Clasico",price:25000,duration:30}]},
    {client:"Valentina Ruiz",pro:"Laura Ramirez",date:fmt(today),time:"10:00",svcs:[{id:serviceIds["Tinte de Cabello"],name:"Tinte de Cabello",price:60000,duration:60}]},
    {client:"Santiago Morales",pro:"Andres Gomez",date:fmt(today),time:"11:00",svcs:[{id:serviceIds["Paquete Ejecutivo"],name:"Paquete Ejecutivo",price:65000,duration:60}]},
    {client:"Camila Vargas",pro:"Laura Ramirez",date:fmt(today),time:"14:00",svcs:[{id:serviceIds["Tratamiento Capilar"],name:"Tratamiento Capilar",price:50000,duration:45}]},
    {client:"Roberto Sanchez",pro:"Juan Perez",date:fmt(today),time:"15:30",svcs:[{id:serviceIds["Corte + Barba"],name:"Corte + Barba",price:40000,duration:45}]},
    {client:"Ana Maria Gonzalez",pro:"Andres Gomez",date:fmt(today),time:"16:30",svcs:[{id:serviceIds["Afeitado Clasico"],name:"Afeitado Clasico",price:30000,duration:30}]},
    {client:"Diego Torres",pro:"Andres Gomez",date:fmt(new Date(today.getTime()-86400000)),time:"10:00",svcs:[{id:serviceIds["Corte + Barba"],name:"Corte + Barba",price:40000,duration:45}]},
    {client:"Felipe Arias",pro:"Juan Perez",date:fmt(new Date(today.getTime()-86400000)),time:"14:00",svcs:[{id:serviceIds["Corte Degradado"],name:"Corte Degradado",price:35000,duration:40}]},
    {client:"Isabella Castro",pro:"Laura Ramirez",date:fmt(new Date(today.getTime()+86400000)),time:"09:00",svcs:[{id:serviceIds["Corte Clasico"],name:"Corte Clasico",price:25000,duration:30}]},
    {client:"Santiago Morales",pro:"Juan Perez",date:fmt(new Date(today.getTime()+86400000)),time:"11:00",svcs:[{id:serviceIds["Corte + Barba"],name:"Corte + Barba",price:40000,duration:45}]},
  ];
  for (const a of apts) {
    const r = await api("POST", services.booking+"/appointments", {professionalId:professionalIds[a.pro],clientId:clientIds[a.client],serviceIds:a.svcs,date:a.date,startTime:a.time,branchId});
    console.log("Appointment:", a.client, a.date, a.time, r?.id ? "OK" : "FAIL");
  }

  // Payments
  const payments = [
    {client:"Diego Torres",amount:25000,method:"CASH",notes:"Corte clasico"},
    {client:"Valentina Ruiz",amount:60000,method:"CARD",notes:"Tinte"},
    {client:"Santiago Morales",amount:65000,method:"TRANSFER",reference:"TXN-001",notes:"Paquete ejecutivo"},
    {client:"Camila Vargas",amount:50000,method:"CARD",notes:"Tratamiento capilar"},
    {client:"Roberto Sanchez",amount:40000,method:"CASH",notes:"Corte + barba"},
    {client:"Ana Maria Gonzalez",amount:30000,method:"CASH",notes:"Afeitado clasico"},
    {client:"Diego Torres",amount:40000,method:"CARD",notes:"Corte + barba ayer"},
    {client:"Felipe Arias",amount:35000,method:"TRANSFER",reference:"TXN-002",notes:"Corte degradado"},
  ];
  for (const p of payments) {
    const r = await api("POST", services.payment+"/payments", {clientId:clientIds[p.client],amount:p.amount,method:p.method,reference:p.reference,notes:p.notes});
    console.log("Payment:", "$"+p.amount, p.method, r?.id ? "OK" : "FAIL");
  }

  console.log("\n=== Seed parcial completado ===");
}
run().catch(e => console.error("Error:", e.message));
