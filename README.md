# WWFC Bluesky News Bot

A Cloudflare Worker that automatically posts Wycombe Wanderers content to Bluesky. It monitors:

- **YouTube** - New videos from the [official WWFC YouTube channel](https://www.youtube.com/@officialwwfc)
- **WWFC News** - New articles from the [official WWFC website](https://www.wwfc.com/news)

## Features

- 🔄 **Automatic polling** - Checks for new content every 5 minutes
- 📺 **YouTube embeds** - Videos are embedded directly in Bluesky posts
- 🖼️ **Rich link cards** - News articles include thumbnail images
- 🔒 **Deduplication** - Tracks posted content to prevent duplicates
- 📊 **Error monitoring** - Sentry integration with alerting on repeated failures
- 💰 **Free tier friendly** - Runs entirely on Cloudflare Workers free tier

## Architecture

Built using [Feature Sliced Design](https://feature-sliced.design/) methodology:

```
src/
├── app/                    # Worker entry point
├── features/
│   ├── youtube-monitor/    # YouTube API integration
│   ├── wwfc-news/          # WWFC news API integration
│   └── bluesky-poster/     # Bluesky posting logic
├── entities/
│   ├── content-item/       # Shared content types
│   └── posted-state/       # KV state management
└── shared/                 # Shared utilities
```

## Prerequisites

1. **Cloudflare Account** - Free tier is sufficient
2. **Bluesky Account** - With an [App Password](https://bsky.app/settings/app-passwords)
3. **YouTube API Key** - From [Google Cloud Console](https://console.cloud.google.com/)
4. **Sentry Account** (optional) - For error monitoring

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/chapmanio/bsky-wwfc-news.git
cd bsky-wwfc-news
npm install
```

### 2. Create KV Namespace

```bash
# Create the KV namespace
npx wrangler kv:namespace create POSTED_ITEMS

# Copy the output ID and update wrangler.toml
```

Update `wrangler.toml` with your KV namespace ID:

```toml
[[kv_namespaces]]
binding = "POSTED_ITEMS"
id = "YOUR_KV_NAMESPACE_ID"
```

### 3. Configure Secrets

```bash
# Bluesky credentials
npx wrangler secret put BLUESKY_IDENTIFIER
# Enter your Bluesky handle (e.g., yourname.bsky.social)

npx wrangler secret put BLUESKY_PASSWORD
# Enter your App Password (NOT your main password)

# YouTube API
npx wrangler secret put YOUTUBE_API_KEY
# Enter your Google Cloud API key

npx wrangler secret put YOUTUBE_CHANNEL_ID
# Enter the channel ID (e.g., UCBluS0ycJxgO8BYQYH-8OQQ)

# Optional: Sentry
npx wrangler secret put SENTRY_DSN
# Enter your Sentry DSN
```

### 4. Local Development

Create a `.dev.vars` file (copy from `.dev.vars.example`):

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials
```

Run locally:

```bash
npm run dev
```

Test the endpoints:

```bash
# Health check
curl http://localhost:8787/health

# Check status
curl http://localhost:8787/status

# Manually trigger
curl -X POST http://localhost:8787/trigger
```

### 5. Deploy

```bash
npm run deploy
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/status` | GET | Current state (posted counts, failures) |
| `/trigger` | POST | Manually trigger content check |
| `/initialize` | POST | Mark current content as posted (run once on first deploy) |

### First Run - Important!

**Before enabling the cron trigger**, call the `/initialize` endpoint to mark existing content as already posted. This prevents the bot from posting all historical videos and articles on first run:

```bash
curl -X POST https://your-worker.workers.dev/initialize
```

This will fetch the latest 20 videos and 20 articles and mark them as "already posted" without actually posting anything to Bluesky.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLUESKY_IDENTIFIER` | Yes | Bluesky handle (e.g., yourname.bsky.social) |
| `BLUESKY_PASSWORD` | Yes | Bluesky App Password |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `YOUTUBE_CHANNEL_ID` | Yes | YouTube channel ID to monitor |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |

## How It Works

### YouTube Monitoring

1. Uses the YouTube Data API v3 `playlistItems.list` endpoint (3 quota units per call)
2. Fetches from the channel's uploads playlist
3. Posts include the video title and YouTube URL
4. Bluesky clients auto-embed YouTube videos

### WWFC News Monitoring

1. Uses the WWFC Gamechanger CMS API (no scraping needed!)
2. Fetches recent articles with titles, summaries, and images
3. Creates Bluesky posts with rich link card embeds
4. Thumbnails are uploaded to Bluesky for consistent display

### State Management

- Uses Cloudflare KV to track posted content IDs
- Maintains separate state for YouTube and WWFC news
- Tracks consecutive failures for alerting
- Keeps last 1,000 posted IDs per source

### Error Handling

- Continues processing if one source fails
- Records consecutive failures in KV
- Reports to Sentry after 3+ consecutive failures
- Always reports Bluesky posting errors (critical path)

## Development

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

## License

ISC
