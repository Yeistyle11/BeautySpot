import "reflect-metadata";
import { resolve } from "path";

// Carga las variables del entorno de test (Postgres/Redis/RabbitMQ definidos en
// docker-compose.test.yml) ANTES de que se inicialicen los módulos de Nest, para
// que TypeOrmModule y demás lean el DATABASE_URL de pruebas.
process.loadEnvFile(resolve(__dirname, "../../.env.test"));
