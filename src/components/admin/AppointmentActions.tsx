"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function AppointmentActions({
  appointmentId,
  status,
  canModify,
}: {
  appointmentId: string | number;
  status: string;
  canModify: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
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

  const handleComplete = async () => {
    setConfirmDialog({
      title: "Completar Cita",
      message: "¿Estás seguro de marcar esta cita como completada?",
      confirmText: "Completar",
      confirmColor: "green",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const res = await fetch(
            `/api/appointments/${appointmentId}/complete`,
            {
              method: "POST",
            }
          );

          if (res.ok) {
            setToast({
              message: "Cita completada exitosamente",
              type: "success",
            });
            setTimeout(() => {
              router.push("/admin/citas");
              router.refresh();
            }, 1000);
          } else {
            setToast({ message: "Error al completar la cita", type: "error" });
          }
        } catch (error) {
          setToast({ message: "Error al completar la cita", type: "error" });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleNoShow = async () => {
    setConfirmDialog({
      title: "Marcar No Asistió",
      message: "¿Confirmas que el cliente no se presentó a esta cita?",
      confirmText: "No Asistió",
      confirmColor: "red",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const res = await fetch(
            `/api/appointments/${appointmentId}/no-show`,
            {
              method: "POST",
            }
          );

          if (res.ok) {
            setToast({
              message: "Cita marcada como no asistió",
              type: "success",
            });
            setTimeout(() => {
              router.push("/admin/citas");
              router.refresh();
            }, 1000);
          } else {
            setToast({
              message: "Error al marcar como no asistió",
              type: "error",
            });
          }
        } catch (error) {
          setToast({
            message: "Error al procesar la solicitud",
            type: "error",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setToast({
        message: "Por favor ingresa un motivo de cancelación",
        type: "error",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason }),
      });

      if (res.ok) {
        setShowCancelModal(false);
        setToast({ message: "Cita cancelada exitosamente", type: "success" });
        setTimeout(() => {
          router.push("/admin/citas");
          router.refresh();
        }, 1000);
      } else {
        setToast({ message: "Error al cancelar la cita", type: "error" });
      }
    } catch (error) {
      setToast({ message: "Error al cancelar la cita", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      title: "Eliminar Cita",
      message:
        "¿ELIMINAR esta cita permanentemente? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      confirmColor: "red",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const res = await fetch(`/api/appointments/${appointmentId}`, {
            method: "DELETE",
          });

          if (res.ok) {
            setToast({
              message: "Cita eliminada exitosamente",
              type: "success",
            });
            setTimeout(() => {
              router.push("/admin/citas");
              router.refresh();
            }, 1000);
          } else {
            setToast({ message: "Error al eliminar la cita", type: "error" });
          }
        } catch (error) {
          setToast({ message: "Error al eliminar la cita", type: "error" });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleConfirm = async () => {
    setConfirmDialog({
      title: "Confirmar Cita",
      message: "¿Deseas confirmar esta cita?",
      confirmText: "Confirmar",
      confirmColor: "blue",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const res = await fetch(
            `/api/appointments/${appointmentId}/confirm`,
            {
              method: "POST",
            }
          );

          if (res.ok) {
            setToast({
              message: "Cita confirmada exitosamente",
              type: "success",
            });
            setTimeout(() => {
              router.push("/admin/citas");
              router.refresh();
            }, 1000);
          } else {
            setToast({ message: "Error al confirmar la cita", type: "error" });
          }
        } catch (error) {
          setToast({ message: "Error al confirmar la cita", type: "error" });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {canModify && status === "PENDING" && (
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Confirmar Cita
          </button>
        )}

        {canModify && (status === "PENDING" || status === "CONFIRMED") && (
          <>
            <button
              onClick={handleComplete}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Marcar como Completada
            </button>

            <button
              onClick={handleNoShow}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              No Asistió
            </button>

            <button
              onClick={() => setShowCancelModal(true)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Cancelar Cita
            </button>
          </>
        )}

        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-red-900 px-4 py-2 text-white hover:bg-red-950 disabled:opacity-50"
        >
          <svg
            className="h-5 w-5"
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
          Eliminar Permanentemente
        </button>
      </div>

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-scale-in w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Cancelar Cita
            </h3>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Motivo de cancelación
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                rows={4}
                placeholder="Ingresa el motivo de la cancelación..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cerrar
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm dialog */}
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
    </div>
  );
}
