import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ServiceForm from "@/components/forms/ServiceForm";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

type Props = {
  params: {
    id: string;
  };
};

export default async function EditServicePage({ params }: Props) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const service = await prisma.service.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!service) {
    redirect("/admin/servicios");
  }

  // Convertir a formato del formulario
  const initialData = {
    name: service.name,
    description: service.description,
    price: service.price.toString(),
    duration: service.duration.toString(),
    category: service.category,
    active: service.active,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Servicios", href: "/admin/servicios" },
              { label: service.name, href: `/admin/servicios/${service.id}` },
              { label: "Editar" },
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Editar Servicio: {service.name}
          </h1>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow">
          <ServiceForm
            mode="edit"
            serviceId={service.id}
            initialData={initialData}
          />
        </div>
      </main>
    </div>
  );
}
