import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Asignar un servicio a un barbero
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { barberId, serviceId } = await request.json();

    if (!barberId || !serviceId) {
      return NextResponse.json(
        { error: "barberId y serviceId son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el barbero existe
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      return NextResponse.json(
        { error: "Barbero no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que el servicio existe
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    // Verificar si ya está asignado
    const existing = await prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId,
          serviceId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Este servicio ya está asignado a este barbero" },
        { status: 400 }
      );
    }

    // Crear la asignación
    const assignment = await prisma.barberService.create({
      data: {
        barberId,
        serviceId,
      },
      include: {
        barber: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        service: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: `Servicio "${assignment.service.name}" asignado a ${assignment.barber.user.name}`,
        assignment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al asignar servicio:", error);
    return NextResponse.json(
      { error: "Error al asignar servicio" },
      { status: 500 }
    );
  }
}

// DELETE - Desasignar un servicio de un barbero
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { barberId, serviceId } = await request.json();

    if (!barberId || !serviceId) {
      return NextResponse.json(
        { error: "barberId y serviceId son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que la asignación existe
    const existing = await prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId,
          serviceId,
        },
      },
      include: {
        barber: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        service: {
          select: { name: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Esta asignación no existe" },
        { status: 404 }
      );
    }

    // Eliminar la asignación
    await prisma.barberService.delete({
      where: {
        barberId_serviceId: {
          barberId,
          serviceId,
        },
      },
    });

    return NextResponse.json({
      message: `Servicio "${existing.service.name}" desasignado de ${existing.barber.user.name}`,
    });
  } catch (error) {
    console.error("Error al desasignar servicio:", error);
    return NextResponse.json(
      { error: "Error al desasignar servicio" },
      { status: 500 }
    );
  }
}

// GET - Obtener todas las asignaciones
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const barberIdParam = searchParams.get("barberId");
    const serviceIdParam = searchParams.get("serviceId");

    // Construir el where clause
    const where: any = {};
    if (barberIdParam) where.barberId = parseInt(barberIdParam);
    if (serviceIdParam) where.serviceId = parseInt(serviceIdParam);

    const assignments = await prisma.barberService.findMany({
      where,
      include: {
        barber: {
          include: {
            user: {
              select: { name: true, email: true, image: true },
            },
          },
        },
        service: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error al obtener asignaciones:", error);
    return NextResponse.json(
      { error: "Error al obtener asignaciones" },
      { status: 500 }
    );
  }
}
