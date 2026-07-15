import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceUpdateSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";

// GET - Obtener un servicio por ID
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await prisma.service.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(service);
  } catch (error) {
    console.error("Error al obtener servicio:", error);
    return NextResponse.json(
      { error: "Error al obtener servicio" },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar servicio (solo Admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = serviceUpdateSchema.parse(body);
    const { name, description, price, duration, category, active } =
      validatedData;

    const serviceId = parseInt(params.id);

    // Si se intenta desactivar, verificar que no haya citas pendientes o confirmadas
    if (active === false) {
      const pendingAppointments = await prisma.appointmentService.count({
        where: {
          serviceId: serviceId,
          appointment: {
            status: {
              in: ["PENDING", "CONFIRMED"],
            },
          },
        },
      });

      if (pendingAppointments > 0) {
        return NextResponse.json(
          {
            error: `No se puede desactivar el servicio porque tiene ${pendingAppointments} cita(s) pendiente(s) o confirmada(s).`,
          },
          { status: 400 }
        );
      }
    }

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(price !== undefined && { price }),
        ...(duration !== undefined && { duration }),
        ...(category && { category }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json(service);
  } catch (error: unknown) {
    console.error("Error al actualizar servicio:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al actualizar servicio" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar servicio (solo Admin) - Soft delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const serviceId = parseInt(params.id);

    // Verificar si hay citas pendientes o confirmadas con este servicio
    const pendingAppointments = await prisma.appointmentService.count({
      where: {
        serviceId: serviceId,
        appointment: {
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
        },
      },
    });

    if (pendingAppointments > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el servicio porque tiene ${pendingAppointments} cita(s) pendiente(s) o confirmada(s).`,
        },
        { status: 400 }
      );
    }

    // En lugar de eliminar, lo desactivamos (soft delete)
    const service = await prisma.service.update({
      where: { id: serviceId },
      data: { active: false },
    });

    return NextResponse.json({
      message: "Servicio desactivado exitosamente",
      service,
    });
  } catch (error) {
    console.error("Error al eliminar servicio:", error);
    return NextResponse.json(
      { error: "Error al eliminar servicio" },
      { status: 500 }
    );
  }
}
