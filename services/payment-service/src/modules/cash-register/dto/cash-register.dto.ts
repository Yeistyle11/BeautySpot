import { IsNumber, IsString, IsOptional, IsEnum } from "class-validator";
import { CashMovementType } from "@beautyspot/shared-types";

export class OpenSessionDto {
  @IsOptional() @IsNumber() openingAmount?: number;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CloseSessionDto {
  @IsNumber() closingAmount!: number;
  @IsOptional() @IsString() notes?: string;
}

export class RegisterMovementDto {
  @IsEnum(CashMovementType) type!: CashMovementType;
  @IsNumber() amount!: number;
  @IsString() concept!: string;
}
