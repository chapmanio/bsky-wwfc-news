/**
 * Bluesky API client
 *
 * Handles authentication, posting, and image uploads to Bluesky
 */

import { BskyAgent, RichText, BlobRef } from '@atproto/api';
import type { BlueskyCredentials, ExternalEmbedData } from '../model';
import type { ImagesBinding } from '../../../app/config';

/** Maximum image size for Bluesky (1MB) */
const MAX_IMAGE_SIZE_BYTES = 1_000_000;

/** Target width for resized images */
const RESIZE_TARGET_WIDTH = 800;

/** Quality for resized images (0-100) */
const RESIZE_QUALITY = 80;

/**
 * Options for creating a Bluesky client
 */
interface BlueskyClientOptions {
  credentials: BlueskyCredentials;
  /** Cloudflare Images binding for resizing large images (optional) */
  imagesBinding?: ImagesBinding;
}

/**
 * Create a Bluesky API client
 */
export async function createBlueskyClient(options: BlueskyClientOptions) {
  const { credentials, imagesBinding } = options;

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
     * If the image is too large and the Images binding is available,
     * attempts to resize it. Otherwise returns null for large images.
     */
    async uploadImageFromUrl(imageUrl: string): Promise<BlobRef | null> {
      // Fetch the image
      const response = await fetch(imageUrl);

      if (!response.ok) {
        console.warn(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return null;
      }

      let contentType = response.headers.get('content-type') || 'image/jpeg';
      let arrayBuffer = await response.arrayBuffer();
      const originalSize = arrayBuffer.byteLength;

      // Check if image needs resizing
      if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        const sizeMB = (arrayBuffer.byteLength / 1_000_000).toFixed(2);
        console.log(`Image is ${sizeMB}MB, attempting to resize...`);

        // Try to resize using Cloudflare Images if available
        if (imagesBinding) {
          try {
            const resizedResult = await resizeImage(arrayBuffer, imagesBinding);
            if (resizedResult && resizedResult.byteLength <= MAX_IMAGE_SIZE_BYTES) {
              arrayBuffer = resizedResult;
              contentType = 'image/jpeg'; // Cloudflare Images outputs JPEG by default
              console.log(
                `Resized image from ${(originalSize / 1000).toFixed(0)}KB to ${(arrayBuffer.byteLength / 1000).toFixed(0)}KB`
              );
            } else if (resizedResult) {
              console.warn(
                `Resized image still too large: ${(resizedResult.byteLength / 1_000_000).toFixed(2)}MB`
              );
              return null;
            } else {
              console.warn('Image resize failed, skipping thumbnail');
              return null;
            }
          } catch (error) {
            console.warn('Error resizing image:', error);
            return null;
          }
        } else {
          console.warn(
            `Image too large (${sizeMB}MB) and no Images binding available. Skipping thumbnail.`
          );
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
 * Resize an image using Cloudflare Images
 * @see https://developers.cloudflare.com/images/transform-images/bindings/
 */
async function resizeImage(
  imageData: ArrayBuffer,
  imagesBinding: ImagesBinding
): Promise<ArrayBuffer | null> {
  try {
    // Use the Cloudflare Images binding chain API
    const response = await imagesBinding
      .input(imageData)
      .transform({
        width: RESIZE_TARGET_WIDTH,
        fit: 'scale-down',
        quality: RESIZE_QUALITY,
      })
      .output({ format: 'image/jpeg' })
      .response();

    if (!response.ok) {
      console.error(`Image resize failed: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Failed to resize image:', error);
    return null;
  }
}

/**
 * Type for the Bluesky client
 */
export type BlueskyClient = Awaited<ReturnType<typeof createBlueskyClient>>;
