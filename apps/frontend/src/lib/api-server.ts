import "server-only";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

/**
 * GET publico ejecutado en el servidor, para las paginas del marketplace.
 *
 * Existe aparte de `lib/api.ts` porque aquel lee el token de localStorage y
 * solo puede correr en el navegador. Aqui el objetivo es distinto: renderizar
 * el contenido en el HTML inicial para que los buscadores lo indexen y el
 * usuario no vea una pantalla vacia mientras carga.
 *
 * Devuelve `null` en vez de lanzar: un perfil que no existe debe acabar en un
 * 404 de Next, no en una pagina de error.
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
