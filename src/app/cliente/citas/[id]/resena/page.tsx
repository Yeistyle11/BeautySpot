import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/forms/ReviewForm";

export default async function CreateReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "CLIENT") {
    redirect("/login");
  }

  const appointment = await prisma.appointment.findUnique({
    where: {
      id: parseInt(params.id),
      clientId: session.user.id,
    },
    include: {
      barber: {
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
        },
      },
      services: {
        include: {
          service: {
            select: {
              name: true,
            },
          },
        },
      },
      review: true,
    },
  });

  if (!appointment) {
    notFound();
  }

  // Solo se pueden dejar reseñas en citas completadas
  if (appointment.status !== "COMPLETED") {
    redirect("/cliente/citas");
  }

  // Si ya tiene reseña, redirigir
  if (appointment.review) {
    redirect("/cliente/citas");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dejar Reseña</h1>
          <p className="mt-2 text-gray-600">
            Comparte tu experiencia con otros clientes
          </p>
        </div>

        {/* Info de la cita */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 to-purple-600">
              {appointment.barber.user.image ? (
                <img
                  src={appointment.barber.user.image}
                  alt={appointment.barber.user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                  {appointment.barber.user.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {appointment.barber.user.name}
              </h2>
              <p className="text-sm text-gray-600">
                {new Date(appointment.date).toLocaleDateString("es-ES", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                - {appointment.startTime}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {appointment.services.map((as) => (
                  <span
                    key={as.id}
                    className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
                  >
                    {as.service.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de reseña */}
        <ReviewForm
          appointmentId={appointment.id}
          barberId={appointment.barberId}
        />
      </div>
    </div>
  );
}
