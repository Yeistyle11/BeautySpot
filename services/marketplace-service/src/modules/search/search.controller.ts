import { Controller, Get, Query } from "@nestjs/common";
import { SearchService, SearchFilters } from "./search.service";
import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { Public } from "@beautyspot/nest-common";
import { MAX_PAGE } from "@beautyspot/shared-utils";
import { LONGITUD_MAXIMA_BUSQUEDA } from "@beautyspot/shared-constants";

/** Parámetros de la búsqueda pública: texto, ubicación, tipo, valoración mínima y paginación. */
class SearchQueryDto {
  @IsOptional() @IsString() @MaxLength(LONGITUD_MAXIMA_BUSQUEDA) q?: string;
  @IsOptional() @IsString() @MaxLength(LONGITUD_MAXIMA_BUSQUEDA) city?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() radius?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  ratingMin?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @IsString() @IsIn(["business", "professional", "all"]) type?:
    | "business"
    | "professional"
    | "all";
}

/** Endpoint público de búsqueda de negocios y profesionales en el marketplace. */
@Controller("search")
@Public()
export class SearchController {
  constructor(private readonly service: SearchService) {}

  /** Ejecuta la búsqueda con los filtros recibidos. */
  @Get()
  async search(@Query() dto: SearchQueryDto) {
    return this.service.search(dto as SearchFilters);
  }
}
