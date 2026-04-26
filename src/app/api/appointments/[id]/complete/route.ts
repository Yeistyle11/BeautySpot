import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Marcar una cita como completada
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "BARBER" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Buscar la cita
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        barber: true,
        services: {
          include: {
            service: true,
          },
        },
        client: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que el barbero es el dueño de la cita (excepto si es admin)
    if (
      session.user.role !== "ADMIN" &&
      appointment.barber.userId !== parseInt(session.user.id)
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar esta cita" },
        { status: 403 }
      );
    }

    // Verificar que la cita no esté ya completada o cancelada
    if (appointment.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Esta cita ya está completada" },
        { status: 400 }
      );
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json(
        { error: "No se puede completar una cita cancelada" },
        { status: 400 }
      );
    }

    // Calcular precio total de todos los servicios
    const totalPrice = appointment.services.reduce(
      (sum, as) => sum + as.service.price,
      0
    );

    // Calcular puntos de lealtad (10% del precio total)
    const pointsEarned = Math.floor(totalPrice * 0.1);

    // Marcar como completada y asignar puntos
    const updatedAppointment = await prisma.$transaction([
      prisma.appointment.update({
        where: { id: parseInt(params.id) },
        data: {
          status: "COMPLETED",
          pointsEarned,
        },
      }),
      prisma.user.update({
        where: { id: appointment.clientId },
        data: {
          loyaltyPoints: {
            increment: pointsEarned,
          },
        },
      }),
    ]);

    // TODO: Enviar notificación al cliente

    return NextResponse.json(updatedAppointment[0]);
  } catch (error) {
    console.error("Error al completar cita:", error);
    return NextResponse.json(
      { error: "Error al completar la cita" },
      { status: 500 }
    );
  }
}
