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
     * Strategy:
     * 1. Try fetching the original image directly
     * 2. If fetch fails OR image is too large, try Cloudinary (if configured)
     * 3. Returns null if all attempts fail
     *
     * @see https://cloudinary.com/documentation/fetch_remote_images
     */
    async uploadImageFromUrl(imageUrl: string): Promise<BlobRef | null> {
      let arrayBuffer: ArrayBuffer | null = null;
      let contentType = 'image/jpeg';
      let needsCloudinary = false;
      let directFetchFailed = false;

      // First, try fetching the original image directly
      try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
          console.warn(`Failed to fetch image directly: ${response.status} ${response.statusText}`);
          directFetchFailed = true;
          needsCloudinary = true;
        } else {
          contentType = response.headers.get('content-type') || 'image/jpeg';
          arrayBuffer = await response.arrayBuffer();
          const originalSize = arrayBuffer.byteLength;

          console.log(`Fetched image: ${(originalSize / 1000).toFixed(0)}KB`);

          // Check if image is too large
          if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
            const sizeMB = (arrayBuffer.byteLength / 1_000_000).toFixed(2);
            console.log(`Image too large (${sizeMB}MB), will try Cloudinary...`);
            needsCloudinary = true;
          }
        }
      } catch (error) {
        console.warn(`Error fetching image directly: ${error}`);
        directFetchFailed = true;
        needsCloudinary = true;
      }

      // If we need Cloudinary (fetch failed or image too large), try it
      if (needsCloudinary) {
        if (!cloudinaryCloudName) {
          if (directFetchFailed) {
            console.warn('Direct fetch failed and Cloudinary not configured. Posting without thumbnail.');
          } else {
            console.warn('Image too large and Cloudinary not configured. Posting without thumbnail.');
          }
          return null;
        }

        try {
          // Use Cloudinary's fetch feature to transform external images
          // Format: https://res.cloudinary.com/<cloud_name>/image/fetch/<transformations>/<image_url>
          // Note: The image URL should NOT be encoded - Cloudinary expects the raw URL
          // @see https://cloudinary.com/documentation/fetch_remote_images
          const transformUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/fetch/w_${RESIZE_WIDTH},q_${RESIZE_QUALITY},f_jpg/${imageUrl}`;

          console.log(`Requesting image from Cloudinary...`);

          const cloudinaryResponse = await fetch(transformUrl);

          if (cloudinaryResponse.ok) {
            const originalSize = arrayBuffer?.byteLength ?? 0;
            arrayBuffer = await cloudinaryResponse.arrayBuffer();
            contentType = 'image/jpeg';

            if (originalSize > 0) {
              console.log(
                `Resized image from ${(originalSize / 1000).toFixed(0)}KB to ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB via Cloudinary`
              );
            } else {
              console.log(
                `Fetched image via Cloudinary: ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB`
              );
            }

            // Check if still too large after Cloudinary
            if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
              console.warn(
                `Image still too large after Cloudinary: ${(arrayBuffer.byteLength / 1_000_000).toFixed(2)}MB. Posting without thumbnail.`
              );
              return null;
            }
          } else {
            const errorText = await cloudinaryResponse.text();
            console.warn(
              `Failed to fetch/resize image via Cloudinary: ${cloudinaryResponse.status} ${cloudinaryResponse.statusText}. ${errorText}. Posting without thumbnail.`
            );
            return null;
          }
        } catch (error) {
          console.warn(`Error with Cloudinary: ${error}. Posting without thumbnail.`);
          return null;
        }
      }

      // At this point we should have a valid arrayBuffer
      if (!arrayBuffer) {
        console.warn('No image data available. Posting without thumbnail.');
        return null;
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
