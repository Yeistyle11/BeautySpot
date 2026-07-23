import { IsString, IsOptional, MaxLength, Matches } from "class-validator";

export class UploadBusinessLogoDto {
  @IsString()
  @MaxLength(50)
  businessId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

export class UploadProfessionalPhotoDto {
  @IsString()
  @MaxLength(50)
  professionalId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

export class UploadServiceImageDto {
  @IsString()
  @MaxLength(50)
  serviceId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

export class GenerateUploadSignatureDto {
  @Matches(/^(business-logo|professional-photo|service-image)$/)
  resourceType: "business-logo" | "professional-photo" | "service-image";

  @IsString()
  @MaxLength(50)
  resourceId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  expiresIn?: string;
}

export class DeleteImageDto {
  @IsString()
  key: string;
}
