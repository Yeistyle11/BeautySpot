import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from "class-validator";

export class IncrementDailyMetricDto {
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() @Min(0) totalAppointments?: number;
  @IsOptional() @IsNumber() @Min(0) completedAppointments?: number;
  @IsOptional() @IsNumber() @Min(0) cancelledAppointments?: number;
  @IsOptional() @IsNumber() @Min(0) noShowAppointments?: number;
  @IsOptional() @IsNumber() @Min(0) totalRevenue?: number;
  @IsOptional() @IsNumber() @Min(0) newClients?: number;
  @IsOptional() @IsNumber() @Min(0) returningClients?: number;
}

export class IncrementProfessionalMetricDto {
  @IsString() professionalId!: string;
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() @Min(0) appointments?: number;
  @IsOptional() @IsNumber() @Min(0) revenue?: number;
}
