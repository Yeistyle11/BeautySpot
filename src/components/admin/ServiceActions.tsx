"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface ServiceActionsProps {
  serviceId: number;
  serviceName: string;
  isActive: boolean;
}

export default function ServiceActions({
  serviceId,
  serviceName,
  isActive,
}: ServiceActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText: string;
    confirmColor: "green" | "red" | "blue";
  } | null>(null);

  const handleToggleActive = async () => {
    setConfirmDialog({
      title: isActive ? "Desactivar servicio" : "Activar servicio",
      message: isActive
        ? `¿Estás seguro de que deseas desactivar el servicio "${serviceName}"? No estará disponible para nuevas citas.`
        : `¿Deseas activar el servicio "${serviceName}"?`,
      confirmText: isActive ? "Desactivar" : "Activar",
      confirmColor: isActive ? "red" : "green",
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/services/${serviceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !isActive }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Error al actualizar el servicio");
          }

          setToast({
            message: isActive
              ? "Servicio desactivado exitosamente"
              : "Servicio activado exitosamente",
            type: "success",
          });

          // Refrescar la página después de un momento
          setTimeout(() => {
            router.refresh();
          }, 1000);
        } catch (error) {
          setToast({
            message:
              error instanceof Error
                ? error.message
                : "Error al actualizar el servicio",
            type: "error",
          });
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleDelete = async () => {
    setConfirmDialog({
      title: "Eliminar servicio",
      message: `¿Estás seguro de que deseas eliminar el servicio "${serviceName}"? Esta acción lo desactivará permanentemente.`,
      confirmText: "Eliminar",
      confirmColor: "red",
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/services/${serviceId}`, {
            method: "DELETE",
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Error al eliminar el servicio");
          }

          setToast({
            message: "Servicio eliminado exitosamente",
            type: "success",
          });

          // Refrescar la página después de un momento
          setTimeout(() => {
            router.refresh();
          }, 1000);
        } catch (error) {
          setToast({
            message:
              error instanceof Error
                ? error.message
                : "Error al eliminar el servicio",
            type: "error",
          });
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleToggleActive}
          disabled={loading}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-yellow-600 text-white hover:bg-yellow-700"
              : "bg-green-600 text-white hover:bg-green-700"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {loading ? "Procesando..." : isActive ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          title="Eliminar servicio"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          confirmColor={confirmDialog.confirmColor}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}
