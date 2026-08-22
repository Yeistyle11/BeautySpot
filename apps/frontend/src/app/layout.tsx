// Layout raiz: aplica la fuente, los estilos globales, los Providers y la metadata base para SEO.
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { THEME_STORAGE_KEY } from "@/lib/use-theme";

const inter = Inter({ subsets: ["latin"] });

// `metadataBase` es lo que permite que las URLs relativas de Open Graph y de
// los canonical se resuelvan a absolutas; sin ella Next las descarta.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8080";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Las paginas publicas definen su propio titulo; el resto hereda el default.
  title: {
    default: "BeautySpot - Panel de Gestión",
    template: "%s",
  },
  description:
    "Plataforma de gestión para barberías, salones de belleza, spas y centros estéticos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          Corre antes del primer pintado: aplicarlo desde un efecto dejaba un
          destello blanco en cada carga a quien tiene guardado el tema oscuro.
          Solo mira lo que el usuario eligio, no `prefers-color-scheme`: sin
          eleccion explicita el tema es claro.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
