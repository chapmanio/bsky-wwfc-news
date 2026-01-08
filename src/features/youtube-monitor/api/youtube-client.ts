/**
 * YouTube Data API v3 client
 *
 * Uses playlistItems.list to fetch videos from the uploads playlist,
 * which is much more efficient than search.list (3 units vs 100 per call).
 *
 * Videos under 60 seconds are filtered out (YouTube Shorts).
 */

import { createHttpClient } from '../../../shared/api';
import type { YouTubeVideo, YouTubePlaylistItemsResponse, YouTubeChannelResponse } from '../model';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3/';

/** Minimum duration in seconds - videos shorter than this are filtered out */
const MIN_VIDEO_DURATION_SECONDS = 60;

/**
 * Response from the videos endpoint (for getting duration)
 */
interface YouTubeVideosResponse {
  items: Array<{
    id: string;
    contentDetails: {
      duration: string;
    };
  }>;
}

/**
 * Create a YouTube API client
 */
export function createYouTubeClient(apiKey: string) {
  const http = createHttpClient({ baseUrl: YOUTUBE_API_BASE });

  return {
    /**
     * Fetch the uploads playlist ID from the API
     */
    async fetchUploadsPlaylistId(channelId: string): Promise<string> {
      const response = await http.get<YouTubeChannelResponse>('channels', {
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
     * Fetch video durations from the API
     */
    async fetchVideoDurations(videoIds: string[]): Promise<Map<string, number>> {
      if (videoIds.length === 0) {
        return new Map();
      }

      const response = await http.get<YouTubeVideosResponse>('videos', {
        params: {
          part: 'contentDetails',
          id: videoIds.join(','),
          key: apiKey,
        },
      });

      const durations = new Map<string, number>();
      for (const item of response.items) {
        durations.set(item.id, parseIsoDuration(item.contentDetails.duration));
      }
      return durations;
    },

    /**
     * Fetch recent videos from a playlist
     *
     * @param playlistId - The playlist ID (typically uploads playlist)
     * @param maxResults - Maximum number of results (default 10)
     * @param filterShortVideos - Filter out videos under 60 seconds (default true)
     */
    async fetchPlaylistVideos(
      playlistId: string,
      maxResults: number = 10,
      filterShortVideos: boolean = true
    ): Promise<YouTubeVideo[]> {
      // Fetch more videos if filtering, to ensure we get enough results
      const fetchCount = filterShortVideos ? Math.min(maxResults * 3, 50) : maxResults;

      const response = await http.get<YouTubePlaylistItemsResponse>('playlistItems', {
        params: {
          part: 'snippet',
          playlistId,
          maxResults: fetchCount,
          key: apiKey,
        },
      });

      console.log(`Fetched ${response.items.length} videos from playlist`);

      let videos: YouTubeVideo[] = response.items.map((item) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: getBestThumbnailUrl(item.snippet.thumbnails),
        publishedAt: new Date(item.snippet.publishedAt),
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
      }));

      // Filter out short videos (< 60 seconds)
      if (filterShortVideos && videos.length > 0) {
        const videoIds = videos.map((v) => v.videoId);
        const durations = await this.fetchVideoDurations(videoIds);

        const beforeCount = videos.length;
        videos = videos.filter((video) => {
          const duration = durations.get(video.videoId);
          if (duration === undefined) {
            console.log(`  ? "${video.title}" - no duration found, including`);
            return true;
          }

          const isTooShort = duration < MIN_VIDEO_DURATION_SECONDS;
          if (isTooShort) {
            console.log(`  ✗ "${video.title}" (${duration}s) - under ${MIN_VIDEO_DURATION_SECONDS}s, filtering out`);
          } else {
            console.log(`  ✓ "${video.title}" (${duration}s)`);
          }
          return !isTooShort;
        });

        const filteredCount = beforeCount - videos.length;
        if (filteredCount > 0) {
          console.log(`Filtered out ${filteredCount} short videos (<${MIN_VIDEO_DURATION_SECONDS}s)`);
        }
      }

      return videos.slice(0, maxResults);
    },

    /**
     * Fetch recent uploads from a channel
     *
     * @param channelId - The channel ID
     * @param maxResults - Maximum number of results (default 10)
     * @param filterShortVideos - Filter out videos under 60 seconds (default true)
     */
    async fetchChannelUploads(
      channelId: string,
      maxResults: number = 10,
      filterShortVideos: boolean = true
    ): Promise<YouTubeVideo[]> {
      const uploadsPlaylistId = await this.fetchUploadsPlaylistId(channelId);
      console.log(`Fetching uploads from playlist: ${uploadsPlaylistId}`);
      return this.fetchPlaylistVideos(uploadsPlaylistId, maxResults, filterShortVideos);
    },
  };
}

type Thumbnails = YouTubePlaylistItemsResponse['items'][0]['snippet']['thumbnails'];

/**
 * Get the best available thumbnail URL
 */
function getBestThumbnailUrl(thumbnails: Thumbnails): string {
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
 * Parse ISO 8601 duration to seconds
 * YouTube returns durations like "PT1H2M30S" or "PT30S" or "PT5M"
 */
function parseIsoDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    console.warn(`Could not parse duration: ${duration}`);
    return 0;
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Type for the YouTube client
 */
export type YouTubeClient = ReturnType<typeof createYouTubeClient>;
