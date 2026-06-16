import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReviewEntity } from "../../entities/review.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import { ReviewsService } from "./reviews.service";
import { ReviewsController } from "./reviews.controller";
import { BusinessProfilesModule } from "../business-profiles/business-profiles.module";
import { ProfessionalProfilesModule } from "../professional-profiles/professional-profiles.module";
import { EventBusModule } from "@beautyspot/nest-common";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewEntity, ReviewHelpfulEntity]),
    BusinessProfilesModule,
    ProfessionalProfilesModule,
    EventBusModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
