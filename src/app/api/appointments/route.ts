import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// GET - Obtener citas (filtradas según el usuario)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let where: any = {};

    // Si es cliente, solo ver sus propias citas
    if (session.user.role === "CLIENT") {
      where.clientId = session.user.id;
    }
    // Si es barbero, ver citas asignadas a él
    else if (session.user.role === "BARBER") {
      const barber = await prisma.barber.findUnique({
        where: { userId: parseInt(session.user.id) },
      });
      if (barber) {
        where.barberId = barber.id;
      }
    }
    // Si es admin, ver todas

    if (status) {
      where.status = status;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        barber: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
        services: {
          include: {
            service: {
              select: {
                name: true,
                price: true,
                duration: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Error al obtener citas:", error);
    return NextResponse.json(
      { error: "Error al obtener citas" },
      { status: 500 }
    );
  }
}

// POST - Crear una nueva cita (puede incluir múltiples servicios)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    const { serviceIds, barberId, date, startTime, notes } = body;

    // Validaciones
    if (
      !serviceIds ||
      !Array.isArray(serviceIds) ||
      serviceIds.length === 0 ||
      !barberId ||
      !date ||
      !startTime
    ) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Obtener los servicios para saber la duración y precio total
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });

    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        {
          error: "Algunos servicios no fueron encontrados",
          requestedIds: serviceIds,
          foundIds: services.map((s) => s.id),
        },
        { status: 404 }
      );
    }

    // Verificar que el barbero existe
    const barberExists = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barberExists) {
      return NextResponse.json(
        { error: "El barbero no fue encontrado" },
        { status: 404 }
      );
    }

    // Calcular duración total y precio total
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

    // Calcular hora de fin
    const [hours, minutes] = startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + totalDuration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;

    // Parsear la fecha correctamente en formato local
    const [year, month, day] = date.split("-").map(Number);
    const appointmentDate = new Date(year, month - 1, day);

    // Verificar si ya existe una cita en ese horario
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        barberId,
        date: appointmentDate,
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
        ],
      },
    });

    if (existingAppointment) {
      return NextResponse.json(
        { error: "Este horario ya no está disponible" },
        { status: 400 }
      );
    }

    // Calcular puntos de fidelidad (10% del precio total)
    const pointsEarned = Math.floor(totalPrice * 0.1);

    const appointment = await prisma.appointment.create({
      data: {
        clientId: parseInt(session.user.id),
        barberId,
        date: appointmentDate,
        startTime,
        endTime,
        notes: notes || null,
        pointsEarned,
        status: "PENDING",
        services: {
          create: serviceIds.map((serviceId) => ({
            serviceId,
          })),
        },
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        barber: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Actualizar puntos del usuario
    await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: {
        loyaltyPoints: {
          increment: pointsEarned,
        },
      },
    });

    // Revalidar las páginas que muestran citas
    revalidatePath("/barbero");
    revalidatePath("/cliente/citas");
    revalidatePath("/admin");

    return NextResponse.json(
      {
        message: "Cita creada exitosamente",
        appointment,
        totalPrice,
        totalDuration,
        pointsEarned,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error al crear cita:", error);
    return NextResponse.json(
      {
        error: "Error al crear cita",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
