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

  // Sentry (optional)
  SENTRY_DSN?: string;
}

/**
 * YouTube channel ID for Wycombe Wanderers official channel
 * https://www.youtube.com/@officialwwfc
 */
export const WWFC_YOUTUBE_CHANNEL_ID = 'UCBluS0ycJxgO8BYQYH-8OQQ';

/**
 * Base URL for the WWFC website
 */
export const WWFC_BASE_URL = 'https://www.wwfc.com';

/**
 * WWFC API base URL
 */
export const WWFC_API_URL = 'https://webapi.gc.wycombewanderersfcservices.co.uk/v1';
