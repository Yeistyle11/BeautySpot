// Configuración de tests de INTEGRACIÓN de notification-service.
//
// A diferencia de los unit tests (*.spec.ts, que mockean Redis/RabbitMQ/BD),
// estos corren contra infraestructura real y solo incluyen archivos *.int-test.ts.
//
// Requisitos para ejecutarlos:
//   1. docker compose -f docker-compose.test.yml up -d   (Postgres/Redis/RabbitMQ)
//   2. npm run test:int   (dentro del servicio)
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
  // Red de seguridad: un cliente de BD/Redis que deje un socket o un timer
  // abierto impediría que jest termine, y en CI el job se colgaría hasta el
  // límite de 6 horas en lugar de fallar.
  forceExit: true,
  // En serie, obligatorio: todos los ficheros de un servicio comparten UNA sola
  // base de datos. En paralelo, dos que hagan `synchronize` chocan creando el
  // esquema ("duplicate key ... pg_type_typname_nsp_index") y el TRUNCATE de
  // preparación de uno borra las tablas que el otro está usando.
  maxWorkers: 1,
  // Para al primer fichero que falle en vez de seguir con el resto: contra
  // infraestructura compartida, un fallo temprano suele invalidar lo que venga
  // después (esquema a medias, datos sucios) y solo añade ruido al log.
  bail: 1,
};
