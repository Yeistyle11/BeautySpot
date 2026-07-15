import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = reviewSchema.parse(body);

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: validatedData.appointmentId,
        clientId: parseInt(session.user.id),
        professionalId: validatedData.professionalId,
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

    if (appointment.review) {
      return NextResponse.json(
        { error: "Esta cita ya tiene una reseña" },
        { status: 400 }
      );
    }

    const review = await prisma.review.create({
      data: {
        appointmentId: validatedData.appointmentId,
        professionalId: validatedData.professionalId,
        clientId: parseInt(session.user.id),
        rating: validatedData.rating,
        comment: validatedData.comment || null,
      },
    });

    const reviews = await prisma.review.findMany({
      where: { professionalId: validatedData.professionalId },
      select: { rating: true },
    });

    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await prisma.professional.update({
      where: { id: validatedData.professionalId },
      data: { rating: Math.round(avgRating * 10) / 10 },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear reseña:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al crear la reseña" },
      { status: 500 }
    );
  }
}
