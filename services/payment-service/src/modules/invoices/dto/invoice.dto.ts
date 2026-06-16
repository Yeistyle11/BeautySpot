import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString } from "class-validator";
import { Type } from "class-transformer";
import { InvoiceStatus } from "@beautyspot/shared-types";

export class CreateInvoiceItemDto {
  @IsString() description!: string;
  @IsNumber() quantity!: number;
  @IsNumber() unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsString() clientId!: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateInvoiceItemDto) items!: CreateInvoiceItemDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus) status!: InvoiceStatus;
}
