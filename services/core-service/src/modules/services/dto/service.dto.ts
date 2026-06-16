import { IsString, IsNumber, IsOptional, Min } from "class-validator";

export class CreateServiceDto {
  @IsString() name!: string;
  @IsString() description!: string;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @Min(5) duration!: number;
  @IsString() category!: string;
  @IsOptional() @IsString() image?: string;
}
