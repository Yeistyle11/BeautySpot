import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { BusinessId, Internal, Public, Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  MAXIMO_BYTES_IMAGEN,
  PREFIJO_DE_IMAGENES,
} from "@beautyspot/shared-constants";
import { ImagesService, ImagenSubida } from "./images.service";
import { DescartarImagenesDto, SubirImagenDto } from "./images.dto";

/**
 * Recepción del archivo en memoria, cortada por multer en cuanto supera el
 * tamaño máximo en vez de leerlo entero.
 */
const SUBIDA_DE_IMAGEN = FileInterceptor("archivo", {
  limits: { fileSize: MAXIMO_BYTES_IMAGEN, files: 1, fields: 5 },
});

/** Un año: cada archivo tiene nombre propio y no cambia nunca. */
const CACHE_INMUTABLE = "public, max-age=31536000, immutable";

/** Subida de imágenes del negocio desde el panel. */
@Controller("images")
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  @UseInterceptors(SUBIDA_DE_IMAGEN)
  async subir(
    @BusinessId() businessId: string,
    @Body() dto: SubirImagenDto,
    @UploadedFile() archivo?: Express.Multer.File
  ): Promise<ImagenSubida> {
    return this.images.subir(archivo?.buffer, dto.proposito, businessId);
  }
}

/** Las imágenes que se muestran en el panel y en el escaparate, sin sesión. */
@Public()
@Controller("public/images")
export class PublicImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get("negocios/:negocio/:proposito/:archivo")
  async leer(
    @Param("negocio") negocio: string,
    @Param("proposito") proposito: string,
    @Param("archivo") archivo: string,
    @Headers("if-none-match") etagDelNavegador: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const etag = `"${archivo}"`;
    res.setHeader("Cache-Control", CACHE_INMUTABLE);
    res.setHeader("ETag", etag);
    if (etagDelNavegador === etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    const datos = await this.images.leer(
      `${PREFIJO_DE_IMAGENES}negocios/${negocio}/${proposito}/${archivo}`
    );
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(datos);
  }
}

/** Limpieza que piden otros servicios al dejar imágenes sin uso. */
@Internal()
@Controller("internal/images")
export class InternalImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post("descartar")
  @HttpCode(HttpStatus.NO_CONTENT)
  async descartar(@Body() dto: DescartarImagenesDto): Promise<void> {
    await this.images.descartar(dto.urls, dto.businessId);
  }
}
