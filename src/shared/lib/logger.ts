/**
 * Source-tagged logging helpers
 *
 * Prefixes every message with `[source]` so Cloudflare Workers Logs and
 * Sentry can be filtered by content source (wwfc-news, youtube, bluesky, …).
 */

/** Known log/event sources used across the worker */
export type LogSource =
  | 'app'
  | 'wwfc-news'
  | 'youtube'
  | 'bluesky'
  | 'kv'
  | 'http';

function formatMessage(source: LogSource, message: string): string {
  return `[${source}] ${message}`;
}

export const logger = {
  info(source: LogSource, message: string, ...args: unknown[]): void {
    console.log(formatMessage(source, message), ...args);
  },

  warn(source: LogSource, message: string, ...args: unknown[]): void {
    console.warn(formatMessage(source, message), ...args);
  },

  error(source: LogSource, message: string, ...args: unknown[]): void {
    console.error(formatMessage(source, message), ...args);
  },
};

/**
 * Map a content-item source string to a log source.
 *
 * `ContentItem.source` is a wider string union; this narrows it for logging.
 */
export function logSourceForContent(
  source: string
): Extract<LogSource, 'wwfc-news' | 'youtube' | 'bluesky'> {
  if (source === 'youtube') return 'youtube';
  if (source === 'wwfc-news') return 'wwfc-news';
  return 'bluesky';
}
