import { IsString, IsOptional, IsArray } from "class-validator";

export class CreateClientDto {
  @IsString() name!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsArray() tags?: string[];
}
