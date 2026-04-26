import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BarberForm from "@/components/forms/BarberForm";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

export default async function NewBarberPage() {
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
              { label: "Barberos", href: "/admin/barberos" },
              { label: "Nuevo" },
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Crear Nuevo Barbero
          </h1>
          <p className="mt-1 text-gray-600">
            Completa la información para registrar un nuevo barbero en el
            sistema
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <BarberForm mode="create" />
      </main>
    </div>
  );
}
