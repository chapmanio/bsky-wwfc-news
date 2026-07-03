/**
 * Bluesky API client
 *
 * Handles authentication, posting, and image uploads to Bluesky
 */

import { BskyAgent, RichText, BlobRef } from '@atproto/api';
import type { BlueskyCredentials, ExternalEmbedData } from '../model';

/** Maximum image size for Bluesky (1MB) */
const MAX_IMAGE_SIZE_BYTES = 1_000_000;

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
     * WWFC news images are pre-resized via the WWFC image CDN, so they
     * should always be well under the limit.
     */
    async uploadImageFromUrl(imageUrl: string): Promise<BlobRef | null> {
      try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
          console.warn(`Failed to fetch image: ${response.status} ${response.statusText}`);
          return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();

        console.log(`Fetched image: ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB`);

        if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
          console.warn(
            `Image too large (${(arrayBuffer.byteLength / 1_000_000).toFixed(2)}MB). Posting without thumbnail.`
          );
          return null;
        }

        const uint8Array = new Uint8Array(arrayBuffer);

        const uploadResponse = await agent.uploadBlob(uint8Array, {
          encoding: contentType,
        });

        console.log(`Uploaded image: ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB`);
        return uploadResponse.data.blob;
      } catch (error) {
        console.warn(`Error fetching image: ${error}. Posting without thumbnail.`);
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
