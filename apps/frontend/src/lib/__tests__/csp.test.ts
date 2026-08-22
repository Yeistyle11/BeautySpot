/**
 * Cabeceras de seguridad que sirve Next. Se comprueban aqui porque un
 * "Report-Only" colado por descuido no rompe nada visible: la politica deja de
 * aplicarse y no hay forma de notarlo mirando la aplicacion.
 */
interface NextConfig {
  headers: () => Promise<{ headers: { key: string; value: string }[] }[]>;
}

async function cabeceras(): Promise<Record<string, string>> {
  const nextConfig: NextConfig = (await import("../../../next.config.js"))
    .default;
  const reglas = await nextConfig.headers();
  return Object.fromEntries(reglas[0].headers.map((h) => [h.key, h.value]));
}

describe("politica de contenido", () => {
  it("se aplica en modo bloqueo, no de solo aviso", async () => {
    const h = await cabeceras();

    expect(h["Content-Security-Policy"]).toBeTruthy();
    expect(h["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("no deja cargar scripts ni tipografias de otros origenes", async () => {
    const directivas = (await cabeceras())["Content-Security-Policy"].split(
      "; "
    );

    expect(directivas).toContain("default-src 'self'");
    expect(directivas).toContain("font-src 'self' data:");
    expect(directivas).toContain("object-src 'none'");
  });

  it("impide incrustar la aplicacion y sacar sus formularios fuera", async () => {
    const directivas = (await cabeceras())["Content-Security-Policy"].split(
      "; "
    );

    expect(directivas).toContain("frame-ancestors 'none'");
    expect(directivas).toContain("form-action 'self'");
    expect(directivas).toContain("base-uri 'self'");
  });
});
