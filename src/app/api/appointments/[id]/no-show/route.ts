import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Marcar una cita como no show (cliente no se presentó)
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
        { error: "No se puede marcar como no show una cita cancelada" },
        { status: 400 }
      );
    }

    // Marcar como NO_SHOW
    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(params.id) },
      data: {
        status: "NO_SHOW",
      },
    });

    // TODO: Enviar notificación al cliente

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    console.error("Error al marcar no show:", error);
    return NextResponse.json(
      { error: "Error al marcar la cita como no show" },
      { status: 500 }
    );
  }
}
