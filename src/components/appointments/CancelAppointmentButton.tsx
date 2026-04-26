"use client";

import { useState } from "react";

interface CancelAppointmentButtonProps {
  appointmentId: number;
}

export default function CancelAppointmentButton({
  appointmentId,
}: CancelAppointmentButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!confirm("¿Estás seguro de que deseas cancelar esta cita?")) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        window.location.href = "/cliente/citas";
      } else {
        alert("Error al cancelar la cita");
        setIsSubmitting(false);
      }
    } catch (error) {
      alert("Error al cancelar la cita");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1">
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:bg-gray-400"
      >
        {isSubmitting ? "Cancelando..." : "❌ Cancelar Cita"}
      </button>
    </form>
  );
}
