import { Raw } from "typeorm";
import {
  columnaSinTildes,
  escapeLikePattern,
  sinTildes,
} from "@beautyspot/shared-utils";

/**
 * Condición de búsqueda por contenido que ignora tildes y mayúsculas: "Perez"
 * encuentra a "Pérez" y al revés.
 */
export function contieneTexto(texto: string) {
  const patron = `%${escapeLikePattern(sinTildes(texto))}%`;
  return Raw((alias) => `${columnaSinTildes(alias)} LIKE :patron`, { patron });
}
