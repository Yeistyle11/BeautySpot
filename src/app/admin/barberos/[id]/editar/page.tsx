import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BarberForm from "@/components/forms/BarberForm";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

export default async function EditBarberPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const barber = await prisma.barber.findUnique({
    where: { id: parseInt(params.id) },
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
    redirect("/admin/barberos");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Barberos", href: "/admin/barberos" },
              { label: barber.user.name, href: `/admin/barberos/${barber.id}` },
              { label: "Editar" },
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Editar Barbero</h1>
          <p className="mt-1 text-gray-600">
            Actualiza la información de {barber.user.name}
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
