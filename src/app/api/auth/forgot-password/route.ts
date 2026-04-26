import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Por seguridad, siempre devolvemos éxito aunque el email no exista
    // Esto previene que atacantes descubran qué emails están registrados
    if (!user) {
      return NextResponse.json({
        message: "Si el email existe, recibirás un enlace de recuperación",
      });
    }

    // Generar token único y seguro
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    // Guardar token en la base de datos
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // En producción, aquí enviarías un email con el enlace
    // Por ahora, mostramos el enlace en la consola para desarrollo
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    // TODO: Implementar envío de email real con nodemailer o servicio como SendGrid
    // const info = await transporter.sendMail({
    //   from: '"BarberShop" <noreply@barbershop.com>',
    //   to: email,
    //   subject: 'Recuperación de Contraseña',
    //   html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
    //          <a href="${resetUrl}">${resetUrl}</a>
    //          <p>Este enlace expirará en 1 hora.</p>`
    // });

    return NextResponse.json({
      message: "Si el email existe, recibirás un enlace de recuperación",
    });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
