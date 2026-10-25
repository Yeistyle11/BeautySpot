import "reflect-metadata";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseEnv } from "util";

// Carga las variables del entorno de test (Postgres/Redis/RabbitMQ definidos en
// docker-compose.test.yml) ANTES de que se inicialicen los módulos de Nest, para
// que TypeOrmModule y demás lean el DATABASE_URL de pruebas.
// Se analiza y se copia a mano: Jest corre este archivo con su propia copia
// de `process.env`, y `process.loadEnvFile` escribiría en la del proceso, que
// los tests no ven. Lo que ya venga del entorno no se pisa.
const variables = parseEnv(
  readFileSync(resolve(__dirname, "../../.env.test"), "utf8")
);
for (const [nombre, valor] of Object.entries(variables)) {
  process.env[nombre] ??= valor;
}
