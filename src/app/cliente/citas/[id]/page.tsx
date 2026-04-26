import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { BarberImage } from "@/components/shared/BarberImage";
import CancelAppointmentButton from "@/components/appointments/CancelAppointmentButton";

export default async function AppointmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const appointment = await prisma.appointment.findUnique({
    where: {
      id: parseInt(params.id),
      clientId: parseInt(session.user.id), // Solo puede ver sus propias citas
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
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Cita no encontrada
          </h2>
          <p className="mb-4 text-gray-600">
            No se pudo encontrar la cita solicitada
          </p>
          <Link
            href="/cliente/citas"
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Volver a mis citas
          </Link>
        </div>
      </div>
    );
  }

  const services = appointment.services.map((as) => as.service);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

  const aptDate = new Date(appointment.date);
  const now = new Date();
  const canCancel =
    (appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
    aptDate > now;

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
      NO_SHOW: "No se presentó",
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/cliente/citas"
            className="mb-2 inline-block font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Volver a mis citas
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Detalle de Cita
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Cita #{appointment.id.toString().padStart(4, "0")}
              </p>
            </div>
            {getStatusBadge(appointment.status)}
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg bg-white shadow-lg">
          {/* Información del Barbero */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-8">
            <div className="flex items-center gap-4">
              <BarberImage
                image={appointment.barber.user.image}
                name={appointment.barber.user.name}
                size={80}
                className="ring-4 ring-white"
              />
              <div className="text-white">
                <h2 className="text-2xl font-bold">
                  {appointment.barber.user.name}
                </h2>
                <p className="text-indigo-100">Barbero profesional</p>
                {appointment.barber.user.phone && (
                  <p className="mt-1 text-indigo-100">
                    📞 {appointment.barber.user.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Información de la Cita */}
          <div className="space-y-6 p-6">
            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-3">
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
                  <span className="text-sm font-medium text-gray-600">
                    Fecha
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {aptDate.toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-3">
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
                  <span className="text-sm font-medium text-gray-600">
                    Horario
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {appointment.startTime} - {appointment.endTime}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Duración total: {formatDuration(totalDuration)}
                </p>
              </div>
            </div>

            {/* Servicios */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <svg
                  className="h-5 w-5 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Servicios ({services.length})
              </h3>
              <div className="space-y-3">
                {services.map((service, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {service.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {service.description}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Duración: {formatDuration(service.duration)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-indigo-600">
                        {formatCurrency(service.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total a pagar</p>
                  <p className="text-xs text-gray-500">
                    {services.length} servicio{services.length > 1 ? "s" : ""} •{" "}
                    {formatDuration(totalDuration)}
                  </p>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(totalPrice)}
                </p>
              </div>
            </div>

            {/* Puntos de Lealtad */}
            {appointment.pointsEarned > 0 && (
              <div className="rounded-lg bg-indigo-50 p-4">
                <div className="flex items-center gap-3">
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
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-indigo-900">
                      +{appointment.pointsEarned} puntos de lealtad
                    </p>
                    <p className="text-sm text-indigo-700">
                      Ganados con esta cita
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notas */}
            {appointment.notes && (
              <div className="rounded-lg bg-yellow-50 p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-yellow-900">
                      Notas adicionales
                    </p>
                    <p className="mt-1 text-sm text-yellow-800">
                      {appointment.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Razón de cancelación */}
            {appointment.cancelReason && (
              <div className="rounded-lg bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 text-red-600"
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
                  <div>
                    <p className="font-medium text-red-900">
                      Razón de cancelación
                    </p>
                    <p className="mt-1 text-sm text-red-800">
                      {appointment.cancelReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Acciones */}
            {canCancel && (
              <div className="flex gap-4 border-t border-gray-200 pt-4">
                <Link
                  href={`/cliente/citas/${appointment.id}/reagendar`}
                  className="flex-1 rounded-lg bg-indigo-600 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  📅 Reagendar Cita
                </Link>
                <CancelAppointmentButton appointmentId={appointment.id} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
