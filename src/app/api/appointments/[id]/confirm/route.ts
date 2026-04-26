import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = parseInt(params.id);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        barber: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Solo barberos (dueños de la cita) o admins pueden confirmar
    if (
      session.user.role !== "ADMIN" &&
      (session.user.role !== "BARBER" ||
        appointment.barber.userId !== parseInt(session.user.id))
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para confirmar esta cita" },
        { status: 403 }
      );
    }

    // Solo se pueden confirmar citas pendientes
    if (appointment.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `No se puede confirmar una cita con estado ${appointment.status}`,
        },
        { status: 400 }
      );
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CONFIRMED" },
      include: {
        client: {
          select: {
            name: true,
            email: true,
          },
        },
        barber: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Cita confirmada exitosamente",
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error("Error al confirmar cita:", error);
    return NextResponse.json(
      { error: "Error al confirmar cita" },
      { status: 500 }
    );
  }
}
