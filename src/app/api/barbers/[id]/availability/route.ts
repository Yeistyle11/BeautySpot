import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Obtener disponibilidad de un barbero
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const barberId = parseInt(params.id);

    const availability = await prisma.availability.findMany({
      where: {
        barberId,
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

    const barberId = parseInt(params.id);
    const body = await req.json();
    const { availability } = body;

    // Verificar que el usuario es el barbero o es admin
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      include: { user: true },
    });

    if (!barber) {
      return NextResponse.json(
        { error: "Barbero no encontrado" },
        { status: 404 }
      );
    }

    const userId = parseInt(session.user.id);
    if (
      barber.userId !== userId &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Eliminar disponibilidad anterior
    await prisma.availability.deleteMany({
      where: { barberId },
    });

    // Crear nueva disponibilidad
    if (availability && availability.length > 0) {
      await prisma.availability.createMany({
        data: availability.map((item: any) => ({
          barberId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          active: true,
        })),
      });
    }

    const updatedAvailability = await prisma.availability.findMany({
      where: { barberId },
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
