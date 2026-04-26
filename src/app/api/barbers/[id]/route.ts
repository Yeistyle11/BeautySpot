import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Schema de validación para editar barbero
const updateBarberSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  yearsExp: z.number().min(0).max(50).optional(),
  image: z.string().optional(),
  active: z.boolean().optional(),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const barberId = parseInt(params.id);

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!barber) {
      return NextResponse.json(
        { error: "Barbero no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos: admin o el mismo barbero
    if (
      session.user.role !== "ADMIN" &&
      barber.userId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json(barber);
  } catch (error) {
    console.error("Error al obtener barbero:", error);
    return NextResponse.json(
      { error: "Error al obtener barbero" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const barberId = parseInt(params.id);
    const body = await request.json();

    // Validar datos con Zod
    const validatedData = updateBarberSchema.parse(body);

    // Obtener barbero actual
    const currentBarber = await prisma.barber.findUnique({
      where: { id: barberId },
      include: { user: true },
    });

    if (!currentBarber) {
      return NextResponse.json(
        { error: "Barbero no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos: admin o el mismo barbero
    if (
      session.user.role !== "ADMIN" &&
      currentBarber.userId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Solo admin puede cambiar el estado active
    if (validatedData.active !== undefined && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo administradores pueden cambiar el estado" },
        { status: 403 }
      );
    }

    // Preparar datos de actualización del usuario
    const userUpdateData: any = {
      name: validatedData.name || currentBarber.user.name,
      phone: validatedData.phone || currentBarber.user.phone,
      image:
        validatedData.image !== undefined
          ? validatedData.image
          : currentBarber.user.image,
    };

    // Si se proporciona contraseña, hashearla
    if (validatedData.password) {
      userUpdateData.password = await bcrypt.hash(validatedData.password, 10);
    }

    // Actualizar usuario
    await prisma.user.update({
      where: { id: currentBarber.userId },
      data: userUpdateData,
    });

    // Si se intenta desactivar, verificar que no haya citas pendientes o confirmadas
    if (validatedData.active === false) {
      const pendingAppointments = await prisma.appointment.count({
        where: {
          barberId: barberId,
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
        },
      });

      if (pendingAppointments > 0) {
        return NextResponse.json(
          {
            error: `No se puede desactivar el barbero porque tiene ${pendingAppointments} cita(s) pendiente(s) o confirmada(s).`,
          },
          { status: 400 }
        );
      }
    }

    // Actualizar perfil de barbero
    const updatedBarber = await prisma.barber.update({
      where: { id: barberId },
      data: {
        bio:
          validatedData.bio !== undefined
            ? validatedData.bio
            : currentBarber.bio,
        specialties: validatedData.specialties || currentBarber.specialties,
        yearsExp:
          validatedData.yearsExp !== undefined
            ? validatedData.yearsExp
            : currentBarber.yearsExp,
        active:
          validatedData.active !== undefined
            ? validatedData.active
            : currentBarber.active,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Barbero actualizado exitosamente",
      barber: updatedBarber,
    });
  } catch (error: any) {
    console.error("Error al actualizar barbero:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al actualizar barbero" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar barbero (solo Admin) - Soft delete
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const barberId = parseInt(params.id);

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
      include: {
        appointments: true,
      },
    });

    if (!barber) {
      return NextResponse.json(
        { error: "Barbero no encontrado" },
        { status: 404 }
      );
    }

    // Verificar si tiene alguna cita en el historial
    if (barber.appointments.length > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el barbero porque tiene ${barber.appointments.length} cita(s) en su historial. Solo se pueden eliminar barberos sin citas registradas.`,
        },
        { status: 400 }
      );
    }

    // Eliminar completamente si no tiene citas
    await prisma.barber.delete({
      where: { id: barberId },
    });
    return NextResponse.json({
      message: "Barbero eliminado exitosamente",
    });
  } catch (error) {
    console.error("Error al eliminar barbero:", error);
    return NextResponse.json(
      { error: "Error al eliminar barbero" },
      { status: 500 }
    );
  }
}
