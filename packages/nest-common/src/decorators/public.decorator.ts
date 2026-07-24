import { SetMetadata } from "@nestjs/common";

/** Clave de metadata que marca una ruta como pública (leída por JwtAuthGuard). */
export const IS_PUBLIC_KEY = "isPublic";
/** Marca un endpoint como público para que el JwtAuthGuard no exija autenticación. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
