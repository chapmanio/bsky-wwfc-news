/**
 * Article detection logic
 *
 * Fetches new articles and converts them to ContentItems
 */

import type { ArticleItem } from '../../../entities/content-item';
import type { StateManager } from '../../../entities/posted-state';
import { logger } from '../../../shared/lib';
import type { WwfcClient } from '../api';
import type { WwfcArticle, FetchArticlesOptions } from '../model';

/**
 * Convert a WWFC article to an ArticleItem (ContentItem)
 */
export function articleToContentItem(article: WwfcArticle): ArticleItem {
  return {
    id: article.postId,
    type: 'article',
    source: 'wwfc-news',
    title: article.title,
    url: article.url,
    description: article.summary,
    thumbnailUrl: article.thumbnailUrl,
    publishedAt: article.publishedAt,
    category: article.category,
  };
}

/**
 * Fetch new articles that haven't been posted yet
 */
export async function fetchNewArticles(
  wwfcClient: WwfcClient,
  stateManager: StateManager,
  options: FetchArticlesOptions = {}
): Promise<ArticleItem[]> {
  logger.info('wwfc-news', 'Fetching new articles...');

  // Fetch recent articles from the API
  const articles = await wwfcClient.fetchArticles(options);
  logger.info('wwfc-news', `Fetched ${articles.length} articles from API`);

  // Convert to content items
  const articleItems = articles.map(articleToContentItem);

  // Log article IDs for debugging
  logger.info('wwfc-news', `Article IDs: ${articleItems.map((a) => a.id).join(', ')}`);

  // Filter out already posted articles
  const newArticles = await stateManager.filterNewItems('wwfcNews', articleItems);
  logger.info('wwfc-news', `Found ${newArticles.length} new articles (not yet posted)`);

  if (newArticles.length > 0) {
    logger.info(
      'wwfc-news',
      `New articles: ${newArticles.map((a) => `"${a.title}" (${a.id})`).join(', ')}`
    );
  }

  // Sort by publish date (oldest first so they're posted in chronological order)
  newArticles.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  return newArticles;
}
