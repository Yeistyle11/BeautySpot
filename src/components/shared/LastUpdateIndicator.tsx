"use client";

import { useEffect, useState } from "react";

export default function LastUpdateIndicator() {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    // Actualizar cada vez que el componente se renderiza
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate((prev) => prev); // Forzar re-render
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getTimeAgo = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

    if (diff < 60) return "Ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return lastUpdate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="flex items-center gap-1">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
        <span>Actualizado {getTimeAgo()}</span>
      </div>
    </div>
  );
}
