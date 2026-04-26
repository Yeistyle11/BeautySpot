import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  void await prisma.user.create({
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

  const client3 = await prisma.user.create({
    data: {
      email: "pedro.lopez@email.com",
      password: hashedPassword,
      name: "Pedro López",
      phone: "+1234567895",
      role: "CLIENT",
      emailVerified: new Date(),
      loyaltyPoints: 50,
    },
  });

  const client4 = await prisma.user.create({
    data: {
      email: "ana.torres@email.com",
      password: hashedPassword,
      name: "Ana Torres",
      phone: "+1234567896",
      role: "CLIENT",
      emailVerified: new Date(),
      loyaltyPoints: 200,
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
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
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
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
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
      price: 20000,
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
      price: 25000,
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
      price: 30000,
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
      price: 15000,
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
      price: 25000,
      duration: 30,
      category: "Barba",
      image: "/services/afeitado.jpg",
    },
  });

  const completo = await prisma.service.create({
    data: {
      name: "Servicio Completo",
      description: "Corte de cabello + Arreglo de barba. Nuestro servicio más popular.",
      price: 35000,
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
      // Barber 1 - Carlos Martínez (todos los servicios)
      { barberId: barber1.id, serviceId: corteClasico.id },
      { barberId: barber1.id, serviceId: corteModerno.id },
      { barberId: barber1.id, serviceId: fade.id },
      { barberId: barber1.id, serviceId: barba.id },
      { barberId: barber1.id, serviceId: afeitado.id },
      { barberId: barber1.id, serviceId: completo.id },
      // Barber 2 - Luis Rodríguez (todos los servicios)
      { barberId: barber2.id, serviceId: corteClasico.id },
      { barberId: barber2.id, serviceId: corteModerno.id },
      { barberId: barber2.id, serviceId: fade.id },
      { barberId: barber2.id, serviceId: barba.id },
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
  // CREAR CITAS DE EJEMPLO (COMPLETADAS)
  // ============================================

  const pastDate1 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás
  const pastDate2 = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 días atrás
  const pastDate3 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 días atrás
  const pastDate4 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 días atrás
  const pastDate5 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 días atrás

  const appointment1 = await prisma.appointment.create({
    data: {
      clientId: client1.id,
      barberId: barber1.id,
      date: pastDate1,
      startTime: "10:00",
      endTime: "10:50",
      status: "COMPLETED",
      pointsEarned: 350,
      services: {
        create: {
          serviceId: completo.id,
        },
      },
    },
  });

  const appointment2 = await prisma.appointment.create({
    data: {
      clientId: client2.id,
      barberId: barber1.id,
      date: pastDate2,
      startTime: "14:00",
      endTime: "14:45",
      status: "COMPLETED",
      pointsEarned: 300,
      services: {
        create: {
          serviceId: fade.id,
        },
      },
    },
  });

  const appointment3 = await prisma.appointment.create({
    data: {
      clientId: client3.id,
      barberId: barber1.id,
      date: pastDate3,
      startTime: "11:00",
      endTime: "11:40",
      status: "COMPLETED",
      pointsEarned: 250,
      services: {
        create: {
          serviceId: corteModerno.id,
        },
      },
    },
  });

  const appointment4 = await prisma.appointment.create({
    data: {
      clientId: client4.id,
      barberId: barber2.id,
      date: pastDate4,
      startTime: "15:00",
      endTime: "15:30",
      status: "COMPLETED",
      pointsEarned: 250,
      services: {
        create: {
          serviceId: afeitado.id,
        },
      },
    },
  });

  const appointment5 = await prisma.appointment.create({
    data: {
      clientId: client1.id,
      barberId: barber2.id,
      date: pastDate5,
      startTime: "12:00",
      endTime: "12:50",
      status: "COMPLETED",
      pointsEarned: 350,
      services: {
        create: {
          serviceId: completo.id,
        },
      },
    },
  });

  console.log("✅ Citas de ejemplo creadas");

  // ============================================
  // CREAR RESEÑAS
  // ============================================

  await prisma.review.createMany({
    data: [
      // Reseñas para barber1 (Carlos Martínez)
      {
        appointmentId: appointment1.id,
        barberId: barber1.id,
        clientId: client1.id,
        rating: 5,
        comment:
          "Excelente servicio! Carlos es un profesional de primera. El corte quedó perfecto y el ambiente es muy agradable. Totalmente recomendado.",
        createdAt: new Date(pastDate1.getTime() + 2 * 60 * 60 * 1000), // 2 horas después
      },
      {
        appointmentId: appointment2.id,
        barberId: barber1.id,
        clientId: client2.id,
        rating: 5,
        comment:
          "El mejor fade que me han hecho! Muy detallista y profesional. Definitivamente volveré.",
        createdAt: new Date(pastDate2.getTime() + 1 * 60 * 60 * 1000),
      },
      {
        appointmentId: appointment3.id,
        barberId: barber1.id,
        clientId: client3.id,
        rating: 4,
        comment:
          "Muy buen servicio, quedé satisfecho con el resultado. El único detalle es que tuve que esperar un poco más de lo previsto.",
        createdAt: new Date(pastDate3.getTime() + 3 * 60 * 60 * 1000),
      },
      // Reseñas para barber2 (Luis Rodríguez)
      {
        appointmentId: appointment4.id,
        barberId: barber2.id,
        clientId: client4.id,
        rating: 5,
        comment:
          "Increíble experiencia! El afeitado clásico con toalla caliente es toda una experiencia. Luis es muy atento y profesional.",
        createdAt: new Date(pastDate4.getTime() + 2 * 60 * 60 * 1000),
      },
      {
        appointmentId: appointment5.id,
        barberId: barber2.id,
        clientId: client1.id,
        rating: 5,
        comment:
          "Segunda vez que vengo y no decepciona. Excelente trabajo tanto en el corte como en el arreglo de barba. 100% recomendado.",
        createdAt: new Date(pastDate5.getTime() + 1 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("✅ Reseñas creadas");

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

  console.log("🎉 Seed completado exitosamente!");
  console.log("\n📧 Credenciales de prueba:");
  console.log("Admin: admin@barbershop.com / password123");
  console.log("Barbero 1: carlos.barbero@barbershop.com / password123");
  console.log("Barbero 2: luis.barbero@barbershop.com / password123");
  console.log("Cliente 1: juan.perez@email.com / password123");
  console.log("Cliente 2: maria.gomez@email.com / password123");
  console.log("Cliente 3: pedro.lopez@email.com / password123");
  console.log("Cliente 4: ana.torres@email.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
