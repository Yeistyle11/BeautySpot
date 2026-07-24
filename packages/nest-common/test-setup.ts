// Setup global de Jest para el paquete: habilita reflect-metadata (necesario para
// los decoradores de NestJS/TypeORM) antes de que corra cualquier prueba.
import "reflect-metadata";

global.Reflect = Reflect;
