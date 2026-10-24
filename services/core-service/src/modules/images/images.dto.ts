import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import {
  MAXIMO_IMAGENES_GALERIA,
  PROPOSITOS_DE_IMAGEN,
  type PropositoDeImagen,
} from "@beautyspot/shared-constants";

/** Campos de texto que acompañan al archivo en la subida. */
export class SubirImagenDto {
  @IsIn(PROPOSITOS_DE_IMAGEN, {
    message: `El propósito debe ser uno de: ${PROPOSITOS_DE_IMAGEN.join(", ")}`,
  })
  proposito: PropositoDeImagen;
}

/** Imágenes que otro servicio dejó sin uso, para borrarlas del almacén. */
export class DescartarImagenesDto {
  @IsUUID()
  businessId: string;

  @IsArray()
  // Lo más que se puede soltar de golpe es la galería entera más la historia.
  @ArrayMaxSize(MAXIMO_IMAGENES_GALERIA + 1)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  urls: string[];
}
