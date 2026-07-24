// Configuración de tests de INTEGRACIÓN de booking-service.
//
// A diferencia de los unit tests (*.spec.ts, que mockean Redis/RabbitMQ/BD),
// estos corren contra infraestructura real y solo incluyen archivos *.int-test.ts.
//
// Requisitos para ejecutarlos:
//   1. docker compose -f docker-compose.test.yml up -d   (Postgres/Redis/RabbitMQ)
//   2. npm run test:int   (dentro del servicio)
//
// Es la plantilla replicable al resto de servicios.
const base = require("./jest.config");

module.exports = {
  ...base,
  // Solo *.int-test.ts: no interfiere con los unit *.spec.ts ni con el CI.
  testRegex: ".*\\.int-test\\.ts$",
  // Setup de integración: carga .env.test y NO aplica los mocks de los unit tests.
  setupFiles: ["<rootDir>/src/test/integration-setup.ts"],
  setupFilesAfterEnv: [],
  // Las conexiones reales pueden tardar más que un unit test.
  testTimeout: 30000,
};
