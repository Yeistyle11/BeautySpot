/** Escapa un valor para CSV: las comillas se duplican, segun RFC 4180. */
function escapeCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Descarga una tabla como CSV abrible en Excel.
 *
 * Lleva BOM UTF-8 al principio porque, sin el, Excel en Windows interpreta el
 * archivo como ANSI y los acentos salen corruptos. El object URL se libera
 * despues de disparar la descarga para no retener el blob en memoria.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const csv = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");

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
