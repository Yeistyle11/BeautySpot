import {
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsUrl,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsIn,
  Length,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";
import { VALORES_TIPO_DE_NEGOCIO } from "@beautyspot/shared-constants";
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

/**
 * Datos con los que el dueno da de alta su escaparate desde el panel. Sin
 * `businessId`: en esta ruta el negocio lo dice el token.
 */
export class CrearPerfilDto {
  @IsString() @Length(2, 120) name!: string;

  /**
   * Enlace publico del negocio; si no lo elige, se deriva del nombre.
   */
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: "El enlace solo admite minúsculas, números y guiones",
  })
  slug?: string;

  @IsIn(VALORES_TIPO_DE_NEGOCIO, { message: "Tipo de negocio no reconocido" })
  businessType!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
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
