// Los enlaces del perfil publico (Instagram, sitio web) los teclea el propio
// negocio y acaban en un href. Un "javascript:..." ahi se ejecuta en el
// navegador del visitante y React solo avisa: de ahi el filtro de protocolo.
const PROTOCOLOS_PERMITIDOS = new Set(["http:", "https:"]);

/**
 * Devuelve la URL solo si es navegable, y `undefined` si no lo es. Una entrada
 * sin protocolo se interpreta como https, que es lo que el usuario quiere decir
 * al escribir "midominio.com".
 */
export function hrefSeguro(
  valor: string | null | undefined
): string | undefined {
  if (!valor) return undefined;
  const texto = valor.trim();
  if (!texto) return undefined;

  const candidato = /^[a-z][a-z0-9+.-]*:/i.test(texto)
    ? texto
    : `https://${texto}`;

  try {
    const url = new URL(candidato);
    return PROTOCOLOS_PERMITIDOS.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
