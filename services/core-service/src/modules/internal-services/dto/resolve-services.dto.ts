import { IsArray, IsOptional, IsUUID, ArrayNotEmpty } from "class-validator";

/** Servicios cuyo precio y duración pide otro servicio, opcionalmente para un profesional concreto. */
export class ResolveServicesDto {
  @IsUUID() businessId!: string;
  @IsArray() @ArrayNotEmpty() @IsUUID("4", { each: true }) ids!: string[];
  /** Si viene, se aplican el precio y la duración propios del profesional. */
  @IsOptional() @IsUUID() professionalId?: string;
}
