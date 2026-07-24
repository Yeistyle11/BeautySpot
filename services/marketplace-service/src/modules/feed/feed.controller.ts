import { Controller, Get, Query } from "@nestjs/common";
import { FeedService } from "./feed.service";
import { IsOptional, IsNumber, IsString } from "class-validator";
import { Type } from "class-transformer";
import { Public } from "@beautyspot/nest-common";

/** Parámetros opcionales del feed: ubicación (lat/lng) y ciudad para personalizarlo. */
class FeedQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @IsString() city?: string;
}

/** Endpoint público del feed de la home del marketplace. */
@Controller("feed")
@Public()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /** Devuelve el feed curado, personalizado por ubicación si se indica. */
  @Get()
  async getFeed(@Query() query: FeedQueryDto) {
    return this.feedService.getFeed(query.lat, query.lng, query.city);
  }
}
