# WWFC Bluesky News Bot

A Cloudflare Worker that automatically posts Wycombe Wanderers content to Bluesky. It monitors:

- **YouTube** - New videos from the [official WWFC YouTube channel](https://www.youtube.com/@officialwwfc)
- **WWFC News** - New articles from the [official WWFC website](https://www.wwfc.com/news)

## Features

- 🔄 **Automatic polling** - Checks for new content every 5 minutes
- 📺 **YouTube embeds** - Videos are embedded directly in Bluesky posts
- 🖼️ **Rich link cards** - News articles include thumbnail images
- 📷 **Image optimization** - Large images automatically resized via Cloudinary
- 🔒 **Deduplication** - Tracks posted content to prevent duplicates
- ⚡ **Optimized KV usage** - Single read/write pattern minimizes Cloudflare KV operations
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
4. **Cloudinary Account** (optional) - For image resizing, [free tier available](https://cloudinary.com/)
5. **Sentry Account** (optional) - For error monitoring

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
npx wrangler kv namespace create POSTED_ITEMS

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
# Enter the channel ID (e.g., UCR_EcVkERzNZuRiEpmmsRng)

# Optional: Cloudinary (for image resizing)
npx wrangler secret put CLOUDINARY_CLOUD_NAME
# Enter your Cloudinary cloud name

# Optional: Sentry
npx wrangler secret put SENTRY_DSN
# Enter your Sentry DSN
```

### 4. Cloudinary Setup (Optional but Recommended)

Cloudinary is used to resize large news article images before uploading to Bluesky (which has a 1MB limit). Without Cloudinary, posts with oversized images will be posted without thumbnails.

1. Create a free account at [cloudinary.com](https://cloudinary.com/)
2. Find your **Cloud Name** in the dashboard (top-left corner)
3. Go to **Settings** → **Security**
4. Ensure **"Fetched URL"** is enabled (allows transforming external images)
5. Add the secret: `npx wrangler secret put CLOUDINARY_CLOUD_NAME`

The free tier includes 25 credits/month which is more than enough for this use case.

### 5. Local Development

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

### 6. Deploy

```bash
npm run deploy
```

## API Endpoints

| Endpoint                      | Method | Description                                               |
| ----------------------------- | ------ | --------------------------------------------------------- |
| `/health`                     | GET    | Health check                                              |
| `/status`                     | GET    | Current state (posted counts, last update, failures)      |
| `/trigger`                    | POST   | Manually trigger content check                            |
| `/initialize`                 | POST   | Mark current content as posted (run once on first deploy) |
| `/initialize?skipLatest=true` | POST   | Same as above, but skip latest item (for testing)         |
| `/clear`                      | POST   | Clear all state (use before re-initializing)              |

### First Run - Important!

**Before enabling the cron trigger**, call the `/initialize` endpoint to mark existing content as already posted. This prevents the bot from posting all historical videos and articles on first run:

```bash
curl -X POST https://your-worker.workers.dev/initialize
```

This will fetch the latest 20 videos and 20 articles and mark them as "already posted" without actually posting anything to Bluesky.

#### Testing Mode

To test that posting works correctly, use the `skipLatest` parameter:

```bash
# Clear existing state
curl -X POST https://your-worker.workers.dev/clear

# Initialize, but skip the latest video and article
curl -X POST "https://your-worker.workers.dev/initialize?skipLatest=true"

# Trigger - this will post just the latest video and article
curl -X POST https://your-worker.workers.dev/trigger
```

## Environment Variables

| Variable                | Required | Description                                 |
| ----------------------- | -------- | ------------------------------------------- |
| `BLUESKY_IDENTIFIER`    | Yes      | Bluesky handle (e.g., yourname.bsky.social) |
| `BLUESKY_PASSWORD`      | Yes      | Bluesky App Password                        |
| `YOUTUBE_API_KEY`       | Yes      | YouTube Data API v3 key                     |
| `YOUTUBE_CHANNEL_ID`    | Yes      | YouTube channel ID to monitor               |
| `CLOUDINARY_CLOUD_NAME` | No       | Cloudinary cloud name for image resizing    |
| `SENTRY_DSN`            | No       | Sentry DSN for error tracking               |

## How It Works

### YouTube Monitoring

1. Uses the YouTube Data API v3 `playlistItems.list` endpoint
2. Fetches from the channel's uploads playlist
3. Filters out YouTube Shorts (videos under 60 seconds)
4. Posts include the video title, URL, and embedded thumbnail
5. Bluesky clients auto-embed YouTube videos for playback

### WWFC News Monitoring

1. Uses the WWFC Gamechanger CMS API (no scraping needed!)
2. Fetches recent articles with titles, summaries, and images
3. Creates Bluesky posts with rich link card embeds
4. Thumbnails are uploaded to Bluesky for consistent display

### Image Handling

Bluesky has a 1MB limit on uploaded images. When a news article has a large thumbnail:

1. The original image is fetched and checked
2. If over 1MB and Cloudinary is configured:
   - Image is resized to 800px width with 75% quality via Cloudinary's fetch API
   - Resized image is uploaded to Bluesky
3. If Cloudinary is not configured or resizing fails:
   - The post is created without a thumbnail image

### State Management

- Uses Cloudflare KV to track posted content IDs
- **Optimized for minimal KV operations**: reads once, writes only when content changes
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
