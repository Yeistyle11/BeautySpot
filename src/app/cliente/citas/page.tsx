import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { BarberImage } from "@/components/shared/BarberImage";

export default async function ClientAppointmentsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const filter = searchParams.filter;

  // Obtener todas las citas del cliente
  const appointments = await prisma.appointment.findMany({
    where: {
      clientId: parseInt(session.user.id),
    },
    include: {
      services: {
        include: {
          service: true,
        },
      },
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
      review: true,
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });

  // Las citas ya vienen con múltiples servicios desde la BD, solo necesitamos mapear la estructura
  const groupedAppointments = appointments.map((apt) => {
    const services = apt.services.map((as) => as.service);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

    return {
      key: apt.id,
      id: apt.id,
      ids: [apt.id],
      date: apt.date,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      notes: apt.notes,
      barber: apt.barber,
      services,
      totalPrice,
      totalDuration,
      totalPoints: apt.pointsEarned,
      createdAt: apt.createdAt,
      hasReview: !!apt.review,
    };
  });

  // Separar citas por estado
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const upcoming = groupedAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    const aptDateOnly = new Date(
      aptDate.getFullYear(),
      aptDate.getMonth(),
      aptDate.getDate()
    );

    return (
      (apt.status === "PENDING" || apt.status === "CONFIRMED") &&
      aptDateOnly >= today
    );
  });

  const past = groupedAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    const aptDateOnly = new Date(
      aptDate.getFullYear(),
      aptDate.getMonth(),
      aptDate.getDate()
    );

    return (
      apt.status === "COMPLETED" ||
      apt.status === "NO_SHOW" ||
      (aptDateOnly < today && apt.status !== "CANCELLED")
    );
  });

  const cancelled = groupedAppointments.filter(
    (apt) => apt.status === "CANCELLED"
  );

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      CONFIRMED: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    const labels = {
      PENDING: "Pendiente",
      CONFIRMED: "Confirmada",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
    };
    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          styles[status as keyof typeof styles]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const AppointmentCard = ({ appointment }: { appointment: any }) => {
    const aptDate = new Date(appointment.date);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow transition-shadow hover:shadow-lg">
        <Link
          href={`/cliente/citas/${appointment.id}`}
          className="block"
        >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <BarberImage
              image={appointment.barber.user.image}
              name={appointment.barber.user.name}
              size={48}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">
                  {appointment.services.length === 1
                    ? appointment.services[0].name
                    : `${appointment.services.length} servicios`}
                </h3>
                <span className="text-xs text-gray-500">
                  #{appointment.id.toString().padStart(4, "0")}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                con {appointment.barber.user.name}
              </p>
            </div>
          </div>
          {getStatusBadge(appointment.status)}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <svg
              className="mr-2 h-5 w-5"
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
            {aptDate.toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="flex items-center text-gray-600">
            <svg
              className="mr-2 h-5 w-5"
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
            {appointment.startTime} - {appointment.endTime}
          </div>

          {/* Lista de servicios */}
          <div className="space-y-1 pl-7">
            {appointment.services.map((service: any, idx: number) => (
              <div key={idx} className="text-sm text-gray-600">
                • {service.name} ({service.duration} min)
              </div>
            ))}
          </div>

          <div className="flex items-center text-gray-600">
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatCurrency(appointment.totalPrice)} •{" "}
            {formatDuration(appointment.totalDuration)}
          </div>
          {appointment.totalPoints > 0 && (
            <div className="flex items-center text-indigo-600">
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              +{appointment.totalPoints} puntos ganados
            </div>
          )}
        </div>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-center text-sm text-gray-500">
              Haz clic para ver más detalles →
            </p>
          </div>
        </Link>
        
        {/* Botón de reseña fuera del Link */}
        {appointment.status === "COMPLETED" && !appointment.hasReview && (
          <div className="mt-4">
            <Link
              href={`/cliente/citas/${appointment.id}/resena`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-700"
            >
              <svg
                className="mr-2 h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Dejar Reseña
            </Link>
          </div>
        )}
        
        {appointment.status === "COMPLETED" && appointment.hasReview && (
          <div className="mt-4 flex items-center justify-center text-sm text-green-600">
            <svg
              className="mr-1 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Reseña publicada
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/cliente"
                className="flex items-center text-gray-600 transition-colors hover:text-gray-900"
              >
                <svg
                  className="mr-1 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Volver
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Mis Citas</h1>
            </div>
            <Link
              href="/citas/nueva"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
            >
              + Nueva Cita
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filtros */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/cliente/citas"
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              !filter
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Todas
          </Link>
          <Link
            href="/cliente/citas?filter=pending"
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "pending"
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Pendientes ({upcoming.length})
          </Link>
          <Link
            href="/cliente/citas?filter=completed"
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "completed"
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Completadas ({past.filter((a) => a.status === "COMPLETED").length})
          </Link>
          <Link
            href="/cliente/citas?filter=cancelled"
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              filter === "cancelled"
                ? "bg-indigo-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Canceladas ({cancelled.length})
          </Link>
        </div>

        {/* Mostrar según filtro */}
        {!filter && (
          <>
            {/* Próximas Citas */}
            <section className="mb-12">
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Próximas Citas ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow">
                  <p className="mb-4 text-gray-600">No tienes citas próximas</p>
                  <Link
                    href="/citas/nueva"
                    className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
                  >
                    Agendar Primera Cita
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Historial */}
            {past.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-6 text-2xl font-bold text-gray-900">
                  Historial ({past.length})
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {past.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Canceladas */}
            {cancelled.length > 0 && (
              <section>
                <h2 className="mb-6 text-2xl font-bold text-gray-900">
                  Canceladas ({cancelled.length})
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {cancelled.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Filtro: Pendientes */}
        {filter === "pending" && (
          <section>
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              Citas Pendientes ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <div className="rounded-lg bg-white p-8 text-center shadow">
                <p className="mb-4 text-gray-600">No tienes citas pendientes</p>
                <Link
                  href="/citas/nueva"
                  className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
                >
                  Agendar Cita
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Filtro: Completadas */}
        {filter === "completed" && (
          <section>
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              Citas Completadas (
              {past.filter((a) => a.status === "COMPLETED").length})
            </h2>
            {past.filter((a) => a.status === "COMPLETED").length === 0 ? (
              <div className="rounded-lg bg-white p-8 text-center shadow">
                <p className="text-gray-600">No tienes citas completadas</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {past
                  .filter((a) => a.status === "COMPLETED")
                  .map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
              </div>
            )}
          </section>
        )}

        {/* Filtro: Canceladas */}
        {filter === "cancelled" && (
          <section>
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              Citas Canceladas ({cancelled.length})
            </h2>
            {cancelled.length === 0 ? (
              <div className="rounded-lg bg-white p-8 text-center shadow">
                <p className="text-gray-600">No tienes citas canceladas</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {cancelled.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
