import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "CLIENT") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { appointmentId, barberId, rating, comment } = body;

    // Validaciones
    if (!appointmentId || !barberId || !rating) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "La calificación debe estar entre 1 y 5" },
        { status: 400 }
      );
    }

    // Verificar que la cita existe y pertenece al cliente
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        clientId: session.user.id,
        barberId: barberId,
        status: "COMPLETED",
      },
      include: {
        review: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada o no completada" },
        { status: 404 }
      );
    }

    // Verificar que no tenga reseña ya
    if (appointment.review) {
      return NextResponse.json(
        { error: "Esta cita ya tiene una reseña" },
        { status: 400 }
      );
    }

    // Crear la reseña
    const review = await prisma.review.create({
      data: {
        appointmentId,
        barberId,
        clientId: session.user.id,
        rating,
        comment: comment || null,
      },
    });

    // Actualizar el rating promedio del barbero
    const reviews = await prisma.review.findMany({
      where: { barberId },
      select: { rating: true },
    });

    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await prisma.barber.update({
      where: { id: barberId },
      data: { rating: Math.round(avgRating * 10) / 10 },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("Error al crear reseña:", error);
    return NextResponse.json(
      { error: "Error al crear la reseña" },
      { status: 500 }
    );
  }
}
