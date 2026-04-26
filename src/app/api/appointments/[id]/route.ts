import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Obtener una cita específica
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(params.id) },
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
                image: true,
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

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que el usuario tiene acceso a esta cita
    const hasAccess =
      appointment.clientId === parseInt(session.user.id) ||
      session.user.role === "ADMIN" ||
      (session.user.role === "BARBER" &&
        appointment.barber?.userId === parseInt(session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esta cita" },
        { status: 403 }
      );
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Error al obtener cita:", error);
    return NextResponse.json(
      { error: "Error al obtener la cita" },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar una cita (solo Admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { barberId, serviceIds, date, startTime } = await request.json();

    if (
      !barberId ||
      !serviceIds ||
      serviceIds.length === 0 ||
      !date ||
      !startTime
    ) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que la cita existe
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Solo se pueden editar citas pendientes o confirmadas
    if (
      appointment.status !== "PENDING" &&
      appointment.status !== "CONFIRMED"
    ) {
      return NextResponse.json(
        { error: "Solo se pueden editar citas pendientes o confirmadas" },
        { status: 400 }
      );
    }

    // Calcular duración total y hora de fin
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const [hours, minutes] = startTime.split(":").map(Number);
    const endDate = new Date(date);
    endDate.setHours(hours, minutes + totalDuration, 0, 0);
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    // Crear fecha correctamente sin problemas de zona horaria
    // Si la fecha viene como "2025-12-07", la parseamos correctamente
    const [year, month, day] = date.split("-").map(Number);
    const appointmentDate = new Date(year, month - 1, day, 0, 0, 0, 0);

    // Actualizar la cita y sus servicios en una transacción
    const updatedAppointment = await prisma.$transaction(async (tx) => {
      // Eliminar servicios anteriores
      await tx.appointmentService.deleteMany({
        where: { appointmentId: parseInt(params.id) },
      });

      // Actualizar la cita y resetear estado a PENDING
      const apt = await tx.appointment.update({
        where: { id: parseInt(params.id) },
        data: {
          barberId,
          date: appointmentDate,
          startTime,
          endTime,
          status: "PENDING", // Resetear a pendiente al editar
        },
      });

      // Agregar nuevos servicios
      await tx.appointmentService.createMany({
        data: serviceIds.map((serviceId: number) => ({
          appointmentId: apt.id,
          serviceId,
        })),
      });

      return apt;
    });

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    console.error("Error al actualizar cita:", error);
    return NextResponse.json(
      { error: "Error al actualizar la cita" },
      { status: 500 }
    );
  }
}
