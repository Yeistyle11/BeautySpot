import { IsInt, IsUUID, Min } from "class-validator";
import { Type } from "class-transformer";

/** Puntos que se reservan o se devuelven a un cliente de un negocio. */
export class MoverPuntosDto {
  @IsUUID("4")
  businessId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  puntos!: number;
}
