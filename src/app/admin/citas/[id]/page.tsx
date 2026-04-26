import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { BarberImage } from "@/components/shared/BarberImage";
import AppointmentActions from "@/components/admin/AppointmentActions";

export default async function AdminAppointmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const appointment = await prisma.appointment.findUnique({
    where: {
      id: parseInt(params.id),
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          loyaltyPoints: true,
        },
      },
      barber: {
        include: {
          user: {
            select: {
              name: true,
              image: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      services: {
        include: {
          service: true,
        },
      },
    },
  });

  if (!appointment) {
    notFound();
  }

  const services = appointment.services.map((as) => as.service);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      CONFIRMED: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
      NO_SHOW: "bg-gray-100 text-gray-800",
    };
    const labels = {
      PENDING: "Pendiente",
      CONFIRMED: "Confirmada",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
      NO_SHOW: "No asistió",
    };
    return (
      <span
        className={`rounded-full px-4 py-2 text-sm font-semibold ${
          styles[status as keyof typeof styles]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const canModify =
    appointment.status === "PENDING" || appointment.status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/citas"
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
                Volver a Citas
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Detalle de Cita
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Cita #{appointment.id.toString().padStart(4, "0")}
                </p>
              </div>
            </div>
            {getStatusBadge(appointment.status)}
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna principal */}
          <div className="space-y-6 lg:col-span-2">
            {/* Información del Cliente */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Cliente
                </h2>
              </div>
              <div className="space-y-3 p-6">
                <div>
                  <p className="text-sm text-gray-600">Nombre</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {appointment.client.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-gray-900">{appointment.client.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Teléfono</p>
                    <p className="text-gray-900">
                      {appointment.client.phone || "No disponible"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Puntos de Fidelidad</p>
                  <p className="text-lg font-semibold text-indigo-600">
                    {appointment.client.loyaltyPoints}
                  </p>
                </div>
              </div>
            </div>

            {/* Información del Barbero */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Barbero
                </h2>
              </div>
              <div className="p-6">
                <div className="mb-4 flex items-center gap-4">
                  <BarberImage
                    image={appointment.barber.user.image}
                    name={appointment.barber.user.name}
                    size={64}
                  />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {appointment.barber.user.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {appointment.barber.user.email}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Teléfono</p>
                    <p className="text-gray-900">
                      {appointment.barber.user.phone || "No disponible"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Calificación</p>
                    <p className="flex items-center gap-1 text-gray-900">
                      <svg
                        className="h-5 w-5 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {appointment.barber.rating}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Servicios */}
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Servicios Solicitados
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between border-b border-gray-200 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {service.name}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {service.description}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                          {formatDuration(service.duration)}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(service.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t-2 border-gray-300 pt-4">
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-green-600">
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                    <span>Duración total</span>
                    <span>{formatDuration(totalDuration)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna lateral */}
          <div className="space-y-6">
            {/* Fecha y Hora */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Fecha y Hora
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <svg
                    className="h-6 w-6 text-indigo-600"
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
                  <div>
                    <p className="text-sm text-gray-600">Fecha</p>
                    <p className="font-semibold">
                      {new Date(appointment.date).toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <svg
                    className="h-6 w-6 text-indigo-600"
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
                  <div>
                    <p className="text-sm text-gray-600">Horario</p>
                    <p className="font-semibold">
                      {appointment.startTime} - {appointment.endTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Puntos de Fidelidad */}
            {appointment.pointsEarned > 0 && (
              <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow">
                <div className="mb-2 flex items-center gap-3">
                  <svg
                    className="h-6 w-6 text-purple-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-purple-900">
                    Puntos Ganados
                  </h3>
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  +{appointment.pointsEarned}
                </p>
              </div>
            )}

            {/* Notas */}
            {appointment.notes && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 shadow">
                <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <svg
                    className="h-5 w-5 text-yellow-600"
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
                  Notas
                </h3>
                <p className="text-gray-700">{appointment.notes}</p>
              </div>
            )}

            {/* Motivo de cancelación */}
            {appointment.cancelReason && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow">
                <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <svg
                    className="h-5 w-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Motivo de Cancelación
                </h3>
                <p className="text-gray-700">{appointment.cancelReason}</p>
              </div>
            )}

            {/* Acciones */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Acciones
              </h3>
              <AppointmentActions
                appointmentId={appointment.id}
                status={appointment.status}
                canModify={canModify}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
