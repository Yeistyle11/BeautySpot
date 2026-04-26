"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface BarberFormProps {
  mode: "create" | "edit";
  initialData?: {
    id?: string | number;
    name: string;
    email: string;
    phone?: string;
    bio?: string;
    specialties?: string[];
    yearsExp?: number;
    image?: string;
  };
}

export default function BarberForm({ mode, initialData }: BarberFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    password: "",
    confirmPassword: "",
    bio: initialData?.bio || "",
    specialties: initialData?.specialties?.join(", ") || "",
    yearsExp: initialData?.yearsExp || 0,
    image: initialData?.image || "",
  });

  const [imagePreview, setImagePreview] = useState<string>(
    initialData?.image || ""
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "yearsExp") {
      const numValue = parseInt(value) || 0;
      setFormData((prev) => ({ ...prev, [name]: numValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("La imagen debe ser menor a 2MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Solo se permiten imágenes");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setFormData((prev) => ({ ...prev, image: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validar contraseña
    if (mode === "create") {
      if (!formData.password || formData.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }
    } else if (mode === "edit" && formData.password) {
      // En modo edición, solo validar si se ingresó una contraseña
      if (formData.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }
    }

    setLoading(true);

    try {
      const specialtiesArray = formData.specialties
        ? formData.specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        bio: formData.bio || undefined,
        specialties: specialtiesArray,
        yearsExp: formData.yearsExp,
        image: formData.image || undefined,
      };

      // Solo incluir contraseña si se ingresó
      if (formData.password) {
        payload.password = formData.password;
      }

      const url =
        mode === "create" ? "/api/barbers" : `/api/barbers/${initialData?.id}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Error al ${mode === "create" ? "crear" : "actualizar"} el barbero`
        );
      }

      // Redirigir según el rol
      const redirectUrl =
        session?.user?.role === "BARBER" ? "/barbero" : "/admin/barberos";
      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Foto de perfil */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Foto de Perfil
        </h3>
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="h-32 w-32 rounded-full border-4 border-gray-200 object-cover"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600">
                <svg
                  className="h-16 w-16 text-white"
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
              </div>
            )}
          </div>

          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Seleccionar imagen
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full cursor-pointer text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="mt-2 text-xs text-gray-500">
              JPG, PNG o GIF. Máximo 2MB.
            </p>
          </div>
        </div>
      </div>

      {/* Información básica */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Información Básica
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Nombre completo *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Carlos Martínez"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={mode === "edit"}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              placeholder="Ej: carlos@barberia.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: +57 300 123 4567"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Años de experiencia
            </label>
            <input
              type="number"
              name="yearsExp"
              value={formData.yearsExp}
              onChange={handleChange}
              min="0"
              max="50"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Contraseña */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {mode === "create" ? "Contraseña" : "Cambiar Contraseña"}
        </h3>
        {mode === "edit" && (
          <p className="mb-4 text-sm text-gray-600">
            Deja estos campos vacíos si no deseas cambiar la contraseña
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {mode === "create" ? "Contraseña *" : "Nueva contraseña"}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={mode === "create"}
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {mode === "create"
                ? "Confirmar contraseña *"
                : "Confirmar nueva contraseña"}
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required={mode === "create"}
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Repite la contraseña"
            />
          </div>
        </div>
      </div>

      {/* Información profesional */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Información Profesional
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Biografía
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe la experiencia y especialidades del barbero..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Especialidades
            </label>
            <input
              type="text"
              name="specialties"
              value={formData.specialties}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Fade, Cortes clásicos, Degradados (separados por comas)"
            />
            <p className="mt-1 text-sm text-gray-500">
              Separa las especialidades con comas
            </p>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => {
            const backUrl =
              session?.user?.role === "BARBER" ? "/barbero" : "/admin/barberos";
            router.push(backUrl);
          }}
          className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50"
        >
          ← Volver
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-400"
        >
          {loading
            ? "Creando..."
            : mode === "create"
              ? "Crear Barbero"
              : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
