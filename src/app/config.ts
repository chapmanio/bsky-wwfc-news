/**
 * Environment configuration types for the Cloudflare Worker
 */

export interface Env {
  // KV namespace for storing posted items
  POSTED_ITEMS: KVNamespace;

  // Bluesky credentials
  BLUESKY_IDENTIFIER: string;
  BLUESKY_PASSWORD: string;

  // YouTube API
  YOUTUBE_API_KEY: string;
  YOUTUBE_CHANNEL_ID: string;

  // Cloudinary (optional - for resizing large images)
  CLOUDINARY_CLOUD_NAME?: string;

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
