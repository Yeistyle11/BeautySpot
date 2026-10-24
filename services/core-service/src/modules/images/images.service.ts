import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { claveDeImagenPropia } from "@beautyspot/nest-common";
import {
  PREFIJO_DE_IMAGENES,
  type PropositoDeImagen,
} from "@beautyspot/shared-constants";
import { AlmacenDeImagenes } from "./almacen-de-imagenes";
import { procesarImagen } from "./procesado-de-imagen";

/** Lo que responde una subida: la URL que el formulario guarda después. */
export interface ImagenSubida {
  url: string;
  ancho: number;
  alto: number;
}

/**
 * Subida, lectura y descarte de las imágenes de los negocios. Subir no cambia
 * ninguna entidad: devuelve la URL y quien la quiera la guarda con su PATCH.
 */
@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(private readonly almacen: AlmacenDeImagenes) {}

  async subir(
    archivo: Buffer | undefined,
    proposito: PropositoDeImagen,
    businessId: string | undefined
  ): Promise<ImagenSubida> {
    if (!archivo?.length) {
      throw new BadRequestException("Falta la imagen");
    }
    if (!businessId) {
      throw new BadRequestException("No se pudo determinar el negocio");
    }

    const imagen = await procesarImagen(archivo, proposito);
    // Un nombre nuevo en cada subida: el archivo nunca cambia, así que se puede
    // cachear para siempre, y no dice nada de quien lo subió.
    const clave = `negocios/${businessId}/${proposito}/${randomUUID()}.webp`;
    await this.almacen.guardar(clave, imagen.datos);

    return {
      url: `${PREFIJO_DE_IMAGENES}${clave}`,
      ancho: imagen.ancho,
      alto: imagen.alto,
    };
  }

  /** El archivo de una imagen propia; 404 si la URL no es de las nuestras. */
  async leer(url: string): Promise<Buffer> {
    const propia = claveDeImagenPropia(url);
    const datos = propia ? await this.almacen.leer(propia.clave) : null;
    if (!datos) throw new NotFoundException("Imagen no encontrada");
    return datos;
  }

  /**
   * Borra las imágenes que ya no usa el negocio. Solo toca las suyas, y un
   * fallo se registra sin propagarse: el cambio que las dejó sin uso ya está
   * guardado, y un archivo de más no rompe nada.
   */
  async descartar(urls: string[], businessId: string): Promise<void> {
    for (const url of urls) {
      const propia = claveDeImagenPropia(url);
      if (propia?.businessId !== businessId) continue;
      try {
        await this.almacen.borrar(propia.clave);
      } catch (error) {
        this.logger.warn(
          `No se pudo borrar ${propia.clave}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
