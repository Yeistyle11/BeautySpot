import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { appointmentCreateSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";

// GET - Obtener citas (filtradas según el usuario)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let where: Record<string, unknown> = {};

    // Si es cliente, solo ver sus propias citas
    if (session.user.role === "CLIENT") {
      where.clientId = session.user.id;
    }
    // Si es profesional, ver citas asignadas a él
    else if (session.user.role === "PROFESSIONAL") {
      const professional = await prisma.professional.findUnique({
        where: { userId: parseInt(session.user.id) },
      });
      if (professional) {
        where.professionalId = professional.id;
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
        professional: {
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

    const validatedData = appointmentCreateSchema.parse(body);
    const { serviceIds, professionalId, date, startTime, notes } =
      validatedData;

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

    // Verificar que el profesional existe
    const professionalExists = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professionalExists) {
      return NextResponse.json(
        { error: "El profesional no fue encontrado" },
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
        professionalId,
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

    // Los puntos de fidelidad NO se otorgan aqui. Se otorgan unicamente
    // al completar la cita (api/appointments/[id]/complete). Otorgarlos en
    // la creacion provocaba doble otorgamiento (create + complete).
    const appointment = await prisma.appointment.create({
      data: {
        clientId: parseInt(session.user.id),
        professionalId,
        date: appointmentDate,
        startTime,
        endTime,
        notes: notes || null,
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
        professional: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Revalidar las páginas que muestran citas
    revalidatePath("/profesional");
    revalidatePath("/cliente/citas");
    revalidatePath("/admin");

    return NextResponse.json(
      {
        message: "Cita creada exitosamente",
        appointment,
        totalPrice,
        totalDuration,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error al crear cita:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Error al crear cita" }, { status: 500 });
  }
}
