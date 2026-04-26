import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditAppointmentForm from "@/components/admin/EditAppointmentForm";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

export default async function EditAppointmentPage({
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
        },
      },
      barber: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
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

  // Solo se pueden editar citas pendientes o confirmadas
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    redirect(`/admin/citas/${params.id}`);
  }

  // Obtener todos los barberos disponibles
  const barbers = await prisma.barber.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  // Obtener todos los servicios disponibles
  const services = await prisma.service.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Citas", href: "/admin/citas" },
              { label: `Cita #${appointment.id.toString().padStart(4, "0")}`, href: `/admin/citas/${appointment.id}` },
              { label: "Editar" },
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Editar Cita #{appointment.id.toString().padStart(4, "0")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Cliente: {appointment.client.name}
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <EditAppointmentForm
          appointment={appointment}
          barbers={barbers}
          services={services}
        />
      </main>
    </div>
  );
}
