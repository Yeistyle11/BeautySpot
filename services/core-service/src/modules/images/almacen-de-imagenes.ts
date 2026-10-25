import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";

/**
 * Almacén de los archivos de imagen, por clave
 * (`negocios/{id}/{propósito}/{archivo}.webp`).
 */
export abstract class AlmacenDeImagenes {
  abstract guardar(clave: string, datos: Buffer): Promise<void>;
  /** El archivo, o null si no existe. */
  abstract leer(clave: string): Promise<Buffer | null>;
  /** Borra el archivo; no falla si no existe. */
  abstract borrar(clave: string): Promise<void>;
}

/** Imágenes en un directorio del servidor (en producción, un volumen). */
export class AlmacenEnDisco extends AlmacenDeImagenes {
  private readonly raiz: string;

  constructor(raiz: string) {
    super();
    this.raiz = resolve(raiz);
  }

  async guardar(clave: string, datos: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    // Se escribe aparte y se renombra: quien lea a la vez ve el archivo entero
    // o ninguno, nunca uno a medias.
    const temporal = `${ruta}.${randomUUID()}.tmp`;
    await writeFile(temporal, datos);
    await rename(temporal, ruta);
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      return await readFile(this.ruta(clave));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true });
  }

  /** Ruta absoluta de la clave, sin dejar que se salga del directorio. */
  private ruta(clave: string): string {
    const ruta = resolve(this.raiz, clave);
    if (!ruta.startsWith(this.raiz + sep)) {
      throw new Error(`Clave de imagen fuera del almacén: ${clave}`);
    }
    return ruta;
  }
}

/** Imágenes en un bucket compatible con S3 (AWS, Cloudflare R2, MinIO). */
export class AlmacenEnS3 extends AlmacenDeImagenes {
  constructor(
    private readonly cliente: S3Client,
    private readonly bucket: string
  ) {
    super();
  }

  async guardar(clave: string, datos: Buffer): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: datos,
        ContentType: "image/webp",
      })
    );
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      const respuesta = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: clave })
      );
      if (!respuesta.Body) return null;
      return Buffer.from(await respuesta.Body.transformToByteArray());
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async borrar(clave: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: clave })
    );
  }
}

/**
 * El almacén que pide la configuración: `MEDIA_DRIVER=s3` usa el bucket de
 * `AWS_*` (con `AWS_ENDPOINT` para R2 o MinIO); si no, disco en `MEDIA_DIR`.
 */
export function crearAlmacen(config: ConfigService): AlmacenDeImagenes {
  if (config.get<string>("MEDIA_DRIVER") === "s3") {
    const endpoint = config.get<string>("AWS_ENDPOINT");
    const cliente = new S3Client({
      region: config.get<string>("AWS_REGION", "auto"),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.get<string>("AWS_ACCESS_KEY_ID", ""),
        secretAccessKey: config.get<string>("AWS_SECRET_ACCESS_KEY", ""),
      },
    });
    return new AlmacenEnS3(
      cliente,
      config.get<string>("AWS_S3_BUCKET", "beautyspot-media")
    );
  }
  return new AlmacenEnDisco(config.get<string>("MEDIA_DIR", "./media"));
}
