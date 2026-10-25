// Genera a doble resolución los PNG de los correos (public/correo/).
// Uso, desde apps/frontend: node scripts/iconos-de-correo.mjs
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DESTINO = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "correo"
);

const MARCA = "#7C3AED";
const MARCA_SUAVE = "#F3EEFF";

/** Trazos de los iconos, los mismos de lucide que usa el panel (24×24). */
const TRAZOS = {
  calendario:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  "calendario-x":
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M14 14l-4 4M10 14l4 4"/>',
  "calendario-check":
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  persona:
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  lugar:
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  tijeras:
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  campana:
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  estrella:
    '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  regalo:
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  factura:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  correo:
    '<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/>',
  llave:
    '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  cuenta:
    '<path d="M2 21a8 8 0 0 1 13.29-6"/><circle cx="10" cy="8" r="5"/><path d="m16 19 2 2 4-4"/>',
  grafica: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  brillo:
    '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  equipo:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dinero:
    '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  escudo:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
};

/** Icono de línea suelto, sobre transparente. */
function svgDeIcono(nombre, color, lado) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre]}</svg>`;
}

/** Icono de cabecera: círculo blanco con aro lila, con la banda violeta detrás. */
function svgDeCabecera(nombre) {
  const lado = 168;
  const mitad = lado / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
    <rect width="${lado}" height="${mitad}" fill="${MARCA}"/>
    <rect y="${mitad}" width="${lado}" height="${mitad}" fill="#FFFFFF"/>
    <circle cx="${mitad}" cy="${mitad}" r="${mitad}" fill="${MARCA_SUAVE}"/>
    <circle cx="${mitad}" cy="${mitad}" r="72" fill="#FFFFFF"/>
    <svg x="${mitad - 34}" y="${mitad - 34}" width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="${MARCA}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre]}</svg>
  </svg>`;
}

/** El isotipo: disco con su lunar, en las dos combinaciones que usan los correos. */
function svgDeIsotipo(disco, lunar, lado) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="${disco}"/><circle cx="64" cy="34" r="13" fill="${lunar}"/></svg>`;
}

const ESTRELLA = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 24 24" fill="#F5A524" stroke="#F5A524" stroke-width="1.5" stroke-linejoin="round">${TRAZOS.estrella}</svg>`;

/** Qué se genera: nombre del fichero y su SVG. */
const FICHEROS = [
  ...Object.keys(TRAZOS).map((n) => [
    `icono-${n}.png`,
    svgDeIcono(n, MARCA, 48),
  ]),
  ...Object.keys(TRAZOS).map((n) => [`cabecera-${n}.png`, svgDeCabecera(n)]),
  // Los avisos llevan el icono en el color de su tono.
  ["aviso-info-reloj.png", svgDeIcono("reloj", "#1E40AF", 40)],
  ["aviso-info-info.png", svgDeIcono("info", "#1E40AF", 40)],
  ["aviso-neutro-escudo.png", svgDeIcono("escudo", "#334155", 40)],
  ["aviso-aviso-info.png", svgDeIcono("info", "#92400E", 40)],
  ["estrella.png", ESTRELLA],
  ["isotipo-blanco.png", svgDeIsotipo("#FFFFFF", MARCA, 64)],
  ["isotipo.png", svgDeIsotipo(MARCA, "#EEEAF7", 32)],
];

mkdirSync(DESTINO, { recursive: true });
for (const [nombre, svg] of FICHEROS) {
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(DESTINO, nombre));
}
console.log(`${FICHEROS.length} imágenes en ${DESTINO}`);
