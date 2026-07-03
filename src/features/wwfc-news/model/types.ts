/**
 * WWFC News API types
 *
 * Based on the Gamechanger CMS v2 search API (JSON:API style)
 */

/**
 * WWFC news article (normalised from the API response)
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
 * v2 search API response wrapper
 */
export interface WwfcNewsResponse {
  data: WwfcNewsDataItem[];
  meta: {
    totalCount: number;
    totalPages: number;
  };
  links: {
    self: string;
    first: string;
    prev: string | null;
    next: string | null;
    last: string;
  };
}

/**
 * A single item in the `data` array — JSON:API resource object
 */
export interface WwfcNewsDataItem {
  type: string;
  id: string;
  attributes: WwfcNewsAttributes;
}

/**
 * Article attributes returned by the v2 search API
 */
export interface WwfcNewsAttributes {
  postID: string;
  postTitle: string;
  postSlug: string;
  postCategory: string;
  postCategoryName: string;
  publishedDateTime: string;
  description?: string | null;
  mediaLibraryID?: string | null;
  heroSmallMediaLibraryID?: string | null;
  imageData?: WwfcImageData;
  heroSmallImageData?: WwfcImageData;
}

/**
 * Image data from the API.
 *
 * The v2 API is inconsistent — some articles use lowercase `location`,
 * others use uppercase `Location`. We handle both when reading.
 */
export interface WwfcImageData {
  location?: string;
  Location?: string;
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
