// Punto de entrada del microservicio: delega el arranque en la fábrica compartida
// (seguridad, CORS, validación, guards globales y apagado ordenado).
import { bootstrapMicroservice } from "@beautyspot/nest-common";
import { AppModule } from "./app.module";

bootstrapMicroservice(AppModule);
