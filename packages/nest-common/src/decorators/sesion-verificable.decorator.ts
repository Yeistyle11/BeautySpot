import { SetMetadata } from "@nestjs/common";

export const SESION_VERIFICABLE_KEY = "sesionVerificable";

/**
 * Exige poder comprobar que la sesión sigue vigente para atender la petición.
 *
 * La comprobación de revocación se apoya en Redis. Si Redis no responde, el
 * resto de rutas siguen atendiéndose —tumbar toda la aplicación por no poder
 * consultar la caché sería peor que el riesgo que evita—, pero en las acciones
 * marcadas con este decorador se rechaza la petición: son aquellas en las que
 * dejar actuar a una sesión que quizá esté revocada hace un daño que no se
 * deshace, como cambiar credenciales, tocar permisos o mover dinero.
 */
export const SesionVerificable = () =>
  SetMetadata(SESION_VERIFICABLE_KEY, true);
