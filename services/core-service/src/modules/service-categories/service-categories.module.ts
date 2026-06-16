import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceCategoryEntity } from "../../entities/service-category.entity";
import { ServiceCategoriesService } from "./service-categories.service";
import { ServiceCategoriesController } from "./service-categories.controller";

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCategoryEntity])],
  controllers: [ServiceCategoriesController],
  providers: [ServiceCategoriesService],
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}
