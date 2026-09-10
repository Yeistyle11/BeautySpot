// Excel y LibreOffice interpretan como formula toda celda que empiece por uno de
// estos caracteres, aunque venga entrecomillada. Las celdas salen de datos que
// teclea el usuario, asi que un "=HYPERLINK(...)" se ejecutaria al abrirlo.
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Escapa un valor para CSV: las comillas se duplican, segun RFC 4180, y las
 * celdas que parecen formula se prefijan con un apostrofo para que la hoja de
 * calculo las trate como texto.
 */
function escapeCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  const seguro = INICIO_DE_FORMULA.test(text) ? `'${text}` : text;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/** Serializa cabeceras y filas como CSV con todas las celdas escapadas. */
export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  return [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");
}

/**
 * Descarga una tabla como CSV abrible en Excel. Lleva BOM UTF-8 porque sin el
 * Excel en Windows lo lee como ANSI y los acentos salen corruptos; el object URL
 * se libera tras disparar la descarga.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const csv = buildCsv(headers, rows);

  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
