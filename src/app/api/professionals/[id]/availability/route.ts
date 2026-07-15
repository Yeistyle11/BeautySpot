import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Obtener disponibilidad de un profesional
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const professionalId = parseInt(params.id);

    const availability = await prisma.availability.findMany({
      where: {
        professionalId,
        active: true,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
    });

    return NextResponse.json(availability);
  } catch (error: any) {
    console.error("Error al obtener disponibilidad:", error);
    return NextResponse.json(
      { error: "Error al obtener disponibilidad" },
      { status: 500 }
    );
  }
}

// POST - Actualizar disponibilidad semanal completa
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const professionalId = parseInt(params.id);
    const body = await req.json();
    const { availability } = body;

    // Verificar que el usuario es el profesional o es admin
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    const userId = parseInt(session.user.id);
    if (professional?.userId !== userId && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Eliminar disponibilidad anterior
    await prisma.availability.deleteMany({
      where: { professionalId },
    });

    // Crear nueva disponibilidad
    if (availability && availability.length > 0) {
      await prisma.availability.createMany({
        data: availability.map((item: any) => ({
          professionalId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          active: true,
        })),
      });
    }

    const updatedAvailability = await prisma.availability.findMany({
      where: { professionalId },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json({
      message: "Disponibilidad actualizada",
      availability: updatedAvailability,
    });
  } catch (error: any) {
    console.error("Error al actualizar disponibilidad:", error);
    return NextResponse.json(
      { error: "Error al actualizar disponibilidad" },
      { status: 500 }
    );
  }
}
