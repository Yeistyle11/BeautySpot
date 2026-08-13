import { IsNumber, IsString, IsOptional, IsEnum, Min } from "class-validator";
import { CashMovementType } from "@beautyspot/shared-types";

/** Datos para abrir una sesión de caja: saldo inicial, sede y notas opcionales. */
export class OpenSessionDto {
  /**
   * Fondo con el que arranca el cajón. No puede ser negativo: no existe empezar
   * el día debiendo dinero al cajón, y ese importe entra en el total esperado,
   * así que un signo de más desvía el arqueo del día entero.
   */
  @IsOptional()
  @IsNumber()
  @Min(0, { message: "El monto inicial no puede ser negativo" })
  openingAmount?: number;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() notes?: string;
}

/** Datos para cerrar una sesión de caja: saldo final contado y notas opcionales. */
export class CloseSessionDto {
  /** Lo que el cajero cuenta en el cajón; cero es un cierre válido. */
  @IsNumber()
  @Min(0, { message: "El monto contado no puede ser negativo" })
  closingAmount!: number;
  @IsOptional() @IsString() notes?: string;
}

/** Datos de un movimiento de caja: tipo (ingreso/egreso), monto y concepto. */
export class RegisterMovementDto {
  @IsEnum(CashMovementType) type!: CashMovementType;
  /** El sentido lo da `type`; el importe siempre se escribe en positivo. */
  @IsNumber()
  @Min(0, { message: "El monto del movimiento no puede ser negativo" })
  amount!: number;
  @IsString() concept!: string;
}
