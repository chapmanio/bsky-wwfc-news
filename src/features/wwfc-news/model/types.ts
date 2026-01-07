/**
 * WWFC News API types
 *
 * Based on the Gamechanger CMS API response structure
 */

/**
 * WWFC news article from the API
 */
export interface WwfcArticle {
  /** Unique post ID */
  postId: string;

  /** Article title */
  title: string;

  /** Article summary/description */
  summary: string;

  /** URL path (e.g., /news/2026/january/07/...) */
  slug: string;

  /** Full URL to the article */
  url: string;

  /** Publication date */
  publishedAt: Date;

  /** Category (e.g., 'mens', 'club', 'tickets', 'academy') */
  category: string;

  /** Category display name */
  categoryName: string;

  /** Thumbnail image URL */
  thumbnailUrl: string;
}

/**
 * WWFC API response structure
 */
export interface WwfcNewsResponse {
  success: boolean;
  message: string;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  count: number;
  body: WwfcNewsItem[];
  datetime: string;
}

/**
 * Individual news item from the API
 */
export interface WwfcNewsItem {
  postID: string;
  postTitle: string;
  postSummary?: string;
  postSlug: string;
  postCategory: string;
  postCategoryName: string;
  publishedDateTime: string;
  imageData?: WwfcImageData;
  heroSmallImageData?: WwfcImageData;
}

/**
 * Image data from the API
 */
export interface WwfcImageData {
  Location: string;
  name: string;
  fileType: string;
  mediaLibraryID: string;
}

/**
 * Options for fetching articles
 */
export interface FetchArticlesOptions {
  /** Maximum number of articles to fetch */
  pageSize?: number;

  /** Category to filter by (optional) */
  category?: string;
}
