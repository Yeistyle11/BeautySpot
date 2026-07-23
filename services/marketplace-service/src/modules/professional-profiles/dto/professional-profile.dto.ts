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

export class SyncProfessionalDto {
  @IsString() professionalId!: string;
  @IsString() businessId!: string;
  @IsString() name!: string;

  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() @IsNumber() yearsExp?: number;
}

export class UpdateProfessionalProfileDto {
  @IsOptional() @IsString() @MaxLength(60) tagline?: string;

  @IsOptional()
  @IsArray()
  @Type(() => PortfolioItemDto)
  portfolio?: PortfolioItemDto[];

  @IsOptional() @IsString() socialInstagram?: string;

  @IsOptional() @IsBoolean() visibleOnProfile?: boolean;
}

export class ToggleProfessionalVisibilityDto {
  @IsBoolean() visibleOnProfile!: boolean;
}
