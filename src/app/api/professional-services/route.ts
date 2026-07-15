import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { professionalServiceSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";

// POST - Asignar un servicio a un profesional
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { professionalId, serviceId } = professionalServiceSchema.parse(body);

    // Verificar que el profesional existe
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
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
    const existing = await prisma.professionalService.findUnique({
      where: {
        professionalId_serviceId: {
          professionalId,
          serviceId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Este servicio ya está asignado a este profesional" },
        { status: 400 }
      );
    }

    // Crear la asignación
    const assignment = await prisma.professionalService.create({
      data: {
        professionalId,
        serviceId,
      },
      include: {
        professional: {
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
        message: `Servicio "${assignment.service.name}" asignado a ${assignment.professional.user.name}`,
        assignment,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error al asignar servicio:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al asignar servicio" },
      { status: 500 }
    );
  }
}

// DELETE - Desasignar un servicio de un profesional
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { professionalId, serviceId } = professionalServiceSchema.parse(body);

    // Verificar que la asignación existe
    const existing = await prisma.professionalService.findUnique({
      where: {
        professionalId_serviceId: {
          professionalId,
          serviceId,
        },
      },
      include: {
        professional: {
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
    await prisma.professionalService.delete({
      where: {
        professionalId_serviceId: {
          professionalId,
          serviceId,
        },
      },
    });

    return NextResponse.json({
      message: `Servicio "${existing.service.name}" desasignado de ${existing.professional.user.name}`,
    });
  } catch (error: unknown) {
    console.error("Error al desasignar servicio:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

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
    const professionalIdParam = searchParams.get("professionalId");
    const serviceIdParam = searchParams.get("serviceId");

    // Construir el where clause
    const where: any = {};
    if (professionalIdParam)
      where.professionalId = parseInt(professionalIdParam);
    if (serviceIdParam) where.serviceId = parseInt(serviceIdParam);

    const assignments = await prisma.professionalService.findMany({
      where,
      include: {
        professional: {
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
