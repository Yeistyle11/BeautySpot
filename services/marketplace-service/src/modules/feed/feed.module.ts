import { Module } from "@nestjs/common";
import { FeedService } from "./feed.service";
import { FeedController } from "./feed.controller";
import { BusinessProfilesModule } from "../business-profiles/business-profiles.module";
import { ProfessionalProfilesModule } from "../professional-profiles/professional-profiles.module";

@Module({
  imports: [BusinessProfilesModule, ProfessionalProfilesModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
/** Cablea el feed de la home del marketplace. */
export class FeedModule {}
