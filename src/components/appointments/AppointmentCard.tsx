import Link from "next/link";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { ProfessionalImage } from "@/components/shared/ProfessionalImage";
import StatusBadge from "@/components/shared/StatusBadge";

export type ClientAppointment = {
  key: number;
  id: number;
  ids: number[];
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  professional: {
    user: {
      name: string;
      image: string | null;
    };
  };
  services: { name: string; duration: number; price: number }[];
  totalPrice: number;
  totalDuration: number;
  totalPoints: number;
  createdAt: Date;
  hasReview: boolean;
};

interface AppointmentCardProps {
  appointment: ClientAppointment;
}

export default function AppointmentCard({ appointment }: AppointmentCardProps) {
  const aptDate = new Date(appointment.date);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow transition-shadow hover:shadow-lg">
      <Link href={`/cliente/citas/${appointment.id}`} className="block">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <ProfessionalImage
              image={appointment.professional.user.image}
              name={appointment.professional.user.name}
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
                con {appointment.professional.user.name}
              </p>
            </div>
          </div>
          <StatusBadge
            status={appointment.status}
            className="rounded-full px-3 py-1 text-xs font-semibold"
          />
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
            {appointment.services.map((service, idx) => (
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
          <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
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
}
