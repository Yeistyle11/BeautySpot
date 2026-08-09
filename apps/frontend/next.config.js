/** @type {import('next').NextConfig} */

// Hosts desde los que se permite optimizar imagenes.
//
// Las fotos (logo, portada, galeria, foto de profesional) se guardan como URL
// que teclea el propio negocio, asi que pueden apuntar a cualquier sitio. Next
// solo optimiza hosts declarados y falla en el resto, asi que esta lista es la
// unica fuente de verdad: se usa para `remotePatterns` y se expone al cliente
// para decidir, imagen a imagen, si se puede optimizar o hay que servirla tal
// cual (ver lib/image.ts). Se amplia con NEXT_PUBLIC_IMAGE_HOSTS.
const IMAGE_HOSTS = [
  "images.unsplash.com",
  "res.cloudinary.com",
  "*.googleusercontent.com",
  "*.amazonaws.com",
  "*.supabase.co",
  "*.cloudfront.net",
  ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

// Origen del gateway, que es el unico destino de las peticiones del navegador.
// Se declara aqui para que connect-src no tenga que abrirse a cualquier host.
const apiOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
    ).origin;
  } catch {
    return "http://localhost:3000";
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
  `connect-src 'self' ${apiOrigin}`,
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
      { source: "/api/:path*", destination: "http://localhost:3000/:path*" },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;
