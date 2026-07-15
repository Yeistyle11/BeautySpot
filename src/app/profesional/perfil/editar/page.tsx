import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfessionalForm from "@/components/forms/ProfessionalForm";

export default async function ProfessionalProfileEditPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "PROFESSIONAL") {
    redirect("/");
  }

  const professional = await prisma.professional.findUnique({
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

  if (!professional) {
    redirect("/profesional");
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
        <ProfessionalForm
          mode="edit"
          initialData={{
            id: professional.id,
            name: professional?.user.name,
            email: professional?.user.email,
            phone: professional?.user.phone || "",
            bio: professional.bio || "",
            specialties: professional.specialties,
            yearsExp: professional.yearsExp,
            image: professional?.user.image || "",
          }}
        />
      </main>
    </div>
  );
}
