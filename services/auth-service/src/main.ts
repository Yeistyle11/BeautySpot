// Punto de entrada del microservicio: delega el arranque en la fábrica compartida
// (seguridad, CORS, validación, guards globales y apagado ordenado).
import { bootstrapMicroservice } from "@beautyspot/nest-common";
import { AppModule } from "./app.module";

// Auth es el único que firma refresh tokens, así que su secreto se exige aquí y
// no en la fábrica. Si coincidiera con JWT_SECRET, un access token robado valdría
// como refresh: los access no llevan jti, y sin jti el canje no rota ni detecta
// reutilización.
bootstrapMicroservice(AppModule, {
  secretos: ["JWT_REFRESH_SECRET"],
  distintos: [["JWT_SECRET", "JWT_REFRESH_SECRET"]],
});
