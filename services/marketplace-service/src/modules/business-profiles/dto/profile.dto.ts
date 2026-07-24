import {
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsUrl,
  IsArray,
  ValidateNested,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";
import { SocialLinks } from "../../../entities/business-profile.entity";

// --- Perfil basico (sincronizacion desde core-service) ---

/** Datos que el core envía para crear o actualizar el perfil de un negocio. */
export class UpsertProfileDto {
  @IsString() businessId!: string;
  @IsString() slug!: string;
  @IsString() name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() businessType?: string;
}

// --- Configuracion del perfil inmersivo ---

/** Configuración de una sección del perfil: id, si se muestra, orden y título. */
export class SectionConfigDto {
  @IsString() id!: string;
  @IsBoolean() enabled!: boolean;
  @IsNumber() order!: number;
  @IsOptional() @IsString() customTitle?: string;
}

/** Campos editables del perfil inmersivo: historia, redes, fundación y secciones. */
export class UpdateProfileConfigDto {
  @IsOptional() @IsString() tagline?: string;

  @IsOptional() @IsString() storyTitle?: string;
  @IsOptional() @IsString() storyText?: string;
  @IsOptional() @IsString() storyImage?: string;
  @IsOptional() @IsNumber() foundedYear?: number;
  @IsOptional() @IsString() founders?: string;

  @IsOptional() socialLinks?: SocialLinks;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionConfigDto)
  sectionConfig?: SectionConfigDto[];
}

// --- Galeria ---

/** Una imagen de la galería: URL, título, categoría y marca de destacada. */
export class GalleryImageDto {
  @IsUrl() url!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}

/** Conjunto de imágenes a añadir a la galería del perfil. */
export class AddGalleryImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryImageDto)
  images!: GalleryImageDto[];
}

/** Datos para actualizar una imagen de la galería identificada por su índice. */
export class UpdateGalleryImageDto {
  @IsNumber() index!: number;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}
