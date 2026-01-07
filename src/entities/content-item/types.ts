/**
 * Content item types - shared interface for videos and news articles
 */

/**
 * Type of content item
 */
export type ContentType = 'video' | 'article';

/**
 * Base content item interface
 * Represents any piece of content that can be posted to Bluesky
 */
export interface ContentItem {
  /** Unique identifier for the content */
  id: string;

  /** Type of content */
  type: ContentType;

  /** Title of the content */
  title: string;

  /** Full URL to the content */
  url: string;

  /** Short description or summary */
  description?: string;

  /** URL to thumbnail image */
  thumbnailUrl?: string;

  /** Publication date */
  publishedAt: Date;

  /** Source of the content */
  source: 'youtube' | 'wwfc-news';
}

/**
 * YouTube video content item
 */
export interface VideoItem extends ContentItem {
  type: 'video';
  source: 'youtube';

  /** YouTube video ID */
  videoId: string;
}

/**
 * News article content item
 */
export interface ArticleItem extends ContentItem {
  type: 'article';
  source: 'wwfc-news';

  /** Category of the article (e.g., 'mens', 'club', 'tickets') */
  category?: string;
}

/**
 * Type guard to check if content is a video
 */
export function isVideoItem(item: ContentItem): item is VideoItem {
  return item.type === 'video';
}

/**
 * Type guard to check if content is an article
 */
export function isArticleItem(item: ContentItem): item is ArticleItem {
  return item.type === 'article';
}
