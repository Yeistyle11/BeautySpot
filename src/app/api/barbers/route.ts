import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { barberCreateSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No autorizado. Solo administradores pueden crear barberos." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = barberCreateSchema.parse(body);

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Crear usuario con rol BARBER
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        phone: validatedData.phone || null,
        password: hashedPassword,
        role: "BARBER",
        image: validatedData.image || null,
      },
    });

    // Crear perfil de barbero
    const barber = await prisma.barber.create({
      data: {
        userId: user.id,
        bio: validatedData.bio || "",
        specialties: validatedData.specialties || [],
        yearsExp: validatedData.yearsExp || 0,
        rating: 5.0,
        active: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Barbero creado exitosamente",
        barber,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error al crear barbero:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al crear barbero" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const barbers = await prisma.barber.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(barbers);
  } catch (error) {
    console.error("Error al obtener barberos:", error);
    return NextResponse.json(
      { error: "Error al obtener barberos" },
      { status: 500 }
    );
  }
}
