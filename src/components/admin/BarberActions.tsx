"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Props = {
  barberId: number;
  barberName: string;
  isActive: boolean;
};

export default function BarberActions({
  barberId,
  barberName,
  isActive,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    confirmColor: "green" | "red" | "blue";
    onConfirm: () => void;
  } | null>(null);

  const handleToggleActive = () => {
    setConfirmDialog({
      title: isActive ? "Inactivar Barbero" : "Activar Barbero",
      message: isActive
        ? `¿Estás seguro de inactivar a ${barberName}? No podrá recibir nuevas citas.`
        : `¿Estás seguro de activar a ${barberName}?`,
      confirmText: isActive ? "Inactivar" : "Activar",
      confirmColor: isActive ? "red" : "green",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);

        try {
          const res = await fetch(`/api/barbers/${barberId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !isActive }),
          });

          if (res.ok) {
            setToast({
              message: `Barbero ${isActive ? "inactivado" : "activado"} exitosamente`,
              type: "success",
            });
            setTimeout(() => router.refresh(), 1500);
          } else {
            try {
              const data = await res.json();
              setToast({
                message: data.error || "Error al actualizar el barbero",
                type: "error",
              });
            } catch {
              setToast({
                message: "Error al actualizar el barbero",
                type: "error",
              });
            }
          }
        } catch (error) {
          setToast({
            message: "Error al actualizar el barbero",
            type: "error",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleDelete = () => {
    setConfirmDialog({
      title: "Eliminar Barbero",
      message: `¿Estás seguro de eliminar a ${barberName}? Esta acción no se puede deshacer. El barbero no debe tener citas pendientes o confirmadas.`,
      confirmText: "Eliminar",
      confirmColor: "red",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);

        try {
          const res = await fetch(`/api/barbers/${barberId}`, {
            method: "DELETE",
          });

          if (res.ok) {
            setToast({
              message: "Barbero eliminado exitosamente",
              type: "success",
            });
            setTimeout(() => router.refresh(), 1500);
          } else {
            try {
              const data = await res.json();
              setToast({
                message: data.error || "Error al eliminar el barbero",
                type: "error",
              });
            } catch {
              setToast({
                message: "Error al eliminar el barbero",
                type: "error",
              });
            }
          }
        } catch (error) {
          setToast({ message: "Error al eliminar el barbero", type: "error" });
        } finally {
          setLoading(false);
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
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            isActive
              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {isActive ? "Inactivar" : "Activar"}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
          title="Eliminar permanentemente"
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
