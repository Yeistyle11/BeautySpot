const ALLOWED_HOSTS = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

function hostMatches(hostname: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".ejemplo.com"
    return hostname.endsWith(suffix);
  }
  return hostname === pattern;
}

/**
 * Decide si una imagen remota puede pasar por el optimizador de Next. Las URLs
 * las escribe cada negocio, y Next falla al renderizar un host que no este en
 * `remotePatterns`: los desconocidos se sirven sin optimizar, pero se ven.
 */
export function canOptimizeImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== "https:") return false;
    return ALLOWED_HOSTS.some((pattern) =>
      hostMatches(hostname.toLowerCase(), pattern)
    );
  } catch {
    // URL relativa o malformada: si es relativa la sirve el propio dominio y
    // Next puede optimizarla; si esta rota, fallara igual de cualquier forma.
    return url.startsWith("/");
  }
}

/** Prop `unoptimized` de next/image, invertida para leerse mejor en el JSX. */
export function imageUnoptimized(url: string | null | undefined): boolean {
  return !canOptimizeImage(url);
}
