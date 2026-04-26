const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de la base de datos...");

  // Limpiar datos existentes
  await prisma.review.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.barberService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Hash para contraseñas
  const hashedPassword = await bcrypt.hash("password123", 10);

  // ============================================
  // CREAR USUARIOS
  // ============================================

  const admin = await prisma.user.create({
    data: {
      email: "admin@barbershop.com",
      password: hashedPassword,
      name: "Administrador",
      phone: "+1234567890",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  const client1 = await prisma.user.create({
    data: {
      email: "juan.perez@email.com",
      password: hashedPassword,
      name: "Juan Pérez",
      phone: "+1234567891",
      role: "CLIENT",
      emailVerified: new Date(),
      loyaltyPoints: 150,
    },
  });

  const client2 = await prisma.user.create({
    data: {
      email: "maria.gomez@email.com",
      password: hashedPassword,
      name: "María Gómez",
      phone: "+1234567892",
      role: "CLIENT",
      emailVerified: new Date(),
      loyaltyPoints: 75,
    },
  });

  const barberUser1 = await prisma.user.create({
    data: {
      email: "carlos.barbero@barbershop.com",
      password: hashedPassword,
      name: "Carlos Martínez",
      phone: "+1234567893",
      role: "BARBER",
      emailVerified: new Date(),
      image: "https://i.pravatar.cc/150?img=12",
    },
  });

  const barberUser2 = await prisma.user.create({
    data: {
      email: "luis.barbero@barbershop.com",
      password: hashedPassword,
      name: "Luis Rodríguez",
      phone: "+1234567894",
      role: "BARBER",
      emailVerified: new Date(),
      image: "https://i.pravatar.cc/150?img=33",
    },
  });

  console.log("✅ Usuarios creados");

  // ============================================
  // CREAR BARBEROS
  // ============================================

  const barber1 = await prisma.barber.create({
    data: {
      userId: barberUser1.id,
      bio: "Especialista en cortes clásicos y modernos con más de 10 años de experiencia. Apasionado por crear el estilo perfecto para cada cliente.",
      specialties: ["Cortes clásicos", "Fade", "Barba", "Diseño"],
      yearsExp: 10,
      rating: 4.8,
    },
  });

  const barber2 = await prisma.barber.create({
    data: {
      userId: barberUser2.id,
      bio: "Experto en tendencias urbanas y cortes modernos. Me encanta trabajar con clientes que buscan un estilo único y personalizado.",
      specialties: ["Cortes modernos", "Afeitado", "Color", "Tratamientos"],
      yearsExp: 7,
      rating: 4.9,
    },
  });

  console.log("✅ Barberos creados");

  // ============================================
  // CREAR SERVICIOS
  // ============================================

  const corteClasico = await prisma.service.create({
    data: {
      name: "Corte Clásico",
      description:
        "Corte de cabello tradicional con tijera y máquina. Incluye lavado y secado.",
      price: 20.0,
      duration: 30,
      category: "Cortes",
      image: "/services/corte-clasico.jpg",
    },
  });

  const corteModerno = await prisma.service.create({
    data: {
      name: "Corte Moderno",
      description:
        "Corte de cabello siguiendo las últimas tendencias. Incluye lavado, corte y peinado.",
      price: 25.0,
      duration: 40,
      category: "Cortes",
      image: "/services/corte-moderno.jpg",
    },
  });

  const fade = await prisma.service.create({
    data: {
      name: "Fade",
      description:
        "Degradado perfecto desde la piel. Disponible en low, mid o high fade.",
      price: 30.0,
      duration: 45,
      category: "Cortes",
      image: "/services/fade.jpg",
    },
  });

  const barba = await prisma.service.create({
    data: {
      name: "Arreglo de Barba",
      description:
        "Perfilado y diseño de barba con tijera y navaja. Incluye aceites y bálsamos.",
      price: 15.0,
      duration: 20,
      category: "Barba",
      image: "/services/barba.jpg",
    },
  });

  const afeitado = await prisma.service.create({
    data: {
      name: "Afeitado Clásico",
      description:
        "Afeitado tradicional con navaja. Incluye toallas calientes y tratamiento post-afeitado.",
      price: 25.0,
      duration: 30,
      category: "Barba",
      image: "/services/afeitado.jpg",
    },
  });

  const completo = await prisma.service.create({
    data: {
      name: "Servicio Completo",
      description: "Corte de cabello + Arreglo de barba. Nuestro servicio más popular.",
      price: 35.0,
      duration: 50,
      category: "Paquetes",
      image: "/services/completo.jpg",
    },
  });

  console.log("✅ Servicios creados");

  // ============================================
  // ASIGNAR SERVICIOS A BARBEROS
  // ============================================

  await prisma.barberService.createMany({
    data: [
      { barberId: barber1.id, serviceId: corteClasico.id },
      { barberId: barber1.id, serviceId: corteModerno.id },
      { barberId: barber1.id, serviceId: fade.id },
      { barberId: barber1.id, serviceId: barba.id },
      { barberId: barber1.id, serviceId: completo.id },
      { barberId: barber2.id, serviceId: corteModerno.id },
      { barberId: barber2.id, serviceId: fade.id },
      { barberId: barber2.id, serviceId: afeitado.id },
      { barberId: barber2.id, serviceId: completo.id },
    ],
  });

  console.log("✅ Servicios asignados a barberos");

  // ============================================
  // CREAR DISPONIBILIDAD
  // ============================================

  // Disponibilidad para barber1 (Lunes a Viernes)
  for (let day = 1; day <= 5; day++) {
    await prisma.availability.create({
      data: {
        barberId: barber1.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
      },
    });
  }

  // Disponibilidad para barber1 (Sábado)
  await prisma.availability.create({
    data: {
      barberId: barber1.id,
      dayOfWeek: 6,
      startTime: "10:00",
      endTime: "14:00",
    },
  });

  // Disponibilidad para barber2 (Martes a Sábado)
  for (let day = 2; day <= 6; day++) {
    await prisma.availability.create({
      data: {
        barberId: barber2.id,
        dayOfWeek: day,
        startTime: "10:00",
        endTime: "19:00",
      },
    });
  }

  console.log("✅ Disponibilidad creada");

  // ============================================
  // CREAR PORTAFOLIO
  // ============================================

  await prisma.portfolio.createMany({
    data: [
      {
        barberId: barber1.id,
        image: "/portfolio/barber1-1.jpg",
        title: "Fade Clásico",
        description: "Degradado perfecto con diseño",
      },
      {
        barberId: barber1.id,
        image: "/portfolio/barber1-2.jpg",
        title: "Corte Ejecutivo",
        description: "Estilo profesional y elegante",
      },
      {
        barberId: barber2.id,
        image: "/portfolio/barber2-1.jpg",
        title: "Corte Urbano",
        description: "Estilo moderno con textura",
      },
      {
        barberId: barber2.id,
        image: "/portfolio/barber2-2.jpg",
        title: "Afeitado Premium",
        description: "Afeitado clásico con toalla caliente",
      },
    ],
  });

  console.log("✅ Portafolio creado");

  // ============================================
  // CREAR PROMOCIONES
  // ============================================

  await prisma.promotion.createMany({
    data: [
      {
        code: "BIENVENIDA20",
        description: "20% de descuento en tu primera visita",
        discount: 20,
        type: "PERCENTAGE",
        minPoints: 0,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 días
      },
      {
        code: "FIDELIDAD100",
        description: "$10 de descuento con 100 puntos de fidelidad",
        discount: 10,
        type: "FIXED",
        minPoints: 100,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      },
    ],
  });

  console.log("✅ Promociones creadas");

  // ============================================
  // CONFIGURACIÓN DEL SISTEMA
  // ============================================

  await prisma.systemConfig.createMany({
    data: [
      {
        key: "BUSINESS_NAME",
        value: "Elite Barbershop",
        description: "Nombre del negocio",
      },
      {
        key: "BUSINESS_EMAIL",
        value: "contacto@barbershop.com",
        description: "Email de contacto",
      },
      {
        key: "BUSINESS_PHONE",
        value: "+1234567890",
        description: "Teléfono de contacto",
      },
      {
        key: "BUSINESS_ADDRESS",
        value: "123 Main Street, Ciudad, País",
        description: "Dirección física",
      },
      {
        key: "POINTS_PER_DOLLAR",
        value: "10",
        description: "Puntos de fidelidad por cada dólar gastado",
      },
      {
        key: "CANCELLATION_HOURS",
        value: "2",
        description: "Horas mínimas para cancelar una cita",
      },
      {
        key: "REMINDER_HOURS",
        value: "24",
        description: "Horas antes para enviar recordatorio de cita",
      },
    ],
  });

  console.log("✅ Configuración del sistema creada");

  console.log("\n🎉 Seed completado exitosamente!");
  console.log("\n📧 Credenciales de prueba:");
  console.log("Admin: admin@barbershop.com / password123");
  console.log("Barbero 1: carlos.barbero@barbershop.com / password123");
  console.log("Barbero 2: luis.barbero@barbershop.com / password123");
  console.log("Cliente 1: juan.perez@email.com / password123");
  console.log("Cliente 2: maria.gomez@email.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
