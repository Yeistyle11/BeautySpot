import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsUrl,
  IsBoolean,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

class PortfolioItemDto {
  @IsUrl() url!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
}

/** Datos que el core envía para sincronizar el perfil de un profesional. */
export class SyncProfessionalDto {
  @IsString() professionalId!: string;
  @IsString() businessId!: string;
  @IsString() name!: string;

  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() @IsNumber() yearsExp?: number;
}

/** Campos del perfil que el negocio puede editar: tagline, portafolio, redes y visibilidad. */
export class UpdateProfessionalProfileDto {
  @IsOptional() @IsString() @MaxLength(60) tagline?: string;

  @IsOptional()
  @IsArray()
  @Type(() => PortfolioItemDto)
  portfolio?: PortfolioItemDto[];

  @IsOptional() @IsString() socialInstagram?: string;

  @IsOptional() @IsBoolean() visibleOnProfile?: boolean;
}

/** Indica si el profesional debe mostrarse en el perfil público del negocio. */
export class ToggleProfessionalVisibilityDto {
  @IsBoolean() visibleOnProfile!: boolean;
}
