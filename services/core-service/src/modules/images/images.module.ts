import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { ServicesModule } from "../services/services.module";

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
    ProfessionalsModule,
    ServicesModule,
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
