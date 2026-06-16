import { IsDateString } from "class-validator";

export class DateRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
