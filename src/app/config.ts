/**
 * Environment configuration types for the Cloudflare Worker
 */

/**
 * Cloudflare Images binding type
 * @see https://developers.cloudflare.com/images/transform-images/bindings/
 */
export interface ImagesBinding {
  /**
   * Transform an image with the specified options
   */
  transform(
    image: ReadableStream | ArrayBuffer | Blob,
    options: {
      width?: number;
      height?: number;
      fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
      quality?: number;
      format?: 'webp' | 'avif' | 'jpeg' | 'png';
    }
  ): Promise<ReadableStream>;
}

export interface Env {
  // KV namespace for storing posted items
  POSTED_ITEMS: KVNamespace;

  // Cloudflare Images binding for image resizing (optional)
  IMAGES?: ImagesBinding;

  // Bluesky credentials
  BLUESKY_IDENTIFIER: string;
  BLUESKY_PASSWORD: string;

  // YouTube API
  YOUTUBE_API_KEY: string;
  YOUTUBE_CHANNEL_ID: string;

  // Sentry (optional)
  SENTRY_DSN?: string;
}

/**
 * Base URL for the WWFC website
 */
export const WWFC_BASE_URL = 'https://www.wwfc.com';

/**
 * WWFC API base URL
 */
export const WWFC_API_URL = 'https://webapi.gc.wycombewanderersfcservices.co.uk/v1/';
