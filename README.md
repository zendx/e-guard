# X Trends Dashboard (Next.js + Python Scraper)

This project is a web dashboard that displays country-based X (Twitter) trends and lets users switch between:

- `All Topics`
- `Hashtags`
- `Regular Topics` (non-hashtag trends)

It is designed to keep trend data refreshed from a scraper pipeline while serving a fast frontend.

## What This Project Does

- Scrapes trend topics for selected countries.
- Splits scraped trends into:
- `topics` (mixed)
- `hashtags` (starts with `#`)
- `regular_topics` (not hashtag)
- Stores results in `data/trends_by_country.json`.
- Serves trends to the frontend through a Next.js API route.
- Supports scheduled automatic refresh via GitHub Actions.

## Goals

- Provide near-real-time trend visibility by country.
- Allow users to quickly copy/share trends to X.
- Separate hashtag and non-hashtag trends for clearer content strategy.
- Support deployment to Vercel without depending on local persistent file writes at runtime.

## High-Level Architecture

```text
Python Scraper
  -> data/trends_by_country.json
  -> (GitHub Actions commits updates to repo)
  -> Next.js API (/api/trends) reads JSON (GitHub raw URL in production, local fallback)
  -> React UI renders countries + topic modes
```

## Technology Stack

- Frontend:
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- `lucide-react` icons
- Backend/API layer:
- Next.js Route Handler (`src/app/api/trends/route.ts`)
- Node runtime for local scan support
- Data pipeline:
- Python 3
- `requests`
- `beautifulsoup4`
- Automation:
- GitHub Actions (`.github/workflows/update-trends.yml`)
- Deployment:
- Vercel (frontend + API route)

## Data Source and API Details

### External data source used by scraper

- `https://trends24.in/<country-slug>/`

Important note:
- This project currently does not use official X paid API endpoints.
- It scrapes public trend pages and extracts the newest timeline block by timestamp.

### Internal API used by frontend

- `GET /api/trends`
- Returns JSON payload with trend data.
- Reads from GitHub raw JSON in production when configured.
- Falls back to local `data/trends_by_country.json`.

- `POST /api/trends`
- Triggers local Python re-scan.
- Intended for local/dev usage.
- Disabled on Vercel (`501`) because serverless runtime is not used as a persistent scraper worker.

## JSON Data Shape

`data/trends_by_country.json` includes:

```json
{
  "generated_at_utc": "2026-02-22T13:56:38.828555+00:00",
  "source": "trends24.in (public web scrape)",
  "countries": {
    "USA": {
      "slug": "united-states",
      "timeline_timestamp": "Sun Feb 22 2026 13:16:17 GMT+0000 (Coordinated Universal Time)",
      "topics": ["..."],
      "hashtags": ["..."],
      "regular_topics": ["..."],
      "source_selector": "ol.trend-card__list li .trend-name a.trend-link",
      "source_url": "https://trends24.in/united-states/"
    }
  }
}
```

## Project Structure

- `src/components/TwitterGrowthApp.tsx`
- Main UI, country selector, topic-mode toggle, copy/share actions, scan button.
- `src/app/api/trends/route.ts`
- Internal API route to fetch trend data and optionally trigger local scan.
- `scripts/scrape_trending_topics.py`
- Scraper script that fetches and parses latest trend blocks.
- `data/trends_by_country.json`
- Current trend dataset consumed by API/UI.
- `.github/workflows/update-trends.yml`
- Scheduled workflow to refresh and commit trend data.
- `requirements-trends-scraper.txt`
- Python dependencies.

## How Scraping Works

1. Build country page URL (`trends24.in/<slug>/`).
2. Request page HTML with retry logic.
3. Find timeline list blocks (`#timeline ol.trend-card__list` fallback `ol.trend-card__list`).
4. Parse each block timestamp and pick the newest one.
5. Extract trend names from `.trend-link`.
6. Split into `topics`, `hashtags`, and `regular_topics`.
7. Write final JSON.

## Local Development

### Install frontend deps

```bash
npm install
```

### Install scraper deps

```bash
pip install -r requirements-trends-scraper.txt
```

### Run scraper manually

```bash
python scripts/scrape_trending_topics.py --output data/trends_by_country.json
```

### Start app

```bash
npm run dev
```

### Optional local scan from UI

- Click `Scan Fresh Topics` in the frontend.
- This calls `POST /api/trends`, which runs the Python script locally.

## Production Deployment (Vercel + GitHub JSON)

### 1) Push repository to GitHub

- Ensure these files are in repo:
- `.github/workflows/update-trends.yml`
- `scripts/scrape_trending_topics.py`
- `data/trends_by_country.json`

### 2) Enable scheduled data refresh

- GitHub Actions workflow `Update Trends Data` runs every 30 minutes.
- It scrapes latest trends and commits only if JSON changed.

### 3) Configure Vercel environment variables

Set either:

- `TRENDS_JSON_URL` with full raw JSON URL

Or set:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (default `main`)

Example raw URL format:

`https://raw.githubusercontent.com/<owner>/<repo>/<branch>/data/trends_by_country.json`

## Known Constraints

- Source freshness depends on the external trend source update cadence per country.
- Direct X scraping is technically possible but brittle and compliance-sensitive.
- Local scan endpoint is intentionally disabled on Vercel.
- If no fresh data is available, UI can display older source timestamps even when scan time is recent.

## Scripts

- `npm run dev` - start development server.
- `npm run build` - production build.
- `npm run start` - start production server.
- `npm run lint` - lint codebase.


## Post Optimizer Feature

The app now includes an AI-powered post optimizer panel in `src/components/TwitterGrowthApp.tsx`.

### Integration Architecture

- API Layer: `src/app/api/optimize-post/route.ts` uses Vercel AI SDK `streamText()` with Anthropic Claude Sonnet 3.5.
- Context Injection:
- Backend loads current trend topics (`/api/trends` data source) and injects them into the optimizer prompt.
- Prompt includes hook rewrite, contextual trend insertion, whitespace readability, and `<280` character constraint.
- UI Component:
- Input box for user draft.
- `Boost Me` button that triggers streamed rewrite.
- Side-by-side rendering of `Old Post` vs `Optimized Post` with `+42% Projected Reach` badge.

### Required Environment Variables

- `ANTHROPIC_API_KEY` (required) - API key for Anthropic Messages API.
- `ANTHROPIC_MODEL` (optional) - defaults to `claude-3-5-sonnet-latest`.
- `NEXT_PUBLIC_DEFAULT_PLAN` (optional) - set `free` or `pro` for default UI plan state.

Example `.env.local`:

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
NEXT_PUBLIC_DEFAULT_PLAN=free
```

The optimizer route automatically injects the latest trends context from `data/trends_by_country.json` (or configured GitHub raw JSON in production) before requesting the rewrite.

### Monetization Gate

- Free users: can view trends but cannot use optimizer (`402` response from optimizer API).
- Pro users ($19/mo): can use AI Post Optimizer and receive streamed rewrite output.
