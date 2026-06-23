import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException } from '@nestjs/common';
import { ImagesService } from './images.service';

describe('ImagesService', () => {
  let service: ImagesService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockS3Client: jest.Mocked<S3Client>;
  let mockGetSignedUrl: jest.Mock;
  let mockS3Send: jest.Mock;

  beforeEach(async () => {
    mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
    
    mockGetSignedUrl = jest.fn().mockImplementation(async (_client, _command, options) => {
      if (options?.expiresIn) {
        return `https://presigned-url.com?expires=${options.expiresIn}`;
      }
      return 'https://presigned-url.com';
    });
    (getSignedUrl as jest.Mock) = mockGetSignedUrl;

    mockS3Client = {
      send: mockS3Send,
    } as any;

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: any = {
          AWS_REGION: 'us-east-1',
          AWS_S3_BUCKET: 'beautyspot-images',
          AWS_ACCESS_KEY_ID: 'test-access-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret-key',
          AWS_CDN_URL: 'https://cdn.beautyspot.com',
        };
        return config[key] || key;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);

    (service as any).s3Client = mockS3Client;
  });

  describe('constructor', () => {
    it('debería inicializar el servicio con configuración correcta', () => {
      expect((service as any).region).toBe('us-east-1');
      expect((service as any).bucket).toBe('beautyspot-images');
      expect((service as any).cdnUrl).toBe('https://cdn.beautyspot.com');
    });

    it('debería usar valores por defecto cuando la configuración no está disponible', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'AWS_CDN_URL') return undefined;
        return key === 'AWS_REGION' ? 'us-east-1' : key;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImagesService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const defaultService = module.get<ImagesService>(ImagesService);
      expect((defaultService as any).cdnUrl).toBeUndefined();
    });
  });

  describe('uploadFile', () => {
    const mockFile = Buffer.from('test-file-content');
    const mockKey = 'test-key';
    const mockContentType = 'image/jpeg';

    it('debería subir archivo exitosamente', async () => {
      const result = await service.uploadFile(mockFile, mockKey, mockContentType);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      const command = mockS3Send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('publicId');
      expect(result).toHaveProperty('bucket');
      expect(result.url).toContain('https://cdn.beautyspot.com');
    });

    it('debería incluir metadata en el upload', async () => {
      const metadata = { businessId: 'business-123', type: 'logo' };
      const mockFile = Buffer.from('file-content');

      await service.uploadFile(mockFile, 'test-key', 'image/jpeg', metadata);

      expect(mockS3Send).toHaveBeenCalled();
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it('debería lanzar BadRequestException cuando falla el upload', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 upload failed'));

      await expect(
        service.uploadFile(mockFile, mockKey, mockContentType)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.uploadFile(mockFile, mockKey, mockContentType)
      ).rejects.toThrow('Error subiendo archivo a S3: S3 upload failed');
    });

    it('debería usar URL de S3 cuando no hay CDN configurada', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: any = {
          AWS_REGION: 'us-east-1',
          AWS_S3_BUCKET: 'beautyspot-images',
          AWS_ACCESS_KEY_ID: 'test-access-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret-key',
          AWS_CDN_URL: undefined,
        };
        return config[key] || undefined;
      });

      const serviceNoCdn = new ImagesService(mockConfigService);
      (serviceNoCdn as any).s3Client = mockS3Client;

      const mockFile = Buffer.from('file-content');
      const result = await serviceNoCdn.uploadFile(mockFile, 'test-key', 'image/jpeg');

      expect(result.url).toContain('beautyspot-images.s3.us-east-1.amazonaws.com');
    });
  });

  describe('uploadBusinessLogo', () => {
    it('debería subir logo de negocio con key correcto', async () => {
      const businessId = 'business-123';
      const mockFile = Buffer.from('logo-content');

      const result = await service.uploadBusinessLogo(businessId, mockFile, 'image/png');

      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.key).toContain(`businesses/${businessId}/logo`);
    });
  });

  describe('uploadProfessionalPhoto', () => {
    it('debería subir foto de profesional con key correcto', async () => {
      const professionalId = 'professional-123';
      const mockFile = Buffer.from('photo-content');

      const result = await service.uploadProfessionalPhoto(professionalId, mockFile, 'image/jpeg');

      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.key).toContain(`professionals/${professionalId}/photo`);
    });
  });

  describe('uploadServiceImage', () => {
    it('debería subir imagen de servicio con key correcto', async () => {
      const serviceId = 'service-123';
      const mockFile = Buffer.from('image-content');

      const result = await service.uploadServiceImage(serviceId, mockFile, 'image/webp');

      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.key).toContain(`services/${serviceId}/image`);
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('debería generar URL presignada exitosamente', async () => {
      const result = await service.generatePresignedUploadUrl('test-key', 'image/jpeg');

      expect(result).toBeDefined();
    });

    it('debería usar expiresIn personalizado', async () => {
      const result = await service.generatePresignedUploadUrl('test-key', 'image/jpeg', 7200);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        expect.objectContaining({ expiresIn: 7200 })
      );
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('debería lanzar BadRequestException cuando falla la generación', async () => {
      const mockKey = 'test-key';
      const mockContentType = 'image/jpeg';
      mockGetSignedUrl.mockRejectedValue(new Error('Generation failed'));

      await expect(
        service.generatePresignedUploadUrl(mockKey, mockContentType)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generatePresignedUploadUrl(mockKey, mockContentType)
      ).rejects.toThrow('Error generando URL presignada: Generation failed');
    });
  });

  describe('generatePresignedUploadUrlForBusinessLogo', () => {
    it('debería generar URL presignada para logo de negocio', async () => {
      const businessId = 'business-123';

      const result = await service.generatePresignedUploadUrlForBusinessLogo(businessId, 'image/png');

      expect(result).toBeDefined();
      expect(result.key).toContain(`businesses/${businessId}/logo`);
      expect(result.uploadUrl).toBeDefined();
    });
  });

  describe('generatePresignedUploadUrlForProfessionalPhoto', () => {
    it('debería generar URL presignada para foto de profesional', async () => {
      const professionalId = 'professional-123';

      const result = await service.generatePresignedUploadUrlForProfessionalPhoto(professionalId, 'image/jpeg');

      expect(result).toBeDefined();
      expect(result.key).toContain(`professionals/${professionalId}/photo`);
      expect(result.uploadUrl).toBeDefined();
    });
  });

  describe('generatePresignedUploadUrlForServiceImage', () => {
    it('debería generar URL presignada para imagen de servicio', async () => {
      const serviceId = 'service-123';

      const result = await service.generatePresignedUploadUrlForServiceImage(serviceId, 'image/webp');

      expect(result).toBeDefined();
      expect(result.key).toContain(`services/${serviceId}/image`);
      expect(result.uploadUrl).toBeDefined();
    });
  });

  describe('deleteImage', () => {
    it('debería eliminar imagen exitosamente', async () => {
      await service.deleteImage('test-key/test-public-id');

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      const command = mockS3Send.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
    });

    it('debería lanzar BadRequestException cuando falla la eliminación', async () => {
      mockS3Send.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteImage('test-key')).rejects.toThrow(BadRequestException);
      await expect(service.deleteImage('test-key')).rejects.toThrow('Error eliminando imagen de S3: Delete failed');
    });
  });

  describe('getImageUrl', () => {
    it('debería generar URL presignada para obtener imagen', async () => {
      await service.getImageUrl('test-key/test-public-id');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        expect.objectContaining({ expiresIn: 3600 })
      );
    });

    it('debería usar expiresIn personalizado', async () => {
      await service.getImageUrl('test-key', 7200);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        expect.objectContaining({ expiresIn: 7200 })
      );
    });

    it('debería usar expiresIn personalizado', async () => {
      await service.getImageUrl('test-key', 7200);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        expect.objectContaining({ expiresIn: 7200 })
      );
    });

    it('debería lanzar BadRequestException cuando falla la generación', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('Get URL failed'));

      await expect(service.getImageUrl('test-key')).rejects.toThrow(BadRequestException);
      await expect(service.getImageUrl('test-key')).rejects.toThrow('Error obteniendo URL de imagen: Get URL failed');
    });
  });

  describe('validateImageFile', () => {
    const validFile = Buffer.from('test');
    const largeFile = Buffer.alloc(6 * 1024 * 1024);

    it('debería validar archivo JPEG exitosamente', () => {
      expect(() => {
        service.validateImageFile(validFile, 'image/jpeg');
      }).not.toThrow();
    });

    it('debería validar archivo PNG exitosamente', () => {
      expect(() => {
        service.validateImageFile(validFile, 'image/png');
      }).not.toThrow();
    });

    it('debería validar archivo WebP exitosamente', () => {
      expect(() => {
        service.validateImageFile(validFile, 'image/webp');
      }).not.toThrow();
    });

    it('debería validar archivo GIF exitosamente', () => {
      expect(() => {
        service.validateImageFile(validFile, 'image/gif');
      }).not.toThrow();
    });

    it('debería lanzar BadRequestException para tipo de archivo no permitido', () => {
      expect(() => {
        service.validateImageFile(validFile, 'application/pdf');
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateImageFile(validFile, 'application/pdf');
      }).toThrow('Tipo de archivo no permitido');
    });

    it('debería lanzar BadRequestException para archivo que excede tamaño máximo', () => {
      expect(() => {
        service.validateImageFile(largeFile, 'image/jpeg');
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateImageFile(largeFile, 'image/jpeg');
      }).toThrow('El archivo excede el tamaño máximo de 5MB');
    });
  });

  describe('extractKeyFromUrl', () => {
    it('debería extraer key de URL con CDN', () => {
      const url = 'https://cdn.beautyspot.com/businesses/123/logo/uuid';
      const key = service.extractKeyFromUrl(url);

      expect(key).toBe('businesses/123/logo/uuid');
    });

    it('debería extraer key de URL de S3 directa', () => {
      const url = 'https://beautyspot-images.s3.us-east-1.amazonaws.com/businesses/123/logo/uuid';
      const key = service.extractKeyFromUrl(url);

      expect(key).toBe('businesses/123/logo/uuid');
    });

    it('debería manejar URLs con diferentes formatos', () => {
      const url1 = 'https://cdn.beautyspot.com/test/path/file.jpg';
      expect(service.extractKeyFromUrl(url1)).toBe('test/path/file.jpg');

      const url2 = 'https://beautyspot-images.s3.us-east-1.amazonaws.com/test/path/file.jpg';
      expect(service.extractKeyFromUrl(url2)).toBe('test/path/file.jpg');
    });
  });

  describe('formatFileSize (privado)', () => {
    it('debería formatear Bytes correctamente', () => {
      expect((service as any).formatFileSize(0)).toBe('0 Bytes');
    });

    it('debería formatear KB correctamente', () => {
      const result = (service as any).formatFileSize(1024);
      expect(result).toContain('KB');
    });

    it('debería formatear MB correctamente', () => {
      const result = (service as any).formatFileSize(1024 * 1024);
      expect(result).toContain('MB');
    });

    it('debería formatear GB correctamente', () => {
      const result = (service as any).formatFileSize(1024 * 1024 * 1024);
      expect(result).toContain('GB');
    });
  });
});