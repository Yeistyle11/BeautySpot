import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BarberImage } from "@/components/shared/BarberImage";

export default async function BarberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const barber = await prisma.barber.findUnique({
    where: {
      id: parseInt(params.id),
      active: true,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
      services: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              duration: true,
              category: true,
            },
          },
        },
      },
      portfolio: {
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      reviews: {
        include: {
          client: {
            select: {
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      _count: {
        select: {
          appointments: true,
          reviews: true,
        },
      },
    },
  });

  if (!barber) {
    notFound();
  }

  // Agrupar servicios por categoría
  const servicesByCategory = barber.services.reduce(
    (acc, bs) => {
      const category = bs.service.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(bs.service);
      return acc;
    },
    {} as Record<string, any[]>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con imagen de fondo */}
      <div className="relative h-80 overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600">
        {barber.user.image && (
          <>
            <img
              src={barber.user.image}
              alt={barber.user.name}
              className="h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          </>
        )}
      </div>

      {/* Contenido principal */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Perfil card - superpuesto */}
        <div className="-mt-32 mb-8">
          <div className="rounded-lg bg-white p-8 shadow-xl">
            <div className="flex flex-col items-start gap-8 md:flex-row">
              {/* Foto del barbero */}
              <div className="flex-shrink-0">
                <BarberImage
                  image={barber.user.image}
                  name={barber.user.name}
                  size={160}
                  className="ring-8 ring-white"
                />
              </div>

              {/* Info principal */}
              <div className="flex-1">
                <div className="mb-4">
                  <h1 className="text-4xl font-bold text-gray-900">
                    {barber.user.name}
                  </h1>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`h-6 w-6 ${
                            i < Math.floor(barber.rating)
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
                    <span className="text-xl font-semibold text-gray-900">
                      {barber.rating.toFixed(1)}
                    </span>
                    <span className="text-gray-500">
                      ({barber._count.reviews} reseñas)
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-6 flex flex-wrap gap-6">
                  <div className="flex items-center gap-2 text-gray-600">
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
                    <span>
                      <strong>{barber.yearsExp}</strong> años de experiencia
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>
                      <strong>{barber._count.appointments}</strong> citas
                      completadas
                    </span>
                  </div>
                </div>

                {/* Especialidades */}
                {barber.specialties.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      Especialidades
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {barber.specialties.map((specialty, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-800"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bio */}
                {barber.bio && (
                  <div className="mb-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      Sobre mí
                    </h3>
                    <p className="text-gray-600">{barber.bio}</p>
                  </div>
                )}

                {/* CTA */}
                <Link
                  href="/citas/nueva"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
                >
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Agendar Cita
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Servicios */}
        <div className="mb-8 rounded-lg bg-white p-8 shadow">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Servicios</h2>
          {Object.keys(servicesByCategory).length === 0 ? (
            <p className="text-gray-600">
              Este barbero aún no tiene servicios asignados
            </p>
          ) : (
            <div className="space-y-8">
              {Object.entries(servicesByCategory).map(
                ([category, services]) => (
                  <div key={category}>
                    <h3 className="mb-4 text-lg font-semibold text-gray-800">
                      {category}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {services.map((service) => (
                        <div
                          key={service.id}
                          className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                        >
                          <h4 className="font-semibold text-gray-900">
                            {service.name}
                          </h4>
                          <p className="mt-1 text-sm text-gray-600">
                            {service.description}
                          </p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-lg font-bold text-indigo-600">
                              ${service.price.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500">
                              {service.duration} min
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Reseñas */}
        {barber.reviews.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-8 shadow">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">Reseñas</h2>
            <div className="space-y-6">
              {barber.reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                      {review.client.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">
                          {review.client.name}
                        </h4>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
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
                      </div>
                      {review.comment && (
                        <p className="text-gray-600">{review.comment}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
