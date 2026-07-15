import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ProfessionalsPublicPage() {
  const professionals = await prisma.professional.findMany({
    where: {
      active: true,
    },
    include: {
      user: {
        select: {
          name: true,
          image: true,
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
    orderBy: {
      rating: "desc",
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Nuestros Profesionales
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Conoce a nuestro equipo de profesionales expertos
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {professionals.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-lg text-gray-600">
              No hay profesionales disponibles en este momento
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {professionals.map((professional) => (
              <Link
                key={professional.id}
                href={`/profesionales/${professional.id}`}
                className="group overflow-hidden rounded-lg bg-white shadow-lg transition-all hover:shadow-2xl"
              >
                {/* Imagen */}
                <div className="relative h-64 overflow-hidden bg-gray-200">
                  {professional?.user.image ? (
                    <img
                      src={professional?.user.image}
                      alt={professional?.user.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                      <span className="text-6xl font-bold text-white">
                        {professional?.user.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-2xl font-bold text-white">
                      {professional?.user.name}
                    </h3>
                  </div>
                </div>

                {/* Info */}
                <div className="p-6">
                  {/* Rating */}
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`h-5 w-5 ${
                            i < Math.floor(professional?.rating)
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {professional?.rating.toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({professional._count.reviews} reseñas)
                    </span>
                  </div>

                  {/* Experiencia */}
                  <div className="mb-4 flex items-center gap-2 text-gray-600">
                    <svg
                      className="h-5 w-5"
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
                    <span className="text-sm">
                      {professional.yearsExp} años de experiencia
                    </span>
                  </div>

                  {/* Especialidades */}
                  {professional.specialties.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-gray-900">
                        Especialidades:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {professional.specialties
                          .slice(0, 3)
                          .map((specialty, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800"
                            >
                              {specialty}
                            </span>
                          ))}
                        {professional.specialties.length > 3 && (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                            +{professional.specialties.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bio preview */}
                  {professional.bio && (
                    <p className="mt-4 line-clamp-2 text-sm text-gray-600">
                      {professional.bio}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="mt-6">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
                      Ver perfil completo
                      <svg
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
