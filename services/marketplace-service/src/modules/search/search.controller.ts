import { Controller, Get, Query } from "@nestjs/common";
import { SearchService, SearchFilters } from "./search.service";
import { IsOptional, IsNumber, IsString, IsIn, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { Public } from "@beautyspot/nest-common";

class SearchQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() radius?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) ratingMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
  @IsOptional() @IsString() @IsIn(["business", "professional", "all"]) type?: "business" | "professional" | "all";
}

@Controller("search")
@Public()
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  async search(@Query() dto: SearchQueryDto) {
    return this.service.search(dto as SearchFilters);
  }
}
