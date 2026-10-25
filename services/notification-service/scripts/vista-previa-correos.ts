/**
 * Pinta cada correo de ejemplo a un .html, con un índice y sus imágenes.
 * Uso: npm run correos:vista-previa -- [carpeta de salida]
 */
import { cpSync, mkdirSync, writeFileSync } from "fs";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { PlantillasService } from "../src/modules/emails/plantillas.service";
import {
  EJEMPLOS_DE_CORREO,
  EJEMPLOS_MINIMOS,
} from "../src/modules/emails/ejemplos-de-correo";

async function main() {
  const salida = path.resolve(process.argv[2] ?? "vista-previa-correos");
  const imagenes = path.resolve(
    __dirname,
    "../../../apps/frontend/public/correo"
  );

  const config = new ConfigService({
    APP_URL: "https://appbeautyspot.com",
    EMAIL_ASSETS_URL: "correo",
  });
  const plantillas = new PlantillasService(config);
  await plantillas.onModuleInit();

  mkdirSync(salida, { recursive: true });
  cpSync(imagenes, path.join(salida, "correo"), { recursive: true });
  const enlaces: string[] = [];
  for (const [nombre, contexto] of Object.entries(EJEMPLOS_DE_CORREO)) {
    writeFileSync(
      path.join(salida, `${nombre}.html`),
      plantillas.render(nombre, contexto)
    );
    writeFileSync(
      path.join(salida, `${nombre}.minimo.html`),
      plantillas.render(nombre, EJEMPLOS_MINIMOS[nombre])
    );
    enlaces.push(
      `<li><a href="${nombre}.html">${nombre}</a> · <a href="${nombre}.minimo.html">con datos mínimos</a></li>`
    );
  }
  writeFileSync(
    path.join(salida, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Correos</title><ul style="font-family: sans-serif; line-height: 2">${enlaces.join("")}</ul>`
  );
  console.log(`${enlaces.length} correos en ${salida}`);
}

void main();
