import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppointmentCard from "@/components/appointments/AppointmentCard";

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
      professional: {
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
      professional: apt.professional,
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
