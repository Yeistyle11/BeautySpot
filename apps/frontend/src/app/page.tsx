// Pagina de entrada: redirige al dashboard si hay sesion o al marketplace publico si no.
//
// Se resuelve en el servidor porque el access token vive en una cookie httpOnly:
// el cliente no puede leerlo, asi que la decision no es posible en el navegador.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeJwt, AUTH_COOKIE_NAME } from "@/lib/auth";
import { getDefaultPath } from "@/lib/permissions";

export default function Home() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? decodeJwt(token) : null;
  const expirado = !!payload?.exp && payload.exp * 1000 < Date.now();

  if (payload && !expirado) {
    redirect(getDefaultPath(payload.role ?? null));
  }
  redirect("/marketplace");
}
