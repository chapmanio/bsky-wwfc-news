/**
 * Bluesky API client
 *
 * Handles authentication, posting, and image uploads to Bluesky
 */

import { BskyAgent, RichText, BlobRef } from '@atproto/api';
import type { BlueskyCredentials, ExternalEmbedData } from '../model';

/** Maximum image size for Bluesky (1MB) */
const MAX_IMAGE_SIZE_BYTES = 1_000_000;

/** Target width for resized images */
const RESIZE_WIDTH = 800;

/** Quality for resized images (1-100) */
const RESIZE_QUALITY = 75;

/**
 * Create a Bluesky API client
 *
 * @param credentials - Bluesky login credentials
 * @param cloudinaryCloudName - Optional Cloudinary cloud name for image resizing
 */
export async function createBlueskyClient(
  credentials: BlueskyCredentials,
  cloudinaryCloudName?: string
) {
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
     * If the image is too large and Cloudinary is configured, attempts to resize
     * using Cloudinary's fetch/transform feature.
     * Returns null if resizing fails or image still too large.
     *
     * @see https://cloudinary.com/documentation/fetch_remote_images
     */
    async uploadImageFromUrl(imageUrl: string): Promise<BlobRef | null> {
      // First, try fetching the original image
      let response = await fetch(imageUrl);

      if (!response.ok) {
        console.warn(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return null;
      }

      let contentType = response.headers.get('content-type') || 'image/jpeg';
      let arrayBuffer = await response.arrayBuffer();
      const originalSize = arrayBuffer.byteLength;

      console.log(`Fetched image: ${(originalSize / 1000).toFixed(0)}KB`);

      // If image is too large, try to resize using Cloudinary
      if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        const sizeMB = (arrayBuffer.byteLength / 1_000_000).toFixed(2);
        console.log(`Image too large (${sizeMB}MB), attempting to resize via Cloudinary...`);

        if (!cloudinaryCloudName) {
          console.warn('Cloudinary not configured. Posting without thumbnail.');
          return null;
        }

        try {
          // Use Cloudinary's fetch feature to transform external images
          // Format: https://res.cloudinary.com/<cloud_name>/image/fetch/<transformations>/<image_url>
          // Note: The image URL should NOT be encoded - Cloudinary expects the raw URL
          // @see https://cloudinary.com/documentation/fetch_remote_images
          const transformUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/fetch/w_${RESIZE_WIDTH},q_${RESIZE_QUALITY},f_jpg/${imageUrl}`;

          console.log(`Requesting transformed image from Cloudinary...`);

          const resizedResponse = await fetch(transformUrl);

          if (resizedResponse.ok) {
            arrayBuffer = await resizedResponse.arrayBuffer();
            contentType = 'image/jpeg';
            console.log(
              `Resized image from ${(originalSize / 1000).toFixed(0)}KB to ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB`
            );

            // Check if still too large after resizing
            if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
              console.warn(
                `Resized image still too large: ${(arrayBuffer.byteLength / 1_000_000).toFixed(2)}MB. Posting without thumbnail.`
              );
              return null;
            }
          } else {
            const errorText = await resizedResponse.text();
            console.warn(
              `Failed to resize image via Cloudinary: ${resizedResponse.status} ${resizedResponse.statusText}. ${errorText}. Posting without thumbnail.`
            );
            return null;
          }
        } catch (error) {
          console.warn(`Error resizing image via Cloudinary: ${error}. Posting without thumbnail.`);
          return null;
        }
      }

      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Bluesky
      const uploadResponse = await agent.uploadBlob(uint8Array, {
        encoding: contentType,
      });

      console.log(`Uploaded image: ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB`);
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
