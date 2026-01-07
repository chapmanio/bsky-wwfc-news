/**
 * WWFC News feature - public API
 *
 * Fetches news articles from the WWFC website API
 */

// API client
export { createWwfcClient, type WwfcClient } from './api';

// Types
export type { WwfcArticle, FetchArticlesOptions } from './model';

// Detection logic
export { fetchNewArticles, articleToContentItem } from './lib';
