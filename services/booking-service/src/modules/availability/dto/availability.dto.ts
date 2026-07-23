import {
  IsNumber,
  IsString,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class SlotDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
}

export class ReplaceAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}
