import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReviewEntity } from "../../entities/review.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import { ReviewsService } from "./reviews.service";
import { ReviewsController } from "./reviews.controller";
import { BusinessProfilesModule } from "../business-profiles/business-profiles.module";
import { ProfessionalProfilesModule } from "../professional-profiles/professional-profiles.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewEntity, ReviewHelpfulEntity]),
    BusinessProfilesModule,
    ProfessionalProfilesModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
/** Cablea la gestión de reseñas y votos de utilidad. */
export class ReviewsModule {}
