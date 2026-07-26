import "server-only";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

/**
 * GET público ejecutado en el servidor, para las páginas del marketplace.
 * Devuelve `null` si el recurso no existe, para que la página responda 404.
 */
export async function fetchPublic<T>(
  path: string,
  revalidateSeconds = 300
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.success !== undefined ? body.data : body) as T;
  } catch {
    // El marketplace debe seguir sirviendose aunque el gateway este caido:
    // el componente cliente reintentara la carga.
    return null;
  }
}
