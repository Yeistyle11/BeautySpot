import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { OutboxModule, HealthModule } from "@beautyspot/nest-common";
import { entities } from "./orm-entities";
import { BusinessProfilesModule } from "./modules/business-profiles/business-profiles.module";
import { SearchModule } from "./modules/search/search.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { ProfessionalProfilesModule } from "./modules/professional-profiles/professional-profiles.module";
import { FeedModule } from "./modules/feed/feed.module";
import { MarketplaceEventListenersModule } from "./modules/event-listeners/marketplace-event-listeners.module";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    HealthModule,
    OutboxModule,
    BusinessProfilesModule,
    SearchModule,
    ReviewsModule,
    ProfessionalProfilesModule,
    FeedModule,
    MarketplaceEventListenersModule,
  ],
})
/** Módulo raíz del marketplace-service: perfiles públicos, reseñas, feed y búsqueda. */
export class AppModule {}
