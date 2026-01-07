/**
 * WWFC News API client
 *
 * Fetches news articles from the Gamechanger CMS API
 */

import { createHttpClient } from '../../../shared/api';
import { WWFC_API_URL, WWFC_BASE_URL } from '../../../shared/config';
import type { WwfcArticle, WwfcNewsResponse, FetchArticlesOptions } from '../model';

/**
 * Create a WWFC news API client
 */
export function createWwfcClient() {
  const http = createHttpClient({ baseUrl: WWFC_API_URL });

  return {
    /**
     * Fetch recent news articles
     */
    async fetchArticles(options: FetchArticlesOptions = {}): Promise<WwfcArticle[]> {
      const { pageSize = 10, category } = options;

      const response = await http.get<WwfcNewsResponse>('/news', {
        params: {
          pageSize,
          ...(category && { category }),
        },
      });

      if (!response.success) {
        throw new Error(`WWFC API error: ${response.message}`);
      }

      return response.body.map((item) => ({
        postId: item.postID,
        title: item.postTitle,
        summary: item.postSummary || '',
        slug: item.postSlug,
        url: buildArticleUrl(item.postSlug),
        publishedAt: new Date(item.publishedDateTime),
        category: item.postCategory,
        categoryName: item.postCategoryName,
        thumbnailUrl: getBestImage(item),
      }));
    },
  };
}

/**
 * Build the full article URL from a slug
 */
function buildArticleUrl(slug: string): string {
  // Ensure slug starts with /
  const normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`;
  return `${WWFC_BASE_URL}${normalizedSlug}`;
}

/**
 * Get the best available image URL from an article
 */
function getBestImage(item: WwfcNewsResponse['body'][0]): string {
  // Prefer heroSmallImageData, then imageData
  return item.heroSmallImageData?.Location || item.imageData?.Location || '';
}

/**
 * Type for the WWFC client
 */
export type WwfcClient = ReturnType<typeof createWwfcClient>;
