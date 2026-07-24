import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

/** Resultado de una subida a S3: URL pública, clave interna e identificadores. */
export interface UploadResult {
  url: string;
  key: string;
  publicId: string;
  bucket: string;
}

/** URL presignada para que el cliente suba el archivo directo a S3, con su vencimiento. */
export interface PresignedUploadUrlResult {
  uploadUrl: string;
  publicId: string;
  key: string;
  expiresAt: Date;
}

/**
 * Encapsula el almacenamiento de imágenes en S3: subida directa desde el
 * backend, generación de URLs presignadas para el cliente, borrado y validación.
 */
@Injectable()
export class ImagesService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>("AWS_REGION", "us-east-1");
    this.bucket = this.configService.get<string>(
      "AWS_S3_BUCKET",
      "beautyspot-images"
    );
    this.cdnUrl = this.configService.get<string>("AWS_CDN_URL");

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>("AWS_ACCESS_KEY_ID", ""),
        secretAccessKey: this.configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
          ""
        ),
      },
    });
  }

  /** Sube un archivo a S3 bajo `key/{uuid}` y devuelve su URL (CDN si está configurada). */
  async uploadFile(
    file: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    const publicId = uuidv4();
    const fullKey = `${key}/${publicId}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        Body: file,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      const url = this.cdnUrl
        ? `${this.cdnUrl}/${fullKey}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fullKey}`;

      return {
        url,
        key: fullKey,
        publicId,
        bucket: this.bucket,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      throw new BadRequestException(
        `Error subiendo archivo a S3: ${errorMessage}`
      );
    }
  }

  /** Sube el logo de un negocio a su carpeta en S3. */
  async uploadBusinessLogo(
    businessId: string,
    file: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    return this.uploadFile(file, `businesses/${businessId}/logo`, contentType, {
      businessId,
      type: "logo",
    });
  }

  /** Sube la foto de un profesional a su carpeta en S3. */
  async uploadProfessionalPhoto(
    professionalId: string,
    file: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    return this.uploadFile(
      file,
      `professionals/${professionalId}/photo`,
      contentType,
      {
        professionalId,
        type: "photo",
      }
    );
  }

  /** Sube la imagen de un servicio a su carpeta en S3. */
  async uploadServiceImage(
    serviceId: string,
    file: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    return this.uploadFile(file, `services/${serviceId}/image`, contentType, {
      serviceId,
      type: "image",
    });
  }

  /** Genera una URL presignada para que el cliente suba el archivo directo a S3. */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUploadUrlResult> {
    const publicId = uuidv4();
    const fullKey = `${key}/${publicId}`;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return {
        uploadUrl,
        publicId,
        key: fullKey,
        expiresAt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      throw new BadRequestException(
        `Error generando URL presignada: ${errorMessage}`
      );
    }
  }

  /** URL presignada para subir el logo de un negocio. */
  async generatePresignedUploadUrlForBusinessLogo(
    businessId: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUploadUrlResult> {
    return this.generatePresignedUploadUrl(
      `businesses/${businessId}/logo`,
      contentType,
      expiresIn
    );
  }

  /** URL presignada para subir la foto de un profesional. */
  async generatePresignedUploadUrlForProfessionalPhoto(
    professionalId: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUploadUrlResult> {
    return this.generatePresignedUploadUrl(
      `professionals/${professionalId}/photo`,
      contentType,
      expiresIn
    );
  }

  /** URL presignada para subir la imagen de un servicio. */
  async generatePresignedUploadUrlForServiceImage(
    serviceId: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUploadUrlResult> {
    return this.generatePresignedUploadUrl(
      `services/${serviceId}/image`,
      contentType,
      expiresIn
    );
  }

  /** Borra un objeto de S3 por su clave. */
  async deleteImage(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      throw new BadRequestException(
        `Error eliminando imagen de S3: ${errorMessage}`
      );
    }
  }

  /** Devuelve una URL presignada de lectura para un objeto privado de S3. */
  async getImageUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      return url;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      throw new BadRequestException(
        `Error obteniendo URL de imagen: ${errorMessage}`
      );
    }
  }

  /** Valida que el archivo sea una imagen de tipo permitido y no exceda 5MB. */
  validateImageFile(file: Buffer, contentType: string): void {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Tipos permitidos: ${allowedTypes.join(", ")}`
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB

    if (file.length > maxSize) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo de 5MB. Tamaño actual: ${this.formatFileSize(file.length)}`
      );
    }
  }

  /** Formatea un tamaño en bytes a una cadena legible (KB, MB, GB). */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /** Extrae la clave de S3 a partir de una URL pública o de CDN. */
  extractKeyFromUrl(url: string): string {
    const urlWithoutDomain = url.replace(/^https?:\/\/[^\/]+/, "");
    const urlWithoutBucket = urlWithoutDomain.replace(
      /^\/beautyspot-images\//,
      ""
    );

    if (this.cdnUrl) {
      return urlWithoutBucket.replace(/^\//, "");
    }

    return urlWithoutBucket;
  }
}
