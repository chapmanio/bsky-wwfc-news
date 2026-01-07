/**
 * Bluesky API client
 *
 * Handles authentication, posting, and image uploads to Bluesky
 */

import { BskyAgent, RichText, BlobRef } from '@atproto/api';
import type { BlueskyCredentials, ExternalEmbedData } from '../model';

/**
 * Create a Bluesky API client
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
     */
    async uploadImageFromUrl(imageUrl: string): Promise<BlobRef> {
      // Fetch the image
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Bluesky
      const uploadResponse = await agent.uploadBlob(uint8Array, {
        encoding: contentType,
      });

      return uploadResponse.data.blob;
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
