/**
 * YouTube video types
 */

/**
 * YouTube video data from the API
 */
export interface YouTubeVideo {
  /** YouTube video ID */
  videoId: string;

  /** Video title */
  title: string;

  /** Video description */
  description: string;

  /** Thumbnail URL (high quality) */
  thumbnailUrl: string;

  /** Publication date */
  publishedAt: Date;

  /** Channel ID */
  channelId: string;

  /** Channel title */
  channelTitle: string;
}

/**
 * YouTube API playlist items response
 */
export interface YouTubePlaylistItemsResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubePlaylistItem[];
}

/**
 * Individual playlist item from the API
 */
export interface YouTubePlaylistItem {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
      standard?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    };
    channelTitle: string;
    playlistId: string;
    position: number;
    resourceId: {
      kind: string;
      videoId: string;
    };
  };
}

/**
 * YouTube thumbnail data
 */
export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

/**
 * YouTube channel data for getting uploads playlist ID
 */
export interface YouTubeChannelResponse {
  kind: string;
  etag: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeChannel[];
}

/**
 * YouTube channel data
 */
export interface YouTubeChannel {
  kind: string;
  etag: string;
  id: string;
  contentDetails: {
    relatedPlaylists: {
      likes: string;
      uploads: string;
    };
  };
}
