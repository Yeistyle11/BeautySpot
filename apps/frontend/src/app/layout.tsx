import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

// `metadataBase` es lo que permite que las URLs relativas de Open Graph y de
// los canonical se resuelvan a absolutas; sin ella Next las descarta.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8080";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Las paginas publicas definen su propio titulo; el resto hereda el default.
  title: {
    default: "BeautySpot - Panel de Gestion",
    template: "%s",
  },
  description:
    "Plataforma de gestion para centro de bellezas y salones de belleza",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
