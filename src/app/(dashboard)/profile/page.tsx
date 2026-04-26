import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/forms/ProfileForm";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Obtener datos completos del usuario
  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg bg-white shadow">
          <div className="px-6 py-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="mb-8 text-gray-600">
              Gestiona tu información personal
            </p>

            <ProfileForm user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}
