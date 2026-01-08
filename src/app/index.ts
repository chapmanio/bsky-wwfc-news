/**
 * WWFC Bluesky News Bot
 *
 * A Cloudflare Worker that monitors Wycombe Wanderers YouTube and news,
 * posting updates to Bluesky automatically.
 */

import * as Sentry from '@sentry/cloudflare';
import { createStateManager } from '../entities/posted-state';
import type { ContentItem } from '../entities/content-item';
import { createYouTubeClient, fetchNewVideos } from '../features/youtube-monitor';
import { createWwfcClient, fetchNewArticles } from '../features/wwfc-news';
import { createBlueskyClient, postContentItems, type PostResult } from '../features/bluesky-poster';
import type { Env } from './config';

// Re-export Env type for wrangler
export type { Env };

/** Number of consecutive failures before alerting */
const ALERT_FAILURE_THRESHOLD = 3;

/**
 * Initialize state by marking current content as already posted
 * Use this on first run to avoid posting all historical content
 *
 * @param skipLatest - If true, skip the latest item from each source (for testing)
 */
async function initializeState(
  env: Env,
  options: { skipLatest?: boolean } = {}
): Promise<{
  youtube: { markedAsPosted: number; skippedLatest?: string };
  wwfcNews: { markedAsPosted: number; skippedLatest?: string };
}> {
  const { skipLatest = false } = options;
  const stateManager = createStateManager(env.POSTED_ITEMS);

  const result: {
    youtube: { markedAsPosted: number; skippedLatest?: string };
    wwfcNews: { markedAsPosted: number; skippedLatest?: string };
  } = {
    youtube: { markedAsPosted: 0 },
    wwfcNews: { markedAsPosted: 0 },
  };

  // Fetch current YouTube videos and mark as posted
  try {
    console.log('Initializing YouTube state...');
    console.log(`Using channel ID: ${env.YOUTUBE_CHANNEL_ID}`);
    const youtubeClient = createYouTubeClient(env.YOUTUBE_API_KEY);

    // Fetch videos
    const videos = await youtubeClient.fetchChannelUploads(env.YOUTUBE_CHANNEL_ID, 20);
    console.log(`Found ${videos.length} regular videos`);

    // If skipLatest is true, skip the first (most recent) video
    let videosToMark = videos;
    if (skipLatest && videos.length > 0) {
      const skipped = videos[0];
      videosToMark = videos.slice(1);
      result.youtube.skippedLatest = `${skipped.title} (${skipped.videoId})`;
      console.log(`Skipping latest video for testing: ${skipped.title}`);
    }

    const videoIds = videosToMark.map((v) => v.videoId);

    if (videoIds.length > 0) {
      await stateManager.markManyAsPosted('youtube', videoIds);
      result.youtube.markedAsPosted = videoIds.length;
      console.log(`Marked ${videoIds.length} YouTube videos as already posted`);
    }
  } catch (error) {
    console.error('Error initializing YouTube state:', error);
    throw error;
  }

  // Fetch current WWFC articles and mark as posted
  try {
    console.log('Initializing WWFC news state...');
    const wwfcClient = createWwfcClient();
    const articles = await wwfcClient.fetchArticles({ pageSize: 20 });

    // If skipLatest is true, skip the first (most recent) article
    let articlesToMark = articles;
    if (skipLatest && articles.length > 0) {
      const skipped = articles[0];
      articlesToMark = articles.slice(1);
      result.wwfcNews.skippedLatest = `${skipped.title} (${skipped.postId})`;
      console.log(`Skipping latest article for testing: ${skipped.title}`);
    }

    const articleIds = articlesToMark.map((a) => a.postId);

    if (articleIds.length > 0) {
      await stateManager.markManyAsPosted('wwfcNews', articleIds);
      result.wwfcNews.markedAsPosted = articleIds.length;
      console.log(`Marked ${articleIds.length} WWFC articles as already posted`);
    }
  } catch (error) {
    console.error('Error initializing WWFC news state:', error);
    throw error;
  }

  console.log('Initialization complete!');
  return result;
}

/**
 * Main orchestration function - checks for new content and posts to Bluesky
 */
async function processNewContent(env: Env): Promise<void> {
  const stateManager = createStateManager(env.POSTED_ITEMS);

  // Collect all new content items
  const allNewItems: ContentItem[] = [];

  // Fetch new YouTube videos
  try {
    console.log('Checking for new YouTube videos...');
    const youtubeClient = createYouTubeClient(env.YOUTUBE_API_KEY);
    const newVideos = await fetchNewVideos(youtubeClient, stateManager, env.YOUTUBE_CHANNEL_ID);
    console.log(`Found ${newVideos.length} new videos`);
    allNewItems.push(...newVideos);

    // Reset failure count on success
    await stateManager.resetFailures('youtube');
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    const failureCount = await stateManager.recordFailure('youtube');

    // Report to Sentry if we've hit the threshold
    if (failureCount >= ALERT_FAILURE_THRESHOLD) {
      Sentry.captureException(error, {
        tags: { source: 'youtube' },
        extra: { consecutiveFailures: failureCount },
      });
    }
  }

  // Fetch new WWFC news articles
  try {
    console.log('Checking for new WWFC news...');
    const wwfcClient = createWwfcClient();
    const newArticles = await fetchNewArticles(wwfcClient, stateManager);
    console.log(`Found ${newArticles.length} new articles`);
    allNewItems.push(...newArticles);

    // Reset failure count on success
    await stateManager.resetFailures('wwfcNews');
  } catch (error) {
    console.error('Error fetching WWFC news:', error);
    const failureCount = await stateManager.recordFailure('wwfcNews');

    // Report to Sentry if we've hit the threshold
    if (failureCount >= ALERT_FAILURE_THRESHOLD) {
      Sentry.captureException(error, {
        tags: { source: 'wwfc-news' },
        extra: { consecutiveFailures: failureCount },
      });
    }
  }

  // If no new content, we're done
  if (allNewItems.length === 0) {
    console.log('No new content to post');
    return;
  }

  // Sort all items by publication date (oldest first)
  allNewItems.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  console.log(`Posting ${allNewItems.length} new items to Bluesky...`);

  // Create Bluesky client and post content
  try {
    const blueskyClient = await createBlueskyClient(
      {
        identifier: env.BLUESKY_IDENTIFIER,
        password: env.BLUESKY_PASSWORD,
      },
      env.CLOUDINARY_CLOUD_NAME
    );

    const results = await postContentItems(allNewItems, blueskyClient);

    // Process results and update state
    await processPostResults(results, stateManager);
  } catch (error) {
    console.error('Error posting to Bluesky:', error);

    // Always report Bluesky errors to Sentry (critical path)
    Sentry.captureException(error, {
      tags: { source: 'bluesky' },
    });

    throw error;
  }
}

/**
 * Process post results and update state
 */
async function processPostResults(
  results: PostResult[],
  stateManager: ReturnType<typeof createStateManager>
): Promise<void> {
  const successfulVideos: string[] = [];
  const successfulArticles: string[] = [];
  let failureCount = 0;

  for (const result of results) {
    if (result.success) {
      console.log(`✓ Posted: ${result.item.title}`);

      if (result.item.source === 'youtube') {
        successfulVideos.push(result.item.id);
      } else if (result.item.source === 'wwfc-news') {
        successfulArticles.push(result.item.id);
      }
    } else {
      console.error(`✗ Failed to post: ${result.item.title} - ${result.error}`);
      failureCount++;

      // Report individual post failures to Sentry
      Sentry.captureMessage(`Failed to post content: ${result.item.title}`, {
        level: 'warning',
        tags: {
          source: result.item.source,
          contentType: result.item.type,
        },
        extra: {
          itemId: result.item.id,
          error: result.error,
        },
      });
    }
  }

  // Update state for successful posts
  if (successfulVideos.length > 0) {
    await stateManager.markManyAsPosted('youtube', successfulVideos);
    console.log(`Marked ${successfulVideos.length} videos as posted`);
  }

  if (successfulArticles.length > 0) {
    await stateManager.markManyAsPosted('wwfcNews', successfulArticles);
    console.log(`Marked ${successfulArticles.length} articles as posted`);
  }

  // Log summary
  console.log(`\nSummary: ${results.length - failureCount}/${results.length} posts successful`);
}

/**
 * Worker handlers wrapped with Sentry
 */
const workerHandlers = {
  /**
   * Scheduled handler - runs every 5 minutes via cron trigger
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log(`Cron trigger fired at ${new Date(controller.scheduledTime).toISOString()}`);

    try {
      await processNewContent(env);
    } catch (error) {
      console.error('Error in scheduled handler:', error);
      throw error;
    }
  },

  /**
   * HTTP handler - for manual triggers and health checks
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Manual trigger endpoint
    if (url.pathname === '/trigger' && request.method === 'POST') {
      ctx.waitUntil(processNewContent(env));

      return new Response(
        JSON.stringify({
          message: 'Processing triggered',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize endpoint - mark current content as posted without actually posting
    // Use this on first run to avoid posting historical content
    // Add ?skipLatest=true to skip the latest item from each source (for testing)
    if (url.pathname === '/initialize' && request.method === 'POST') {
      try {
        const skipLatest = url.searchParams.get('skipLatest') === 'true';
        if (skipLatest) {
          console.log('Initialize called with skipLatest=true (testing mode)');
        }

        const result = await initializeState(env, { skipLatest });
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to initialize',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Clear endpoint - reset all state (use before re-initializing with new settings)
    if (url.pathname === '/clear' && request.method === 'POST') {
      try {
        const stateManager = createStateManager(env.POSTED_ITEMS);
        await stateManager.clearAllState();
        console.log('All state cleared');

        return new Response(
          JSON.stringify({
            message: 'All state cleared',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to clear state',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Status endpoint - show recent state
    if (url.pathname === '/status') {
      try {
        const stateManager = createStateManager(env.POSTED_ITEMS);
        const state = await stateManager.getState();

        return new Response(
          JSON.stringify({
            youtube: {
              postedCount: state.youtube.postedIds.length,
              lastChecked: state.youtube.lastCheckedAt,
              consecutiveFailures: state.youtube.consecutiveFailures,
            },
            wwfcNews: {
              postedCount: state.wwfcNews.postedIds.length,
              lastChecked: state.wwfcNews.lastCheckedAt,
              consecutiveFailures: state.wwfcNews.consecutiveFailures,
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Failed to get status',
            message: error instanceof Error ? error.message : String(error),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Default response
    return new Response(
      JSON.stringify({
        name: 'WWFC Bluesky News Bot',
        version: '1.0.0',
        endpoints: {
          'GET /health': 'Health check',
          'GET /status': 'Current state information',
          'POST /trigger': 'Manually trigger content check',
          'POST /initialize': 'Mark current content as posted (run once on first deploy)',
          'POST /initialize?skipLatest=true': 'Same as above, but skip latest item (for testing)',
          'POST /clear': 'Clear all state (use before re-initializing)',
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};

/**
 * Export the worker with Sentry instrumentation
 *
 * If SENTRY_DSN is not configured, exports handlers directly without Sentry
 */
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    // If Sentry DSN is configured, wrap with Sentry
    if (env.SENTRY_DSN) {
      return Sentry.withSentry(
        (env: Env) => ({
          dsn: env.SENTRY_DSN,
          tracesSampleRate: 1.0,
        }),
        workerHandlers
      ).fetch(request, env, ctx);
    }

    // Otherwise, just call the handler directly
    return workerHandlers.fetch(request, env, ctx);
  },

  scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    // If Sentry DSN is configured, wrap with Sentry
    if (env.SENTRY_DSN) {
      return Sentry.withSentry(
        (env: Env) => ({
          dsn: env.SENTRY_DSN,
          tracesSampleRate: 1.0,
        }),
        workerHandlers
      ).scheduled(controller, env, ctx);
    }

    // Otherwise, just call the handler directly
    return workerHandlers.scheduled(controller, env, ctx);
  },
};
