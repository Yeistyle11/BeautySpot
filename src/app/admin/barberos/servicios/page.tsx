import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ServiceAssignment from "@/components/admin/ServiceAssignment";

export default async function AssignServicesPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Obtener todos los barberos con sus servicios asignados
  const barbers = await prisma.barber.findMany({
    where: { active: true },
    include: {
      user: {
        select: { name: true, email: true, image: true },
      },
      services: {
        select: {
          serviceId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Obtener todos los servicios activos
  const allServices = await prisma.service.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      price: true,
      duration: true,
      category: true,
    },
    orderBy: { category: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Asignar Servicios a Barberos
            </h1>
            <Link
              href="/admin/barberos"
              className="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
            >
              ← Volver a Barberos
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {barbers.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="mb-4 text-gray-600">
              No hay barberos registrados en el sistema
            </p>
            <p className="text-sm text-gray-500">
              Los usuarios con rol BARBER aparecerán aquí automáticamente
            </p>
          </div>
        ) : (
          <ServiceAssignment barbers={barbers} allServices={allServices} />
        )}
      </main>
    </div>
  );
}
