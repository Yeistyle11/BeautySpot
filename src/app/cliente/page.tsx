import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDuration } from "@/lib/utils";
import AutoRefresh from "@/components/shared/AutoRefresh";

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "CLIENT") {
    redirect("/");
  }

  // Obtener las citas del cliente
  const allAppointments = await prisma.appointment.findMany({
    where: { clientId: parseInt(session.user.id) },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    include: {
      barber: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
      services: {
        include: {
          service: {
            select: { name: true, price: true, duration: true },
          },
        },
      },
    },
  });

  // Las citas ya vienen con múltiples servicios, solo mapear la estructura
  const groupedAppointments = allAppointments.map((apt) => {
    const services = apt.services.map((as) => as.service);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

    return {
      key: apt.id,
      id: apt.id,
      date: apt.date,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      barber: apt.barber,
      services,
      totalPrice,
      totalDuration,
      createdAt: apt.createdAt,
    };
  });

  // Tomar solo las 10 más recientes
  const appointments = groupedAppointments.slice(0, 10);

  // Estadísticas del cliente
  const totalAppointments = await prisma.appointment.count({
    where: { clientId: parseInt(session.user.id) },
  });

  const completedAppointments = await prisma.appointment.count({
    where: {
      clientId: parseInt(session.user.id),
      status: "COMPLETED",
    },
  });

  const pendingAppointments = await prisma.appointment.count({
    where: {
      clientId: parseInt(session.user.id),
      status: "PENDING",
    },
  });

  // Obtener usuario con puntos de lealtad
  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
    select: { loyaltyPoints: true },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Auto-refresh cada 30 segundos */}
      <AutoRefresh interval={30000} />

      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              👤 Mi Dashboard
            </h1>
            <a href="/" className="text-indigo-600 hover:text-indigo-800">
              ← Volver al inicio
            </a>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Bienvenida */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">
            Bienvenido, {session.user.name}
          </h2>
          <p className="text-gray-600">
            Gestiona tus citas y revisa tu historial
          </p>
        </div>

        {/* Tarjetas de Estadísticas */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <a
            href="/cliente/citas"
            className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
          >
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
                <p className="text-sm text-gray-600">Total Citas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalAppointments}
                </p>
              </div>
            </div>
          </a>

          <a
            href="/cliente/citas?filter=completed"
            className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
          >
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {completedAppointments}
                </p>
              </div>
            </div>
          </a>

          <a
            href="/cliente/citas?filter=pending"
            className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
          >
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingAppointments}
                </p>
              </div>
            </div>
          </a>

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
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Puntos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {user?.loyaltyPoints || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botón para agendar cita */}
        <div className="mb-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="mb-2 text-xl font-bold">
                ¿Listo para tu próximo corte?
              </h3>
              <p className="text-indigo-100">
                Agenda tu cita con nuestros barberos expertos
              </p>
            </div>
            <a
              href="/citas/nueva"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              Agendar Cita
            </a>
          </div>
        </div>

        {/* Historial de Citas */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Historial de Citas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    #ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Barbero
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Servicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {appointments.length > 0 ? (
                  appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                        #{appointment.id.toString().padStart(4, "0")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {new Date(appointment.date).toLocaleDateString(
                          "es-ES",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {appointment.barber.user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {appointment.services.length === 1 ? (
                          appointment.services[0].name
                        ) : (
                          <div>
                            <div className="font-medium">
                              {appointment.services.length} servicios:
                            </div>
                            {appointment.services.map((s: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                • {s.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDuration(appointment.totalDuration)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-green-600">
                        {formatCurrency(appointment.totalPrice)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            appointment.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : appointment.status === "CONFIRMED"
                                ? "bg-blue-100 text-blue-800"
                                : appointment.status === "CANCELLED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {appointment.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="text-gray-500">
                        <p className="mb-2 text-lg font-medium">
                          No tienes citas aún
                        </p>
                        <p className="text-sm">
                          ¡Agenda tu primera cita para comenzar!
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
