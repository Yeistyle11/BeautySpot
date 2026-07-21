"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface CancelAppointmentButtonProps {
  appointmentId: number;
}

export default function CancelAppointmentButton({
  appointmentId,
}: CancelAppointmentButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirm = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/appointments/${appointmentId}/cancel`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        router.push("/cliente/citas");
        router.refresh();
      } else {
        setErrorMsg("Error al cancelar la cita");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error al cancelar la cita:", error);
      setErrorMsg("Error al cancelar la cita");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isSubmitting}
        className="w-full rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:bg-gray-400"
      >
        {isSubmitting ? "Cancelando..." : "❌ Cancelar Cita"}
      </button>

      {showConfirm && (
        <ConfirmDialog
          title="Cancelar cita"
          message="¿Estás seguro de que deseas cancelar esta cita?"
          confirmText="Sí, cancelar"
          confirmColor="red"
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {errorMsg && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}
    </>
  );
}
