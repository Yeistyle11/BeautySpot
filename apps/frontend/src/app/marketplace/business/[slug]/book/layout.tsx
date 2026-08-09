// El asistente de reserva es un componente de cliente y no puede exportar
// metadata, asi que su titulo se declara aqui. Sin esto heredaba el del panel
// administrativo ("Panel de Gestion"), que no pinta nada en una pagina publica.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agendar cita | BeautySpot",
  description:
    "Elige servicio, profesional y horario, y confirma tu cita en unos pasos.",
  // Una pagina de reserva no aporta nada en un buscador y cambia por negocio.
  robots: { index: false, follow: true },
};

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
