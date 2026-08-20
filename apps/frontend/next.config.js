/** @type {import('next').NextConfig} */

// Hosts desde los que se permite optimizar imagenes.
//
// Las fotos (logo, portada, galeria, foto de profesional) se guardan como URL
// que teclea el propio negocio, asi que la lista es entrada de usuario llegando
// al optimizador. Next solo optimiza hosts declarados y falla en el resto, asi
// que esta lista es la unica fuente de verdad: se usa para `remotePatterns` y se
// expone al cliente para decidir, imagen a imagen, si se puede optimizar o hay
// que servirla tal cual (ver lib/image.ts).
//
// Va sin comodines a proposito. Un `*.amazonaws.com` deja que cualquiera sirva
// cualquier cosa desde su propio bucket, y el optimizador la descarga, la
// procesa y la cachea en disco: es la superficie que describen los avisos de DoS
// y de crecimiento ilimitado de la cache de next/image. Cada despliegue declara
// los suyos en NEXT_PUBLIC_IMAGE_HOSTS, donde el comodin sigue siendo posible si
// alguien lo necesita y asume el riesgo.
const IMAGE_HOSTS = [
  "images.unsplash.com",
  "res.cloudinary.com",
  ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

// Origen del gateway al que el servidor de Next reenvia /api/*. No lleva
// prefijo NEXT_PUBLIC porque el navegador no lo resuelve: dentro de Docker
// puede ser el nombre del contenedor, que fuera de la red no existe.
const GATEWAY_ORIGIN = process.env.GATEWAY_URL || "http://localhost:3000";

// Host al que conecta el navegador. Con el rewrite es el propio origen; solo
// hay otro si el despliegue fija NEXT_PUBLIC_API_URL para saltarselo.
const apiOrigin = (() => {
  if (!process.env.NEXT_PUBLIC_API_URL) return "";
  try {
    return ` ${new URL(process.env.NEXT_PUBLIC_API_URL).origin}`;
  } catch {
    return "";
  }
})();

// La CSP va en Report-Only: Next inyecta scripts y estilos en linea, asi que
// aplicarla en modo bloqueo exigiria antes propagar un nonce por todo el arbol.
// En Report-Only se ve que romperia sin romper nada todavia.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Los negocios alojan sus fotos donde quieren; la lista blanca real la aplica
  // el optimizador de imagenes con remotePatterns.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Solo tiene efecto sobre https, asi que en desarrollo el navegador la ignora.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Next 16 escribe un AGENTS.md y un CLAUDE.md en la carpeta al arrancar. Este
  // repositorio ya tiene su propio CLAUDE.md en la raiz, que es el mapa del
  // proyecto: dos ficheros con el mismo nombre y distinto contenido solo pueden
  // confundir.
  agentRules: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  env: {
    NEXT_PUBLIC_IMAGE_HOSTS: IMAGE_HOSTS.join(","),
  },
  async rewrites() {
    return [
      // El gateway sirve bajo /api/v1, asi que el prefijo se conserva.
      { source: "/api/:path*", destination: `${GATEWAY_ORIGIN}/api/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;
