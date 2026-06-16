import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_INTERCEPTOR } from "@nestjs/core";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { BusinessProfilesModule } from "./modules/business-profiles/business-profiles.module";
import { SearchModule } from "./modules/search/search.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { ProfessionalProfilesModule } from "./modules/professional-profiles/professional-profiles.module";
import { FeedModule } from "./modules/feed/feed.module";
import { BusinessProfileEntity } from "./entities/business-profile.entity";
import { ReviewEntity } from "./entities/review.entity";
import { ProfessionalProfileEntity } from "./entities/professional-profile.entity";
import { ReviewHelpfulEntity } from "./entities/review-helpful.entity";
import { TenantQueryInterceptor } from "@beautyspot/nest-common";
 
const entities = [
   BusinessProfileEntity,
   ReviewEntity,
   ProfessionalProfileEntity,
   ReviewHelpfulEntity,
 ];
 
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, "..", ".env") }),
    TypeOrmModule.forRootAsync({ useFactory: () => createTypeOrmModuleOptions(entities) }),
    BusinessProfilesModule,
    SearchModule,
    ReviewsModule,
    ProfessionalProfilesModule,
    FeedModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantQueryInterceptor,
    },
  ],
})
export class AppModule {}
