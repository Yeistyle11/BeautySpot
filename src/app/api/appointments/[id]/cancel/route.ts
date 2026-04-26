import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Cancelar una cita
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { cancelReason } = await request.json();

    // Obtener la cita
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        services: {
          include: {
            service: true,
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

    // Verificar que el usuario es el dueño de la cita
    if (
      appointment.clientId !== parseInt(session.user.id) &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para cancelar esta cita" },
        { status: 403 }
      );
    }

    // Verificar que la cita no esté ya cancelada o completada
    if (appointment.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Esta cita ya está cancelada" },
        { status: 400 }
      );
    }

    if (appointment.status === "COMPLETED") {
      return NextResponse.json(
        { error: "No se puede cancelar una cita completada" },
        { status: 400 }
      );
    }

    // Verificar que falten más de 2 horas para la cita
    const appointmentDateTime = new Date(appointment.date);
    const [hours, minutes] = appointment.startTime.split(":").map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 2) {
      return NextResponse.json(
        {
          error:
            "No se puede cancelar una cita con menos de 2 horas de anticipación",
        },
        { status: 400 }
      );
    }

    // Cancelar la cita
    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(params.id) },
      data: {
        status: "CANCELLED",
        cancelReason: cancelReason || "Sin razón especificada",
      },
    });

    // Revertir los puntos de fidelidad
    if (appointment.pointsEarned > 0) {
      await prisma.user.update({
        where: { id: appointment.clientId },
        data: {
          loyaltyPoints: {
            decrement: appointment.pointsEarned,
          },
        },
      });
    }

    return NextResponse.json({
      message: "Cita cancelada exitosamente",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error al cancelar cita:", error);
    return NextResponse.json(
      { error: "Error al cancelar cita" },
      { status: 500 }
    );
  }
}
