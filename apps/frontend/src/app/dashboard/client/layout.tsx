// El panel del cliente final vive bajo /dashboard pero no es el panel de
// gestion del negocio: sin titulo propio heredaba "Panel de Gestion", que no es
// lo que esta viendo quien entra aqui.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi cuenta | BeautySpot",
  description: "Tus citas, tu perfil y tus notificaciones.",
  robots: { index: false, follow: false },
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
