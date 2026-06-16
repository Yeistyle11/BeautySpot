import { IsString, IsNumber, IsOptional, IsDateString } from "class-validator";

export class UpsertDailyMetricDto {
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() totalAppointments?: number;
  @IsOptional() @IsNumber() completedAppointments?: number;
  @IsOptional() @IsNumber() cancelledAppointments?: number;
  @IsOptional() @IsNumber() noShowAppointments?: number;
  @IsOptional() @IsNumber() totalRevenue?: number;
  @IsOptional() @IsNumber() newClients?: number;
  @IsOptional() @IsNumber() returningClients?: number;
}

export class UpsertProfessionalMetricDto {
  @IsString() professionalId!: string;
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() appointments?: number;
  @IsOptional() @IsNumber() revenue?: number;
  @IsOptional() @IsNumber() rating?: number;
  @IsOptional() @IsNumber() avgServiceTime?: number;
}
