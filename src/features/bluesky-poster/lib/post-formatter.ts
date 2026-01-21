/**
 * Post formatting utilities
 *
 * Formats content items into Bluesky posts
 */

import type { ContentItem, VideoItem, ArticleItem } from '../../../entities/content-item';
import { isVideoItem, isArticleItem } from '../../../entities/content-item';
import type { BlueskyClient } from '../api';
import type { PostResult, ExternalEmbedData } from '../model';

/**
 * Maximum length for Bluesky post text (300 characters)
 */
const MAX_POST_LENGTH = 300;

/**
 * Truncate text to fit within a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a video item into a Bluesky post
 *
 * For videos, we include just the title - the URL will be in the embed
 */
function formatVideoPost(video: VideoItem): string {
  return truncateText(video.title, MAX_POST_LENGTH);
}

/**
 * Create an external embed for a YouTube video
 *
 * Bluesky clients render external embeds with YouTube URLs as playable videos
 */
async function createVideoEmbed(
  video: VideoItem,
  blueskyClient: BlueskyClient
): Promise<ExternalEmbedData> {
  let thumb: ExternalEmbedData['thumb'] | undefined;

  // Upload thumbnail if available
  if (video.thumbnailUrl) {
    try {
      const uploadedThumb = await blueskyClient.uploadImageFromUrl(video.thumbnailUrl);
      if (uploadedThumb) {
        thumb = uploadedThumb;
      } else {
        console.log(`Posting video "${video.title}" without thumbnail (upload returned null)`);
      }
    } catch (error) {
      console.warn(`Failed to upload thumbnail for video ${video.id}:`, error);
      // Continue without thumbnail
    }
  }

  return {
    uri: video.url,
    title: video.title,
    description: video.description || '',
    thumb,
  };
}

/**
 * Format an article item into a Bluesky post
 *
 * For articles, we use an external embed (link card) with the thumbnail
 */
function formatArticlePost(article: ArticleItem): string {
  // Just the title - the link will be in the embed
  return truncateText(article.title, MAX_POST_LENGTH);
}

/**
 * Create an external embed for an article
 */
async function createArticleEmbed(
  article: ArticleItem,
  blueskyClient: BlueskyClient
): Promise<ExternalEmbedData> {
  let thumb: ExternalEmbedData['thumb'] | undefined;

  // Upload thumbnail if available
  if (article.thumbnailUrl) {
    try {
      const uploadedThumb = await blueskyClient.uploadImageFromUrl(article.thumbnailUrl);
      // uploadImageFromUrl returns null if fetch failed or image couldn't be resized
      if (uploadedThumb) {
        thumb = uploadedThumb;
      } else {
        console.log(`Posting article "${article.title}" without thumbnail (upload returned null)`);
      }
    } catch (error) {
      console.warn(`Failed to upload thumbnail for article ${article.id}:`, error);
      // Continue without thumbnail
    }
  }

  return {
    uri: article.url,
    title: article.title,
    description: article.description || '',
    thumb,
  };
}

/**
 * Post a content item to Bluesky
 */
export async function postContentItem(
  item: ContentItem,
  blueskyClient: BlueskyClient
): Promise<PostResult> {
  try {
    let result: { uri: string; cid: string };

    if (isVideoItem(item)) {
      // For videos, create an embed with thumbnail
      // Bluesky clients render YouTube external embeds as playable videos
      const text = formatVideoPost(item);
      const embed = await createVideoEmbed(item, blueskyClient);
      result = await blueskyClient.postWithEmbed(text, embed);
    } else if (isArticleItem(item)) {
      // For articles, create an embed with thumbnail
      const text = formatArticlePost(item);
      const embed = await createArticleEmbed(item, blueskyClient);
      result = await blueskyClient.postWithEmbed(text, embed);
    } else {
      throw new Error(`Unknown content type: ${item.type}`);
    }

    return {
      success: true,
      item,
      uri: result.uri,
      cid: result.cid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to post content item ${item.id}:`, error);

    return {
      success: false,
      item,
      error: errorMessage,
    };
  }
}

/**
 * Post multiple content items to Bluesky
 *
 * Posts are made sequentially to respect rate limits
 */
export async function postContentItems(
  items: ContentItem[],
  blueskyClient: BlueskyClient
): Promise<PostResult[]> {
  const results: PostResult[] = [];

  for (const item of items) {
    const result = await postContentItem(item, blueskyClient);
    results.push(result);

    // Small delay between posts to be respectful of rate limits
    if (items.indexOf(item) < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
