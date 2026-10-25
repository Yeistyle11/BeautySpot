import "reflect-metadata";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEnv } from "util";

// Carga las variables del entorno de test (Postgres/Redis/RabbitMQ definidos en
// docker-compose.test.yml) en el `process.env` que ve Jest, antes de que se
// inicialicen los módulos de Nest. Lo que ya venga del entorno no se pisa.
const variables = parseEnv(
  readFileSync(resolve(__dirname, "../../.env.test"), "utf8")
);
for (const [nombre, valor] of Object.entries(variables)) {
  process.env[nombre] ??= valor;
}
