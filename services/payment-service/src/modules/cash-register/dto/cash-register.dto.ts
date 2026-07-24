import { IsNumber, IsString, IsOptional, IsEnum } from "class-validator";
import { CashMovementType } from "@beautyspot/shared-types";

/** Datos para abrir una sesión de caja: saldo inicial, sede y notas opcionales. */
export class OpenSessionDto {
  @IsOptional() @IsNumber() openingAmount?: number;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() notes?: string;
}

/** Datos para cerrar una sesión de caja: saldo final contado y notas opcionales. */
export class CloseSessionDto {
  @IsNumber() closingAmount!: number;
  @IsOptional() @IsString() notes?: string;
}

/** Datos de un movimiento de caja: tipo (ingreso/egreso), monto y concepto. */
export class RegisterMovementDto {
  @IsEnum(CashMovementType) type!: CashMovementType;
  @IsNumber() amount!: number;
  @IsString() concept!: string;
}
