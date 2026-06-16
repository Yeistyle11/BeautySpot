import { IsNumber, IsString, IsOptional, IsBoolean, Min, Max, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class BusinessHourItemDto {
  @IsOptional() @IsString() branchId?: string;

  @Type(() => Number) @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;

  @IsString() openTime!: string;

  @IsString() closeTime!: string;

  @IsOptional() @IsBoolean() active?: boolean;
}

export class BatchUpsertDto {
  @ValidateNested({ each: true })
  @Type(() => BusinessHourItemDto)
  hours!: BusinessHourItemDto[];
}
