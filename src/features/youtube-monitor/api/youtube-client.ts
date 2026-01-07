/**
 * YouTube Data API v3 client
 *
 * Uses playlistItems.list to fetch videos from the uploads playlist,
 * which is much more efficient than search.list (3 units vs 100 per call).
 */

import { createHttpClient } from '../../../shared/api';
import type { YouTubeVideo, YouTubePlaylistItemsResponse, YouTubeChannelResponse } from '../model';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Create a YouTube API client
 */
export function createYouTubeClient(apiKey: string) {
  const http = createHttpClient({ baseUrl: YOUTUBE_API_BASE });

  return {
    /**
     * Get the uploads playlist ID for a channel
     *
     * The uploads playlist ID is derived from the channel ID by replacing
     * the second character: UC... -> UU...
     */
    getUploadsPlaylistId(channelId: string): string {
      // YouTube's uploads playlist ID is the channel ID with UC replaced by UU
      if (channelId.startsWith('UC')) {
        return 'UU' + channelId.slice(2);
      }
      return channelId;
    },

    /**
     * Fetch the uploads playlist ID from the API (alternative method)
     * This is more reliable but costs 1 API unit
     */
    async fetchUploadsPlaylistId(channelId: string): Promise<string> {
      const response = await http.get<YouTubeChannelResponse>('/channels', {
        params: {
          part: 'contentDetails',
          id: channelId,
          key: apiKey,
        },
      });

      if (!response.items || response.items.length === 0) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      return response.items[0].contentDetails.relatedPlaylists.uploads;
    },

    /**
     * Fetch recent videos from a playlist
     *
     * @param playlistId - The playlist ID (typically uploads playlist)
     * @param maxResults - Maximum number of results (default 10)
     */
    async fetchPlaylistVideos(
      playlistId: string,
      maxResults: number = 10
    ): Promise<YouTubeVideo[]> {
      const response = await http.get<YouTubePlaylistItemsResponse>('/playlistItems', {
        params: {
          part: 'snippet',
          playlistId,
          maxResults,
          key: apiKey,
        },
      });

      return response.items.map((item) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: getBestThumbnail(item.snippet.thumbnails),
        publishedAt: new Date(item.snippet.publishedAt),
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
      }));
    },

    /**
     * Fetch recent uploads from a channel
     *
     * @param channelId - The channel ID
     * @param maxResults - Maximum number of results (default 10)
     */
    async fetchChannelUploads(channelId: string, maxResults: number = 10): Promise<YouTubeVideo[]> {
      const uploadsPlaylistId = this.getUploadsPlaylistId(channelId);
      return this.fetchPlaylistVideos(uploadsPlaylistId, maxResults);
    },
  };
}

/**
 * Get the best available thumbnail URL
 */
function getBestThumbnail(
  thumbnails: YouTubePlaylistItemsResponse['items'][0]['snippet']['thumbnails']
): string {
  // Prefer higher quality thumbnails
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    ''
  );
}

/**
 * Type for the YouTube client
 */
export type YouTubeClient = ReturnType<typeof createYouTubeClient>;
