/**
 * YouTube Monitor feature - public API
 *
 * Monitors the WWFC YouTube channel for new videos
 */

// API client
export { createYouTubeClient, type YouTubeClient } from './api';

// Types
export type { YouTubeVideo } from './model';

// Detection logic
export { fetchNewVideos, videoToContentItem, buildVideoUrl } from './lib';
