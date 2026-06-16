import { IsString, IsOptional, IsArray, IsDateString, IsNumber, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class AppointmentServiceItemDto {
  @IsString() id!: string;
  @IsString() name!: string;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @Min(5) duration!: number;
}

export class CreateAppointmentDto {
  @IsString() professionalId!: string;
  @IsString() clientId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentServiceItemDto)
  serviceIds!: AppointmentServiceItemDto[];
  @IsDateString() date!: string;
  @IsString() startTime!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() branchId?: string;
}

export class CancelDto {
  @IsString() reason!: string;
}

export class RescheduleDto {
  @IsDateString() date!: string;
  @IsString() startTime!: string;
}
