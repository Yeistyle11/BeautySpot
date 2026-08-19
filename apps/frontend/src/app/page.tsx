// Pagina de entrada: redirige al dashboard si hay sesion y al marketplace si no.
// Se resuelve en el servidor, donde se puede leer la cookie httpOnly.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeJwt, AUTH_COOKIE_NAME } from "@/lib/auth";
import { getDefaultPath } from "@/lib/permissions";

export default async function Home() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? decodeJwt(token) : null;
  const expirado = !!payload?.exp && payload.exp * 1000 < Date.now();

  if (payload && !expirado) {
    redirect(getDefaultPath(payload.role ?? null));
  }
  redirect("/marketplace");
}
