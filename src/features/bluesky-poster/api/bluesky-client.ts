/**
 * Bluesky API client
 *
 * Handles authentication, posting, and image uploads to Bluesky
 */

import { BskyAgent, RichText, BlobRef } from '@atproto/api';
import { logger } from '../../../shared/lib';
import type { BlueskyCredentials, ExternalEmbedData } from '../model';

/** Maximum image size for Bluesky (1MB) */
const MAX_IMAGE_SIZE_BYTES = 1_000_000;

/**
 * Browser-like User-Agent for fetching images.
 *
 * The WWFC image CDN (Thumbor/CloudFront) returns 403 to Cloudflare Workers'
 * default UA (and to obvious bot UAs). A normal Chrome UA is accepted and
 * returns the resized image.
 */
const IMAGE_FETCH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Normalise Content-Type values from CDNs into Bluesky-accepted MIME types.
 *
 * e.g. the WWFC CDN returns the non-standard `image/jpg` — Bluesky's PDS
 * accepts it today (and rewrites to `image/jpeg`), but we normalise explicitly
 * so we don't depend on that behaviour.
 */
function normaliseImageMimeType(contentType: string | null): string {
  const mime = (contentType ?? 'image/jpeg').split(';')[0].trim().toLowerCase();

  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime.startsWith('image/')) return mime;

  return 'image/jpeg';
}

/**
 * Create a Bluesky API client
 *
 * @param credentials - Bluesky login credentials
 */
export async function createBlueskyClient(credentials: BlueskyCredentials) {
  const agent = new BskyAgent({
    service: 'https://bsky.social',
  });

  // Login to Bluesky
  await agent.login({
    identifier: credentials.identifier,
    password: credentials.password,
  });

  return {
    /**
     * Get the underlying agent (for advanced operations)
     */
    getAgent(): BskyAgent {
      return agent;
    },

    /**
     * Post text content to Bluesky
     */
    async postText(text: string): Promise<{ uri: string; cid: string }> {
      // Create rich text to detect mentions, links, etc.
      const rt = new RichText({ text });
      await rt.detectFacets(agent);

      const response = await agent.post({
        text: rt.text,
        facets: rt.facets,
      });

      return response;
    },

    /**
     * Post text with an external embed (link card)
     */
    async postWithEmbed(
      text: string,
      embed: ExternalEmbedData
    ): Promise<{ uri: string; cid: string }> {
      // Create rich text to detect mentions, links, etc.
      const rt = new RichText({ text });
      await rt.detectFacets(agent);

      const response = await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: embed.uri,
            title: embed.title,
            description: embed.description,
            thumb: embed.thumb,
          },
        },
      });

      return response;
    },

    /**
     * Upload an image blob from a URL
     *
     * Fetches the image and uploads it to Bluesky. Returns null if the
     * fetch fails or the image exceeds Bluesky's 1MB limit.
     *
     * WWFC news images are fetched via the WWFC image CDN (fit-in resize)
     * so they stay under the limit. A browser-like User-Agent is required
     * — the CDN 403s Workers' default UA.
     */
    async uploadImageFromUrl(imageUrl: string): Promise<BlobRef | null> {
      try {
        logger.info('bluesky', `Fetching image: ${imageUrl}`);

        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': IMAGE_FETCH_USER_AGENT,
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            Referer: 'https://www.wwfc.com/',
          },
        });

        if (!response.ok) {
          logger.warn(
            'bluesky',
            `Failed to fetch image (${response.status} ${response.statusText}): ${imageUrl}`
          );
          return null;
        }

        const contentType = normaliseImageMimeType(response.headers.get('content-type'));
        const arrayBuffer = await response.arrayBuffer();

        // Guard against HTML error pages served with a misleading status
        const magic = new Uint8Array(arrayBuffer.slice(0, 15));
        const looksLikeHtml =
          magic[0] === 0x3c /* < */ ||
          new TextDecoder().decode(magic).toLowerCase().includes('<!doctype');
        if (looksLikeHtml) {
          logger.warn(
            'bluesky',
            `Image URL returned HTML instead of an image: ${imageUrl}`
          );
          return null;
        }

        logger.info(
          'bluesky',
          `Fetched image: ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB (${contentType})`
        );

        if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
          logger.warn(
            'bluesky',
            `Image too large (${(arrayBuffer.byteLength / 1_000_000).toFixed(2)}MB). Posting without thumbnail.`
          );
          return null;
        }

        const uint8Array = new Uint8Array(arrayBuffer);

        const uploadResponse = await agent.uploadBlob(uint8Array, {
          encoding: contentType,
        });

        logger.info(
          'bluesky',
          `Uploaded image: ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB (${uploadResponse.data.blob.mimeType})`
        );
        return uploadResponse.data.blob;
      } catch (error) {
        logger.warn(
          'bluesky',
          `Error fetching/uploading image (${imageUrl}): ${error}. Posting without thumbnail.`
        );
        return null;
      }
    },

    /**
     * Upload an image blob from binary data
     */
    async uploadImageBlob(data: Uint8Array, mimeType: string): Promise<BlobRef> {
      const uploadResponse = await agent.uploadBlob(data, {
        encoding: mimeType,
      });

      return uploadResponse.data.blob;
    },
  };
}

/**
 * Type for the Bluesky client
 */
export type BlueskyClient = Awaited<ReturnType<typeof createBlueskyClient>>;
