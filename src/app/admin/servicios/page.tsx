import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import ServiceActions from "@/components/admin/ServiceActions";

export default async function AdminServicesPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const services = await prisma.service.findMany({
    orderBy: { category: "asc" },
  });

  // Agrupar por categoría
  const servicesByCategory = services.reduce(
    (acc, service) => {
      if (!acc[service.category]) {
        acc[service.category] = [];
      }
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, typeof services>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Servicios
              </h1>
              <p className="mt-1 text-gray-600">
                Administra el catálogo de servicios
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin/servicios/nuevo"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              >
                + Nuevo Servicio
              </Link>
              <Link
                href="/admin"
                className="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
              >
                ← Panel de Administración
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Estadísticas */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-600">Total Servicios</p>
            <p className="text-3xl font-bold text-gray-900">
              {services.length}
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-600">Servicios Activos</p>
            <p className="text-3xl font-bold text-green-600">
              {services.filter((s) => s.active).length}
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm text-gray-600">Servicios Inactivos</p>
            <p className="text-3xl font-bold text-red-600">
              {services.filter((s) => !s.active).length}
            </p>
          </div>
        </div>

        {/* Servicios por categoría */}
        <div className="space-y-8">
          {Object.entries(servicesByCategory).map(
            ([category, categoryServices]) => (
              <div key={category} className="rounded-lg bg-white shadow">
                <div className="border-b bg-gray-50 px-6 py-4">
                  <h2 className="text-xl font-semibold capitalize text-gray-900">
                    {category} ({categoryServices.length})
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Precio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Duración
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {categoryServices.map((service) => (
                        <tr key={service.id}>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {service.name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="max-w-xs truncate text-sm text-gray-500">
                              {service.description}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="text-sm font-semibold text-green-600">
                              {formatCurrency(service.price)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="text-sm text-gray-500">
                              {service.duration} min
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                service.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {service.active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/admin/servicios/${service.id}/editar`}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Editar
                              </Link>
                              <span className="text-gray-300">|</span>
                              <ServiceActions
                                serviceId={service.id}
                                serviceName={service.name}
                                isActive={service.active}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>

        {/* Si no hay servicios */}
        {services.length === 0 && (
          <div className="rounded-lg bg-white py-12 text-center shadow">
            <p className="mb-4 text-lg text-gray-500">
              No hay servicios creados aún
            </p>
            <Link
              href="/admin/servicios/nuevo"
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Crear el primer servicio
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
