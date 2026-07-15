import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { professionalUpdateSchema } from "@/lib/validations/schemas";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const professionalId = parseInt(params.id);

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
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

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos: admin o el mismo profesional
    if (
      session.user.role !== "ADMIN" &&
      professional?.userId !== parseInt(session.user.id)
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json(professional);
  } catch (error) {
    console.error("Error al obtener profesional:", error);
    return NextResponse.json(
      { error: "Error al obtener profesional" },
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

    const professionalId = parseInt(params.id);
    const body = await request.json();

    // Validar datos con Zod
    const validatedData = professionalUpdateSchema.parse(body);

    // Obtener profesional actual
    const currentProfessional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true },
    });

    if (!currentProfessional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos: admin o el mismo profesional
    if (
      session.user.role !== "ADMIN" &&
      currentProfessional.userId !== parseInt(session.user.id)
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
    const userUpdateData: {
      name: string;
      phone: string | null;
      image: string | null;
      password?: string;
    } = {
      name: validatedData.name || currentProfessional.user.name,
      phone: validatedData.phone || currentProfessional.user.phone,
      image:
        validatedData.image !== undefined
          ? validatedData.image
          : currentProfessional.user.image,
    };

    // Si se proporciona contraseña, hashearla
    if (validatedData.password) {
      userUpdateData.password = await bcrypt.hash(validatedData.password, 10);
    }

    // Actualizar usuario
    await prisma.user.update({
      where: { id: currentProfessional.userId },
      data: userUpdateData,
    });

    // Si se intenta desactivar, verificar que no haya citas pendientes o confirmadas
    if (validatedData.active === false) {
      const pendingAppointments = await prisma.appointment.count({
        where: {
          professionalId: professionalId,
          status: {
            in: ["PENDING", "CONFIRMED"],
          },
        },
      });

      if (pendingAppointments > 0) {
        return NextResponse.json(
          {
            error: `No se puede desactivar el profesional porque tiene ${pendingAppointments} cita(s) pendiente(s) o confirmada(s).`,
          },
          { status: 400 }
        );
      }
    }

    // Actualizar perfil de profesional
    const updatedProfessional = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        bio:
          validatedData.bio !== undefined
            ? validatedData.bio
            : currentProfessional.bio,
        specialties:
          validatedData.specialties || currentProfessional.specialties,
        yearsExp:
          validatedData.yearsExp !== undefined
            ? validatedData.yearsExp
            : currentProfessional.yearsExp,
        active:
          validatedData.active !== undefined
            ? validatedData.active
            : currentProfessional.active,
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
      message: "Profesional actualizado exitosamente",
      professional: updatedProfessional,
    });
  } catch (error: unknown) {
    console.error("Error al actualizar profesional:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al actualizar profesional" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar profesional (solo Admin) - Soft delete
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const professionalId = parseInt(params.id);

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        appointments: true,
      },
    });

    if (!professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // Verificar si tiene alguna cita en el historial
    if (professional.appointments.length > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el profesional porque tiene ${professional.appointments.length} cita(s) en su historial. Solo se pueden eliminar profesionales sin citas registradas.`,
        },
        { status: 400 }
      );
    }

    // Eliminar completamente si no tiene citas
    await prisma.professional.delete({
      where: { id: professionalId },
    });
    return NextResponse.json({
      message: "Profesional eliminado exitosamente",
    });
  } catch (error) {
    console.error("Error al eliminar profesional:", error);
    return NextResponse.json(
      { error: "Error al eliminar profesional" },
      { status: 500 }
    );
  }
}
