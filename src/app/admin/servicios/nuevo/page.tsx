import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ServiceForm from "@/components/forms/ServiceForm";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

export default async function NewServicePage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Servicios", href: "/admin/servicios" },
              { label: "Nuevo" },
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Crear Nuevo Servicio
          </h1>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow">
          <ServiceForm mode="create" />
        </div>
      </main>
    </div>
  );
}
