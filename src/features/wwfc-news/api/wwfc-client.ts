/**
 * WWFC News API client
 *
 * Fetches news articles from the Gamechanger CMS v2 search API
 */

import { createHttpClient } from '../../../shared/api';
import { WWFC_API_URL, WWFC_BASE_URL, WWFC_IMAGE_CDN_URL } from '../../../shared/config';
import { logger } from '../../../shared/lib';
import type {
  WwfcArticle,
  WwfcNewsResponse,
  WwfcNewsAttributes,
  WwfcImageData,
  FetchArticlesOptions,
} from '../model';

/**
 * Create a WWFC news API client
 */
export function createWwfcClient() {
  const http = createHttpClient({ baseUrl: WWFC_API_URL });

  return {
    /**
     * Fetch recent news articles via the v2 search endpoint
     */
    async fetchArticles(options: FetchArticlesOptions = {}): Promise<WwfcArticle[]> {
      const { pageSize = 10, category } = options;

      logger.info('wwfc-news', `Fetching articles (pageSize: ${pageSize})`);

      const response = await http.get<WwfcNewsResponse>('search', {
        params: {
          'page.size': pageSize,
          'page.number': 1,
          sort: 'publishedDateTime:desc',
          ...(category && { q: `(postCategory:"${category}")` }),
        },
      });

      logger.info('wwfc-news', `Got ${response.data.length} articles from API`);

      const articles = response.data.map((item) => ({
        postId: String(item.attributes.postID),
        title: item.attributes.postTitle,
        summary: item.attributes.description ?? '',
        slug: item.attributes.postSlug,
        url: buildArticleUrl(item.attributes.postSlug),
        publishedAt: new Date(item.attributes.publishedDateTime),
        category: item.attributes.postCategory,
        categoryName: item.attributes.postCategoryName,
        thumbnailUrl: getBestImage(item.attributes),
      }));

      // Log first few articles for debugging (include thumbnail URL)
      articles.slice(0, 3).forEach((a, i) => {
        logger.info(
          'wwfc-news',
          `${i + 1}. "${a.title}" (ID: ${a.postId}) thumb=${a.thumbnailUrl || '(none)'}`
        );
      });

      return articles;
    },
  };
}

/**
 * Build the full article URL from a slug
 */
function buildArticleUrl(slug: string): string {
  const normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`;
  return `${WWFC_BASE_URL}${normalizedSlug}`;
}

/** Thumbnail width — matches the resize target in the Bluesky client */
const THUMBNAIL_WIDTH = 800;

/**
 * Get the best available thumbnail URL from an article's attributes.
 *
 * Prefers the WWFC image CDN (fit-in) which returns a resized image well
 * under Bluesky's 1MB limit. Raw S3 URLs are often 1–3MB and would
 * exceed the limit.
 *
 * Note: fetches of this CDN URL from Cloudflare Workers must send a
 * browser-like User-Agent — the CDN returns 403 to the default Worker UA.
 * See `uploadImageFromUrl` in the Bluesky client.
 */
function getBestImage(attrs: WwfcNewsAttributes): string {
  const mediaId =
    attrs.heroSmallMediaLibraryID ||
    attrs.heroSmallImageData?.mediaLibraryID ||
    attrs.mediaLibraryID ||
    attrs.imageData?.mediaLibraryID;

  if (mediaId) {
    return `${WWFC_IMAGE_CDN_URL}/fit-in/${THUMBNAIL_WIDTH}x${THUMBNAIL_WIDTH}/${mediaId}.jpg`;
  }

  // Fallback: raw S3 URL (may exceed Bluesky's 1MB limit)
  const getLocation = (img?: WwfcImageData) => img?.location ?? img?.Location ?? '';

  return getLocation(attrs.heroSmallImageData) || getLocation(attrs.imageData);
}

/**
 * Type for the WWFC client
 */
export type WwfcClient = ReturnType<typeof createWwfcClient>;
