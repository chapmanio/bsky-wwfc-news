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

      console.log(`Fetching WWFC articles (pageSize: ${pageSize})`);

      const response = await http.get<WwfcNewsResponse>('news', {
        params: {
          pageSize,
          ...(category && { category }),
        },
      });

      if (!response.success) {
        throw new Error(`WWFC API error: ${response.message}`);
      }

      console.log(`Got ${response.body.length} articles from WWFC API`);

      const articles = response.body.map((item) => ({
        // Ensure postId is a string for consistent comparison
        postId: String(item.postID),
        title: item.postTitle,
        summary: item.postSummary || '',
        slug: item.postSlug,
        url: buildArticleUrl(item.postSlug),
        publishedAt: new Date(item.publishedDateTime),
        category: item.postCategory,
        categoryName: item.postCategoryName,
        thumbnailUrl: getBestImage(item),
      }));

      // Log first few articles for debugging
      articles.slice(0, 3).forEach((a, i) => {
        console.log(`  ${i + 1}. "${a.title}" (ID: ${a.postId})`);
      });

      return articles;
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
