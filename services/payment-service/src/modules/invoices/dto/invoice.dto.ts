import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { EsFechaSola } from "@beautyspot/nest-common";
import { Type } from "class-transformer";
import { InvoiceStatus } from "@beautyspot/shared-types";

/** Línea de una factura a crear: descripción, cantidad y precio unitario. */
export class CreateInvoiceItemDto {
  @IsString() description!: string;
  @IsNumber() quantity!: number;
  @IsNumber() unitPrice!: number;
}

/**
 * Datos para crear una factura. Dos caminos: desde un cobro registrado
 * (`paymentId`, y el cliente y las líneas salen de él) o a mano, con el cliente
 * y las líneas escritas.
 */
export class CreateInvoiceDto {
  @IsOptional() @IsUUID() paymentId?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @EsFechaSola() date?: string;
  @IsOptional() @EsFechaSola() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];
}

/** Nuevo estado a asignar a una factura. */
export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus) status!: InvoiceStatus;
}
