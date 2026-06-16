import { Controller, Get, Query } from "@nestjs/common";
import { FeedService } from "./feed.service";
import { IsOptional, IsNumber, IsString } from "class-validator";
import { Type } from "class-transformer";
import { Public } from "@beautyspot/nest-common";

class FeedQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @IsString() city?: string;
}

@Controller("feed")
@Public()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  async getFeed(@Query() query: FeedQueryDto) {
    return this.feedService.getFeed(query.lat, query.lng, query.city);
  }
}
