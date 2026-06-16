import { IsString, IsOptional, IsNumber, IsArray, IsUrl } from "class-validator";

export class CreateProfessionalDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() category?: string;
  @IsArray() specialties!: string[];
  @IsOptional() @IsNumber() yearsExp?: number;
  @IsOptional() @IsUrl() photo?: string;
}

export class AssignServiceDto {
  @IsString() serviceId!: string;
  @IsOptional() @IsNumber() customPrice?: number;
  @IsOptional() @IsNumber() customDuration?: number;
}
