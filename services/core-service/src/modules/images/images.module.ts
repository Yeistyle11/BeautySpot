import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ImagesController,
  InternalImagesController,
  PublicImagesController,
} from "./images.controller";
import { ImagesService } from "./images.service";
import { AlmacenDeImagenes, crearAlmacen } from "./almacen-de-imagenes";

@Module({
  controllers: [
    ImagesController,
    PublicImagesController,
    InternalImagesController,
  ],
  providers: [
    ImagesService,
    {
      provide: AlmacenDeImagenes,
      inject: [ConfigService],
      useFactory: crearAlmacen,
    },
  ],
  exports: [ImagesService],
})
/** Cablea la subida, lectura y descarte de imágenes de los negocios. */
export class ImagesModule {}
