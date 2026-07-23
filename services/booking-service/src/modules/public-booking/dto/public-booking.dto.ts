import {
  IsString,
  IsArray,
  IsDateString,
  IsOptional,
  IsEmail,
} from "class-validator";

export class PublicBookingDto {
  @IsString() businessId!: string;
  @IsString() professionalId!: string;
  @IsArray() serviceIds!: {
    id: string;
    name: string;
    price: number;
    duration: number;
  }[];
  @IsDateString() date!: string;
  @IsString() startTime!: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() guestName!: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() guestPhone?: string;
}
