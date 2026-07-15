import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { profileSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    const userId = parseInt(session.user.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (validatedData.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "El email ya está en uso" },
          { status: 400 }
        );
      }
    }

    const updateData: {
      name: string;
      email: string;
      phone: string | null;
      password?: string;
    } = {
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone || null,
    };

    if (validatedData.newPassword) {
      const isValidPassword = await bcrypt.compare(
        validatedData.currentPassword!,
        user.password
      );

      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Contraseña actual incorrecta" },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(validatedData.newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: "Perfil actualizado exitosamente",
      user: updatedUser,
    });
  } catch (error: unknown) {
    console.error("Error al actualizar perfil:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al actualizar el perfil" },
      { status: 500 }
    );
  }
}
