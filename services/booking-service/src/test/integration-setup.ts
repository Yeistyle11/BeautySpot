import "reflect-metadata";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEnv } from "util";

// Copia el .env.test al `process.env` de Jest sin pisar lo que ya trae.
const variables = parseEnv(
  readFileSync(resolve(__dirname, "../../.env.test"), "utf8")
);
for (const [nombre, valor] of Object.entries(variables)) {
  process.env[nombre] ??= valor;
}
