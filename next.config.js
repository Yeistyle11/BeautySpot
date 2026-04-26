/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["localhost", "res.cloudinary.com", "images.unsplash.com", "i.pravatar.cc"],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  typescript: {
    // Durante el desarrollo, no bloquear el build por errores de TypeScript
    // En producción, cambiar a false
    ignoreBuildErrors: false,
  },
  eslint: {
    // Durante el desarrollo, no bloquear el build por errores de ESLint
    // En producción, cambiar a false
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
