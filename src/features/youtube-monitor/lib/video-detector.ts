/**
 * Video detection logic
 *
 * Fetches new videos and converts them to ContentItems
 */

import type { VideoItem } from '../../../entities/content-item';
import type { StateManager } from '../../../entities/posted-state';
import type { YouTubeClient } from '../api';
import type { YouTubeVideo } from '../model';

/**
 * Build a YouTube video URL from a video ID
 */
export function buildVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Convert a YouTube video to a VideoItem (ContentItem)
 */
export function videoToContentItem(video: YouTubeVideo): VideoItem {
  return {
    id: video.videoId,
    type: 'video',
    source: 'youtube',
    videoId: video.videoId,
    title: video.title,
    url: buildVideoUrl(video.videoId),
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
  };
}

/**
 * Fetch new videos that haven't been posted yet
 */
export async function fetchNewVideos(
  youtubeClient: YouTubeClient,
  stateManager: StateManager,
  channelId: string,
  maxResults: number = 10
): Promise<VideoItem[]> {
  // Fetch recent uploads from the channel
  const videos = await youtubeClient.fetchChannelUploads(channelId, maxResults);

  // Convert to content items
  const videoItems = videos.map(videoToContentItem);

  // Filter out already posted videos
  const newVideos = await stateManager.filterNewItems('youtube', videoItems);

  // Sort by publish date (oldest first so they're posted in chronological order)
  newVideos.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  return newVideos;
}
