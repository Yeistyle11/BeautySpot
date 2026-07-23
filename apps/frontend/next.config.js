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
};

module.exports = nextConfig;
