import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { BarberImage } from "@/components/shared/BarberImage";
import AdminCalendar from "@/components/dashboard/AdminCalendar";
import AutoRefresh from "@/components/shared/AutoRefresh";

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
      className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles]}`}
    >
      {labels[status as keyof typeof labels]}
    </span>
  );
};

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fechas
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  // Estadísticas generales
  const [
    totalUsers,
    totalBarbers,
    _totalServices,
    _totalAppointments,
    appointmentsToday,
    appointmentsThisMonth,
    completedThisMonth,
    cancelledThisMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.barber.count(),
    prisma.service.count(),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: {
        date: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: "COMPLETED",
      },
    }),
    prisma.appointment.count({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: "CANCELLED",
      },
    }),
  ]);

  // Ingresos del mes
  const completedAppointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      status: "COMPLETED",
    },
    include: {
      services: {
        include: {
          service: {
            select: {
              price: true,
            },
          },
        },
      },
    },
  });

  const monthlyRevenue = completedAppointments.reduce(
    (sum, apt) => sum + apt.services.reduce((s, as) => s + as.service.price, 0),
    0
  );

  // Tasa de cancelación
  const cancellationRate =
    appointmentsThisMonth > 0
      ? ((cancelledThisMonth / appointmentsThisMonth) * 100).toFixed(1)
      : 0;

  // Servicios más solicitados
  const allAppointmentServices = await prisma.appointmentService.findMany({
    where: {
      appointment: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  });

  // Agrupar servicios y contar
  const serviceCount = allAppointmentServices.reduce(
    (acc, as) => {
      const serviceId = as.service.id;
      if (!acc[serviceId]) {
        acc[serviceId] = {
          name: as.service.name,
          price: as.service.price,
          count: 0,
        };
      }
      acc[serviceId].count++;
      return acc;
    },
    {} as Record<string, { name: string; price: number; count: number }>
  );

  const topServicesWithDetails = Object.values(serviceCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top barberos
  const topBarbers = await prisma.appointment.groupBy({
    by: ["barberId"],
    _count: {
      barberId: true,
    },
    where: {
      status: "COMPLETED",
    },
    orderBy: {
      _count: {
        barberId: "desc",
      },
    },
    take: 5,
  });

  const topBarbersWithDetails = await Promise.all(
    topBarbers.map(async (item) => {
      const barber = await prisma.barber.findUnique({
        where: { id: item.barberId },
        include: {
          user: {
            select: { name: true, image: true },
          },
        },
      });
      return {
        name: barber?.user.name || "Desconocido",
        image: barber?.user.image || null,
        count: item._count.barberId,
        rating: barber?.rating || 0,
      };
    })
  );

  // Citas recientes
  const recentAppointments = await prisma.appointment.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        select: { name: true },
      },
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
            select: { name: true, price: true },
          },
        },
      },
    },
  });

  // Usuarios recientes
  const users = await prisma.user.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // Obtener citas del mes completo para el calendario
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  const monthAppointmentsRaw = await prisma.appointment.findMany({
    where: {
      date: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    },
    include: {
      client: {
        select: { name: true, email: true, phone: true },
      },
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
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // Mapear citas del mes con precios y duraciones totales
  const monthAppointments = monthAppointmentsRaw.map((apt) => {
    const services = apt.services.map((as) => as.service);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

    return {
      id: apt.id,
      date: apt.date,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      notes: apt.notes,
      barber: {
        id: apt.barber.id,
        user: {
          name: apt.barber.user.name,
        },
      },
      client: apt.client,
      services,
      totalPrice,
      totalDuration,
    };
  });

  // Obtener lista de barberos para el filtro
  const allBarbers = await prisma.barber.findMany({
    where: { active: true },
    include: {
      user: {
        select: { name: true, image: true },
      },
    },
    orderBy: {
      user: { name: "asc" },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Auto-refresh cada 30 segundos */}
      <AutoRefresh interval={30000} />

      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Panel de Administración
              </h1>
              <p className="mt-1 text-gray-600">Gestiona tu barbería</p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin/citas"
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Citas
              </Link>
              <Link
                href="/admin/barberos"
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Barberos
              </Link>
              <Link
                href="/admin/servicios"
                className="font-medium text-indigo-600 hover:text-indigo-800"
              >
                Servicios
              </Link>
              <Link
                href="/"
                className="font-medium text-gray-600 hover:text-gray-800"
              >
                ← Inicio
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Métricas principales */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Ingresos del mes */}
          <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-100">
                  Ingresos del Mes
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {formatCurrency(monthlyRevenue)}
                </p>
                <p className="mt-1 text-xs text-green-100">
                  {completedThisMonth} citas completadas
                </p>
              </div>
              <div className="rounded-lg bg-white bg-opacity-20 p-3">
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
            </div>
          </div>

          {/* Citas de hoy */}
          <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100">Citas Hoy</p>
                <p className="mt-2 text-3xl font-bold">{appointmentsToday}</p>
                <p className="mt-1 text-xs text-blue-100">
                  {appointmentsThisMonth} este mes
                </p>
              </div>
              <div className="rounded-lg bg-white bg-opacity-20 p-3">
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
            </div>
          </div>

          {/* Tasa de cancelación */}
          <div className="rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-100">
                  Tasa de Cancelación
                </p>
                <p className="mt-2 text-3xl font-bold">{cancellationRate}%</p>
                <p className="mt-1 text-xs text-purple-100">
                  {cancelledThisMonth} canceladas
                </p>
              </div>
              <div className="rounded-lg bg-white bg-opacity-20 p-3">
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Total usuarios */}
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100">Usuarios</p>
                <p className="mt-2 text-3xl font-bold">{totalUsers}</p>
                <p className="mt-1 text-xs text-indigo-100">
                  {totalBarbers} barberos
                </p>
              </div>
              <div className="rounded-lg bg-white bg-opacity-20 p-3">
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Calendario de Citas */}
        <div className="mb-8">
          <AdminCalendar
            appointments={monthAppointments}
            barbers={allBarbers}
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Servicios más solicitados */}
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Servicios Más Solicitados
              </h3>
            </div>
            <div className="p-6">
              {topServicesWithDetails.length > 0 ? (
                <div className="space-y-4">
                  {topServicesWithDetails.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 font-bold text-indigo-600">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {service.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(service.price)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {service.count}
                        </p>
                        <p className="text-xs text-gray-600">reservas</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-gray-600">
                  No hay datos disponibles
                </p>
              )}
            </div>
          </div>

          {/* Top barberos */}
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Top Barberos
              </h3>
            </div>
            <div className="p-6">
              {topBarbersWithDetails.length > 0 ? (
                <div className="space-y-4">
                  {topBarbersWithDetails.map((barber, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <BarberImage
                          image={barber.image}
                          name={barber.name}
                          size={40}
                        />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {barber.name}
                          </p>
                          <p className="text-sm text-yellow-600">
                            ★ {barber.rating.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {barber.count}
                        </p>
                        <p className="text-xs text-gray-600">completadas</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-gray-600">
                  No hay datos disponibles
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Citas recientes */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Citas Recientes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Barbero
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Servicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentAppointments.map((apt) => {
                  const services = apt.services.map((as) => as.service);
                  const totalPrice = services.reduce(
                    (sum, s) => sum + s.price,
                    0
                  );
                  return (
                    <tr key={apt.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {apt.client.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {apt.barber.user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {services.length === 1
                          ? services[0].name
                          : `${services.length} servicios`}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {new Date(apt.date).toLocaleDateString("es-ES")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {apt.startTime}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-green-600">
                        {formatCurrency(totalPrice)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {getStatusBadge(apt.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usuarios Recientes */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Usuarios Recientes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Fecha de Registro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          user.role === "ADMIN"
                            ? "bg-red-100 text-red-800"
                            : user.role === "BARBER"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString("es-ES")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
