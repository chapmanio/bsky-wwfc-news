/**
 * Bluesky posting types
 */

import type { BlobRef } from '@atproto/api';
import type { ContentItem } from '../../../entities/content-item';

/**
 * Result of posting content to Bluesky
 */
export interface PostResult {
  /** Whether the post was successful */
  success: boolean;

  /** The content item that was posted */
  item: ContentItem;

  /** The Bluesky post URI (if successful) */
  uri?: string;

  /** The Bluesky post CID (if successful) */
  cid?: string;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Credentials for Bluesky authentication
 */
export interface BlueskyCredentials {
  /** Bluesky handle (e.g., your-handle.bsky.social) */
  identifier: string;

  /** App password (not main password) */
  password: string;
}

/**
 * External embed data for link cards
 */
export interface ExternalEmbedData {
  /** URL to link to */
  uri: string;

  /** Title to display */
  title: string;

  /** Description text */
  description: string;

  /** Thumbnail image blob reference (optional) */
  thumb?: BlobRef;
}

// Re-export BlobRef from @atproto/api for convenience
export type { BlobRef };
