/**
 * WWFC News API client
 *
 * Fetches news articles from the Gamechanger CMS v2 search API
 */

import { createHttpClient } from '../../../shared/api';
import { WWFC_API_URL, WWFC_BASE_URL } from '../../../shared/config';
import type {
  WwfcArticle,
  WwfcNewsResponse,
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

      console.log(`Fetching WWFC articles (pageSize: ${pageSize})`);

      const response = await http.get<WwfcNewsResponse>('search', {
        params: {
          'page.size': pageSize,
          'page.number': 1,
          sort: 'publishedDateTime:desc',
          ...(category && { q: `(postCategory:"${category}")` }),
        },
      });

      console.log(`Got ${response.data.length} articles from WWFC API`);

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
  const normalizedSlug = slug.startsWith('/') ? slug : `/${slug}`;
  return `${WWFC_BASE_URL}${normalizedSlug}`;
}

/**
 * Get the best available image URL from an article's attributes.
 *
 * The v2 API is inconsistent with casing — some articles use lowercase
 * `location`, others use uppercase `Location`. We check both.
 */
function getBestImage(attrs: { imageData?: WwfcImageData; heroSmallImageData?: WwfcImageData }): string {
  const getLocation = (img?: WwfcImageData) => img?.location ?? img?.Location ?? '';

  return getLocation(attrs.heroSmallImageData) || getLocation(attrs.imageData);
}

/**
 * Type for the WWFC client
 */
export type WwfcClient = ReturnType<typeof createWwfcClient>;
