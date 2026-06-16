import { IsString, IsOptional, IsDateString } from "class-validator";

export class CreateBlockedSlotDto {
  @IsDateString() date!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsString() reason?: string;
}
