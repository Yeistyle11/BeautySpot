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

export class SectionConfigDto {
  @IsString() id!: string;
  @IsBoolean() enabled!: boolean;
  @IsNumber() order!: number;
  @IsOptional() @IsString() customTitle?: string;
}

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

export class GalleryImageDto {
  @IsUrl() url!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}

export class AddGalleryImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryImageDto)
  images!: GalleryImageDto[];
}

export class UpdateGalleryImageDto {
  @IsNumber() index!: number;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}
