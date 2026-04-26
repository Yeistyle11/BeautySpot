import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import BarberAppointments from "@/components/dashboard/BarberAppointments";
import BarberCalendar from "@/components/dashboard/BarberCalendar";
import AutoRefresh from "@/components/shared/AutoRefresh";
import LastUpdateIndicator from "@/components/shared/LastUpdateIndicator";

export default async function BarberDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "BARBER") {
    redirect("/");
  }

  // Buscar el perfil de barbero del usuario
  const barber = await prisma.barber.findUnique({
    where: { userId: parseInt(session.user.id) },
  });

  if (!barber) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error</h2>
          <p className="text-gray-600">No se encontró el perfil de barbero</p>
        </div>
      </div>
    );
  }

  // Obtener fecha actual
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Citas de hoy
  const todayAppointmentsRaw = await prisma.appointment.findMany({
    where: {
      barberId: barber.id,
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      client: {
        select: { name: true, email: true, phone: true },
      },
      services: {
        include: {
          service: {
            select: { name: true, price: true, duration: true },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // Mapear citas de hoy con sus múltiples servicios
  const todayAppointments = todayAppointmentsRaw.map((apt) => {
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
      client: apt.client,
      services,
      totalPrice,
      totalDuration,
    };
  });

  // Citas próximas (siguientes 7 días)
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const upcomingAppointmentsRaw = await prisma.appointment.findMany({
    where: {
      barberId: barber.id,
      date: {
        gte: tomorrow,
        lt: nextWeek,
      },
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
    },
    include: {
      client: {
        select: { name: true, email: true, phone: true },
      },
      services: {
        include: {
          service: {
            select: { name: true, price: true, duration: true },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // Mapear citas próximas con sus múltiples servicios
  const upcomingAppointments = upcomingAppointmentsRaw.map((apt) => {
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
      client: apt.client,
      services,
      totalPrice,
      totalDuration,
    };
  });

  // Calcular ingresos del día usando las citas agrupadas
  const todayEarnings = todayAppointments
    .filter((apt) => apt.status === "COMPLETED")
    .reduce((sum, apt) => sum + apt.totalPrice, 0);

  // Obtener citas del mes completo para el calendario
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  const monthAppointmentsRaw = await prisma.appointment.findMany({
    where: {
      barberId: barber.id,
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    },
    include: {
      client: {
        select: { name: true, email: true, phone: true },
      },
      services: {
        include: {
          service: {
            select: { name: true, price: true, duration: true },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // Mapear citas del mes
  const monthAppointments = monthAppointmentsRaw.map((apt) => {
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
      client: apt.client,
      services,
      totalPrice,
      totalDuration,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Auto-refresh cada 30 segundos */}
      <AutoRefresh interval={30000} />

      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Dashboard Barbero
              </h1>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <p className="text-sm text-gray-600 sm:text-base">
                  {today.toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <LastUpdateIndicator />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <form action="/barbero" method="GET">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 sm:px-4 sm:text-base"
                  title="Actualizar citas"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </form>
              <a
                href="/barbero/disponibilidad"
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700 sm:px-4 sm:text-base"
              >
                <svg
                  className="h-4 w-4"
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
                <span className="hidden sm:inline">Disponibilidad</span>
              </a>
              <a
                href="/barbero/bloqueos"
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700 sm:px-4 sm:text-base"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                <span className="hidden sm:inline">Bloqueos</span>
              </a>
              <a
                href="/barbero/perfil/editar"
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700 sm:px-4 sm:text-base"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span className="hidden sm:inline">Editar Perfil</span>
              </a>
              <a
                href="/"
                className="rounded-lg bg-gray-600 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-700 sm:px-4 sm:text-base"
              >
                <span className="sm:hidden">Inicio</span>
                <span className="hidden sm:inline">← Inicio</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Bienvenida */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">
            Hola, {session.user.name}
          </h2>
          <p className="text-gray-600">
            Gestiona tus citas y revisa tu agenda del día
          </p>
        </div>

        {/* Tarjetas de Estadísticas del Día */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                <svg
                  className="h-8 w-8"
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
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Citas Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {todayAppointments.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-full bg-green-100 p-3 text-green-600">
                <svg
                  className="h-8 w-8"
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
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Ingresos Hoy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(todayEarnings)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-full bg-purple-100 p-3 text-purple-600">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Próximas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {upcomingAppointments.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center">
              <div className="rounded-full bg-yellow-100 p-3 text-yellow-600">
                <svg
                  className="h-8 w-8"
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
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Rating</p>
                <p className="text-2xl font-bold text-gray-900">
                  {barber.rating.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Componente de Citas con Auto-refresh */}
        <BarberAppointments
          barberId={barber.id}
          initialTodayAppointments={todayAppointments}
          initialUpcomingAppointments={upcomingAppointments}
        />

        {/* Calendario del Mes */}
        <div className="mt-8">
          <BarberCalendar appointments={monthAppointments} />
        </div>
      </main>
    </div>
  );
}
