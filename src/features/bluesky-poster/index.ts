/**
 * Bluesky Poster feature - public API
 *
 * Posts content to Bluesky with embeds and link cards
 */

// API client
export { createBlueskyClient, type BlueskyClient } from './api';

// Types
export type { PostResult, BlueskyCredentials, ExternalEmbedData } from './model';

// Posting logic
export { postContentItem, postContentItems } from './lib';
