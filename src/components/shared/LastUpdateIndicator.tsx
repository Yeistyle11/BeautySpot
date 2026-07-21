"use client";

import { useEffect, useState } from "react";

export default function LastUpdateIndicator() {
  // lastUpdate se fija al montar (cuando la página se re-renderiza por
  // router.refresh() este componente se remonta y se resetea a "Ahora").
  const [lastUpdate] = useState(() => new Date());
  // `now` es un tick que actualiza cada minuto para forzar re-render y
  // refrescar el texto "hace X min". Antes se hacía setLastUpdate((p) => p)
  // que es un no-op en React 18 (misma referencia → bailout) y el texto
  // nunca se actualizaba.
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick((n) => n + 1);
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
