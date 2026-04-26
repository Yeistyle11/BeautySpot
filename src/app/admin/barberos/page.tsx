import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BarberImage } from "@/components/shared/BarberImage";
import BarberActions from "@/components/admin/BarberActions";

export default async function BarbersManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Obtener todos los barberos con estadísticas
  const barbers = await prisma.barber.findMany({
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
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          appointments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calcular estadísticas para cada barbero
  const barbersWithStats = await Promise.all(
    barbers.map(async (barber) => {
      const completedAppointments = await prisma.appointment.count({
        where: {
          barberId: barber.id,
          status: "COMPLETED",
        },
      });

      const totalRevenue = await prisma.appointment.aggregate({
        where: {
          barberId: barber.id,
          status: "COMPLETED",
        },
        _sum: {
          pointsEarned: true,
        },
      });

      // Citas del mes actual
      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );
      const endOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      );

      const monthlyAppointments = await prisma.appointment.count({
        where: {
          barberId: barber.id,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: {
            in: ["COMPLETED", "CONFIRMED", "PENDING"],
          },
        },
      });

      return {
        ...barber,
        stats: {
          completed: completedAppointments,
          totalRevenue: totalRevenue._sum.pointsEarned || 0,
          monthlyAppointments,
        },
      };
    })
  );

  // Usuarios que son barberos pero no tienen perfil de barbero
  const barberUsers = await prisma.user.findMany({
    where: {
      role: "BARBER",
      barber: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Barberos
              </h1>
              <p className="mt-1 text-gray-600">
                Administra los barberos y sus servicios
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin/barberos/nuevo"
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Crear Barbero
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
        {/* Alerta si hay usuarios barberos sin perfil */}
        {barberUsers.length > 0 && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-6 w-6 flex-shrink-0 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-800">
                  Usuarios barberos sin perfil
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Los siguientes usuarios tienen rol de barbero pero no tienen
                  un perfil de barbero creado:
                </p>
                <ul className="mt-2 space-y-1">
                  {barberUsers.map((user) => (
                    <li key={user.id} className="text-sm text-yellow-700">
                      • {user.name} ({user.email})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Resumen */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-indigo-100 p-3">
                <svg
                  className="h-8 w-8 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Barberos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {barbers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <svg
                  className="h-8 w-8 text-green-600"
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
              <div>
                <p className="text-sm text-gray-600">Barberos Activos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {barbers.filter((b) => b.active).length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-yellow-100 p-3">
                <svg
                  className="h-8 w-8 text-yellow-600"
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
              <div>
                <p className="text-sm text-gray-600">Rating Promedio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {barbers.length > 0
                    ? (
                        barbers.reduce((sum, b) => sum + b.rating, 0) /
                        barbers.length
                      ).toFixed(1)
                    : "0.0"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de barberos */}
        {barbersWithStats.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-4 text-lg text-gray-600">
              No hay barberos registrados
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Los usuarios con rol BARBER aparecerán aquí automáticamente
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {barbersWithStats.map((barber) => (
              <div
                key={barber.id}
                className="rounded-lg bg-white shadow transition-shadow hover:shadow-lg"
              >
                {/* Header con foto */}
                <div className="border-b border-gray-200 p-6">
                  <div className="flex items-start gap-4">
                    <BarberImage
                      image={barber.user.image}
                      name={barber.user.name}
                      size={64}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-gray-900">
                        {barber.user.name}
                      </h3>
                      <p className="truncate text-sm text-gray-600">
                        {barber.user.email}
                      </p>
                      {barber.user.phone && (
                        <p className="text-sm text-gray-600">
                          {barber.user.phone}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-yellow-500">★</span>
                        <span className="font-semibold text-gray-900">
                          {barber.rating.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({barber.yearsExp} años exp.)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        barber.active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {barber.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>

                {/* Estadísticas */}
                <div className="bg-gray-50 p-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {barber._count.appointments}
                      </p>
                      <p className="text-xs text-gray-600">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {barber.stats.completed}
                      </p>
                      <p className="text-xs text-gray-600">Completadas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-indigo-600">
                        {barber.stats.monthlyAppointments}
                      </p>
                      <p className="text-xs text-gray-600">Este mes</p>
                    </div>
                  </div>
                </div>

                {/* Servicios */}
                <div className="border-t border-gray-200 p-6">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Servicios ({barber.services.length})
                    </h4>
                    <Link
                      href="/admin/barberos/servicios"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Gestionar →
                    </Link>
                  </div>
                  {barber.services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {barber.services.slice(0, 3).map((bs) => (
                        <span
                          key={bs.id}
                          className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                        >
                          {bs.service.name}
                        </span>
                      ))}
                      {barber.services.length > 3 && (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          +{barber.services.length - 3} más
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Sin servicios asignados
                    </p>
                  )}
                </div>

                {/* Especialidades */}
                {barber.specialties.length > 0 && (
                  <div className="px-6 pb-6">
                    <h4 className="mb-2 text-sm font-semibold text-gray-700">
                      Especialidades
                    </h4>
                    <p className="text-sm text-gray-600">
                      {barber.specialties.join(", ")}
                    </p>
                  </div>
                )}

                {/* Bio */}
                {barber.bio && (
                  <div className="px-6 pb-6">
                    <h4 className="mb-2 text-sm font-semibold text-gray-700">
                      Biografía
                    </h4>
                    <p className="line-clamp-3 text-sm text-gray-600">
                      {barber.bio}
                    </p>
                  </div>
                )}

                {/* Acciones */}
                <div className="space-y-3 border-t border-gray-200 px-6 pb-6 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/admin/barberos/${barber.id}/disponibilidad`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700"
                      title="Gestionar disponibilidad"
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
                      Disponibilidad
                    </Link>
                    <Link
                      href={`/admin/barberos/${barber.id}/bloqueos`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                      title="Gestionar bloqueos"
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
                      Bloqueos
                    </Link>
                  </div>
                  <Link
                    href={`/admin/barberos/${barber.id}/editar`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
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
                    Editar Perfil
                  </Link>
                  <BarberActions
                    barberId={barber.id}
                    barberName={barber.user.name}
                    isActive={barber.active}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
