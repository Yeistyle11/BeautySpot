import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Obtener bloques bloqueados de un barbero
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const barberId = parseInt(params.id);

    const blockedSlots = await prisma.blockedSlot.findMany({
      where: {
        barberId,
        date: {
          gte: new Date(),
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(blockedSlots);
  } catch (error: any) {
    console.error("Error al obtener bloques bloqueados:", error);
    return NextResponse.json(
      { error: "Error al obtener bloques bloqueados" },
      { status: 500 }
    );
  }
}

// POST - Crear un bloque bloqueado
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
    const { date, startTime, endTime, reason } = body;

    // Verificar que el usuario es el barbero o es admin
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
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

    const blockedSlot = await prisma.blockedSlot.create({
      data: {
        barberId,
        date: new Date(date),
        startTime,
        endTime,
        reason,
      },
    });

    return NextResponse.json(blockedSlot, { status: 201 });
  } catch (error: any) {
    console.error("Error al crear bloque bloqueado:", error);
    return NextResponse.json(
      { error: "Error al crear bloque bloqueado" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un bloque bloqueado
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json(
        { error: "ID de bloque requerido" },
        { status: 400 }
      );
    }

    const slot = await prisma.blockedSlot.findUnique({
      where: { id: parseInt(slotId) },
      include: { barber: true },
    });

    if (!slot) {
      return NextResponse.json(
        { error: "Bloque no encontrado" },
        { status: 404 }
      );
    }

    const userId = parseInt(session.user.id);
    if (
      slot.barber.userId !== userId &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await prisma.blockedSlot.delete({
      where: { id: parseInt(slotId) },
    });

    return NextResponse.json({ message: "Bloque eliminado" });
  } catch (error: any) {
    console.error("Error al eliminar bloque:", error);
    return NextResponse.json(
      { error: "Error al eliminar bloque" },
      { status: 500 }
    );
  }
}
