import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppDomainError } from '../../common/api-error.filter.js';

export interface ValidatedImageInfo {
  format: 'jpeg' | 'png' | 'webp';
  mimeType: string;
  sizeBytes: number;
}

export interface UploadResult {
  publicId: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
  isMock: boolean;
}

@Injectable()
export class CloudinaryMediaService {
  private readonly logger = new Logger(CloudinaryMediaService.name);
  private readonly cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  private readonly apiKey = process.env.CLOUDINARY_API_KEY;
  private readonly apiSecret = process.env.CLOUDINARY_API_SECRET;

  /**
   * Reports whether live Cloudinary credentials are configured on the server.
   * Credentials must NEVER be logged or returned to the browser.
   */
  isConfigured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  /**
   * Validates file size, declared MIME type, and binary file signatures (magic bytes)
   * to strictly prevent extension spoofing and malicious file uploads.
   */
  validateImageBuffer(buffer: Buffer, declaredMimeType?: string): ValidatedImageInfo {
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
    if (buffer.length === 0) {
      throw new AppDomainError('INVALID_IMAGE', 'Uploaded image file is empty.', 400);
    }
    if (buffer.length > maxSizeBytes) {
      throw new AppDomainError(
        'IMAGE_TOO_LARGE',
        'Image file exceeds the 5MB size limit.',
        400,
      );
    }

    // Inspect Magic Bytes
    let detectedFormat: 'jpeg' | 'png' | 'webp' | null = null;
    let detectedMime = '';

    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      detectedFormat = 'jpeg';
      detectedMime = 'image/jpeg';
    } else if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      detectedFormat = 'png';
      detectedMime = 'image/png';
    } else if (
      buffer.length >= 12 &&
      buffer.toString('utf8', 0, 4) === 'RIFF' &&
      buffer.toString('utf8', 8, 12) === 'WEBP'
    ) {
      detectedFormat = 'webp';
      detectedMime = 'image/webp';
    }

    if (!detectedFormat) {
      throw new AppDomainError(
        'INVALID_IMAGE_SIGNATURE',
        'Unsupported image format. Only authentic JPEG, PNG, and WebP images are permitted.',
        400,
      );
    }

    if (declaredMimeType && declaredMimeType !== detectedMime && declaredMimeType !== 'image/jpg') {
      throw new AppDomainError(
        'MIME_MISMATCH',
        `Declared file MIME type (${declaredMimeType}) does not match actual binary image format (${detectedMime}).`,
        400,
      );
    }

    return {
      format: detectedFormat,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Uploads an authenticated vendor's product image.
   * If Cloudinary credentials are not configured, fails closed in production or provides
   * a safe, deterministic local placeholder for development while logging the status.
   */
  async uploadProductImage(
    buffer: Buffer,
    opts: {
      vendorId: string;
      productId: string;
      declaredMimeType?: string;
    },
  ): Promise<UploadResult> {
    const validated = this.validateImageBuffer(buffer, opts.declaredMimeType);
    const sanitizedId = `wb_prod_${opts.productId.replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}`;

    // If live credentials are NOT set:
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppDomainError(
          'MEDIA_SERVICE_UNAVAILABLE',
          'Cloudinary media storage is currently unavailable. Please configure server credentials.',
          503,
        );
      }

      // Safe local development fallback:
      const base64Data = buffer.toString('base64');
      const dataUrl = `data:${validated.mimeType};base64,${base64Data}`;
      this.logger.warn(
        `Cloudinary credentials not configured. Using local data URI for product ${opts.productId}`,
      );

      return {
        publicId: `dev_${sanitizedId}`,
        url: dataUrl,
        format: validated.format,
        width: 800,
        height: 800,
        isMock: true,
      };
    }

    // Authenticated Cloudinary REST upload
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `wear-birgunj/products/${opts.vendorId}`;
    const paramsToSign = `folder=${folder}&public_id=${sanitizedId}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: validated.mimeType });
    formData.append('file', blob, `${sanitizedId}.${validated.format}`);
    formData.append('api_key', this.apiKey!);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('public_id', sanitizedId);
    formData.append('signature', signature);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Cloudinary upload failed: ${response.status} - ${errorText}`);
        throw new AppDomainError(
          'CLOUDINARY_UPLOAD_FAILED',
          'Failed to upload image to cloud storage provider.',
          502,
        );
      }

      const data: any = await response.json();
      return {
        publicId: data.public_id,
        url: data.secure_url || data.url,
        format: data.format || validated.format,
        width: data.width,
        height: data.height,
        isMock: false,
      };
    } catch (err: any) {
      if (err instanceof AppDomainError) throw err;
      this.logger.error('Unexpected Cloudinary network error', err);
      throw new AppDomainError(
        'CLOUDINARY_NETWORK_ERROR',
        'Could not connect to Cloudinary media service.',
        502,
      );
    }
  }

  /**
   * Deletes an image from Cloudinary if configured.
   */
  async deleteProductImage(publicId: string): Promise<boolean> {
    if (!this.isConfigured() || publicId.startsWith('dev_')) {
      return true;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', this.apiKey!);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
        {
          method: 'POST',
          body: formData,
        },
      );
      return response.ok;
    } catch (err) {
      this.logger.warn(`Failed to destroy Cloudinary asset ${publicId}:`, err);
      return false;
    }
  }
}
