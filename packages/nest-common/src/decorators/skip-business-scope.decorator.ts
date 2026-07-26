import { SetMetadata } from "@nestjs/common";

export const SKIP_BUSINESS_SCOPE_KEY = "skipBusinessScope";

/**
 * Exime a la ruta del header X-Business-Id. Para endpoints que actúan sobre el
 * usuario autenticado y no sobre un negocio.
 */
export const SkipBusinessScope = () =>
  SetMetadata(SKIP_BUSINESS_SCOPE_KEY, true);
