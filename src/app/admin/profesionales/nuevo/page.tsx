import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfessionalForm from "@/components/forms/ProfessionalForm";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

export default async function NewProfessionalPage() {
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
              { label: "Profesionales", href: "/admin/profesionales" },
              { label: "Nuevo" },
            ]}
          />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Crear Nuevo Profesional
          </h1>
          <p className="mt-1 text-gray-600">
            Completa la información para registrar un nuevo profesional en el
            sistema
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <ProfessionalForm mode="create" />
      </main>
    </div>
  );
}
