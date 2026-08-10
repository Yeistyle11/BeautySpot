// Descarga de ficheros binarios del gateway.
import { ApiError } from "./api-error";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

/** Pide un PDF al gateway y lo guarda con el nombre indicado. */
export async function descargarPdf(
  path: string,
  filename: string
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { Accept: "application/pdf" },
  });

  if (!res.ok) {
    throw new ApiError(res.status, "No se pudo descargar el documento");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = filename;
  enlace.click();
  URL.revokeObjectURL(url);
}
