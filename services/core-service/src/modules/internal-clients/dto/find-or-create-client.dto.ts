import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class FindOrCreateClientDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
