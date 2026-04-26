import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BarberForm from "@/components/forms/BarberForm";

export default async function BarberProfileEditPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "BARBER") {
    redirect("/");
  }

  const barber = await prisma.barber.findUnique({
    where: { userId: parseInt(session.user.id) },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  });

  if (!barber) {
    redirect("/barbero");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="mt-1 text-gray-600">
            Actualiza tu información profesional
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <BarberForm
          mode="edit"
          initialData={{
            id: barber.id,
            name: barber.user.name,
            email: barber.user.email,
            phone: barber.user.phone || "",
            bio: barber.bio || "",
            specialties: barber.specialties,
            yearsExp: barber.yearsExp,
            image: barber.user.image || "",
          }}
        />
      </main>
    </div>
  );
}
