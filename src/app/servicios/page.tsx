import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
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
            <h1 className="text-3xl font-bold text-gray-900">
              💈 Nuestros Servicios
            </h1>
            <a href="/" className="text-indigo-600 hover:text-indigo-800">
              ← Volver al inicio
            </a>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-gray-600">
          Descubre todos los servicios que ofrecemos en Elite Barbershop
        </p>

        {/* Servicios por categoría */}
        <div className="space-y-8">
          {Object.entries(servicesByCategory).map(
            ([category, categoryServices]) => (
              <div key={category}>
                <h2 className="mb-4 text-2xl font-bold capitalize text-gray-900">
                  {category}
                </h2>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {categoryServices.map((service) => (
                    <div
                      key={service.id}
                      className="overflow-hidden rounded-lg bg-white shadow-md transition hover:shadow-lg"
                    >
                      <div className="p-6">
                        <div className="mb-3 flex items-start justify-between">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {service.name}
                          </h3>
                          <span className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(service.price)}
                          </span>
                        </div>

                        <p className="mb-4 text-sm text-gray-600">
                          {service.description}
                        </p>

                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center text-gray-500">
                            <svg
                              className="mr-1 h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {service.duration} min
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              service.category === "corte"
                                ? "bg-blue-100 text-blue-800"
                                : service.category === "barba"
                                  ? "bg-green-100 text-green-800"
                                  : service.category === "combo"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {service.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Si no hay servicios */}
        {services.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-lg text-gray-500">
              No hay servicios disponibles por el momento
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
