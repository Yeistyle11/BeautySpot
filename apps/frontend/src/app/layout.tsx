// Layout raiz: aplica la fuente, los estilos globales, los Providers y la metadata base para SEO.
import type { Metadata } from "next";
import { Inter, Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SCRIPT_DE_TEMA } from "@/lib/tema-inicial";

const inter = Inter({ subsets: ["latin"] });

// Solo para el logotipo: "Beauty" en 400 y "Spot" en 700, que es como esta
// dibujada la marca. Va como variable y no como clase para que no se aplique a
// nada mas que al componente del logo.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--fuente-logotipo",
});

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

/** Envuelve toda la aplicacion con la fuente, los estilos y los Providers. */
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
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DE_TEMA }} />
      </head>
      <body className={`${inter.className} ${archivo.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
