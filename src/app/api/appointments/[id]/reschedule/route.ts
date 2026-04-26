import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH - Reagendar una cita
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { date, startTime } = await request.json();

    if (!date || !startTime) {
      return NextResponse.json(
        { error: "Fecha y hora son requeridos" },
        { status: 400 }
      );
    }

    // Buscar la cita existente
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        barber: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que el usuario es el dueño de la cita
    if (
      appointment.clientId !== parseInt(session.user.id) &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar esta cita" },
        { status: 403 }
      );
    }

    // Verificar que la cita no esté ya completada o cancelada
    if (
      appointment.status === "COMPLETED" ||
      appointment.status === "CANCELLED"
    ) {
      return NextResponse.json(
        {
          error: `No se puede reagendar una cita ${appointment.status === "COMPLETED" ? "completada" : "cancelada"}`,
        },
        { status: 400 }
      );
    }

    // Parsear la nueva fecha
    const [year, month, day] = date.split("-").map(Number);
    const newDate = new Date(year, month - 1, day);

    // Validar que la nueva fecha sea futura
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (newDate < now) {
      return NextResponse.json(
        { error: "No puedes reagendar para una fecha pasada" },
        { status: 400 }
      );
    }

    // Validar restricción de 2 horas mínimas
    const appointmentDateTime = new Date(`${date}T${startTime}`);
    const twoHoursFromNow = new Date();
    twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);

    if (appointmentDateTime < twoHoursFromNow) {
      return NextResponse.json(
        { error: "Debes reagendar con al menos 2 horas de anticipación" },
        { status: 400 }
      );
    }

    // Calcular hora de fin basado en la duración total de los servicios
    const totalDuration = appointment.services.reduce(
      (sum, as) => sum + as.service.duration,
      0
    );
    const [hours, minutes] = startTime.split(":").map(Number);
    const endDate = new Date(newDate);
    endDate.setHours(hours, minutes + totalDuration);
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    // Verificar disponibilidad del barbero en el nuevo horario
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        barberId: appointment.barberId,
        date: newDate,
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
        id: {
          not: parseInt(params.id), // Excluir la cita actual
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

    if (conflictingAppointment) {
      return NextResponse.json(
        { error: "El horario seleccionado ya no está disponible" },
        { status: 400 }
      );
    }

    // Actualizar la cita
    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(params.id) },
      data: {
        date: newDate,
        startTime,
        endTime,
        status: "PENDING", // Volver a estado pendiente al reagendar
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
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // TODO: Enviar email de confirmación de reagendamiento

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    console.error("Error al reagendar cita:", error);
    return NextResponse.json(
      { error: "Error al reagendar la cita" },
      { status: 500 }
    );
  }
}
