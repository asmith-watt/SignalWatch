# SignalWatch - B2B Business Intelligence Platform

## Overview

SignalWatch is a B2B business intelligence platform designed for editorial teams to monitor companies and track business signals. The application allows users to track 900+ companies, collecting and analyzing signals from news, funding announcements, executive changes, job postings, and other business events. It features AI-powered analysis to help teams prioritize and act on relevant business intelligence.

## Recent Changes

### PR1: Sources Schema + Signal Provenance (January 2026)
- **New tables** (`shared/schema.ts`):
  - `sources`: Tracks where signals come from (RSS, Feedly, crawl, regulator, association, LLM)
    - Fields: id, name, sourceType, url, domain, trustScore, verificationStatus, isActive, lastVerifiedAt, lastIngestedAt
  - `source_markets`: Links sources to markets/regions they cover
  - `company_sources`: Maps which companies are covered by which sources
  - `ingestion_runs`: Tracks batch ingestion jobs with itemsFound, itemsCreated, errors
- **Signal provenance fields** (extended `signals` table):
  - `ingestionSourceType`: How the signal was discovered (default: 'llm_discovery')
  - `verificationStatus`: verified | unverified | rejected (default: 'unverified')
  - `verificationMethod`: How the signal was verified
  - `sourceId`: FK to sources table
  - `providerName`, `providerItemId`: External provider tracking
  - `canonicalUrl`: Canonical URL for deduplication
  - `companyId` now nullable (supports unassigned publisher/regulator signals)
- **Company relationships enhancement**:
  - Added `firstSeenAt` and `lastSeenAt` timestamps
- **New API endpoints**:
  - `GET /api/sources` - List sources with filters (market, companyId, type, status)
  - `POST /api/sources` - Create a new source
  - `PATCH /api/sources/:id` - Update a source
  - `POST /api/sources/:id/verify` - Mark source as verified
  - `DELETE /api/sources/:id` - Delete a source
  - `GET /api/ingest/runs` - List ingestion runs

### Intelligence Layer - Trends & Metrics (January 2026)
- **Signal Metrics** (`server/trend-engine.ts`):
  - Daily snapshot capturing rolling 7d and 30d signal counts
  - Industry-level and theme-level metrics with delta percentages
  - Stored in `signal_metrics` table for historical analysis
- **Trend Generation**:
  - Weekly AI-generated trend summaries for industries with significant changes
  - Candidate selection: minimum 10 signals and 25% delta threshold
  - AI explains patterns using themes, signal types, and magnitude
  - Stored in `trends` table with confidence scores
- **Baseline Guardrails** (cold-start handling):
  - If prev_30d < 25 signals, treat as "emerging" activity (no delta calculation)
  - Prevents misleading percentages from low baselines (e.g., 10→120 = 1100%)
  - Emerging trends show purple "Emerging" badge instead of percentage
  - UI caps displayed percentages at 500%+ for extreme values
- **Scheduler integration**:
  - Daily metrics: `ENABLE_METRICS_SCHEDULER=true`, cron via `METRICS_CRON` (default: `0 8 * * *` = 8:00 AM UTC)
  - Weekly trends: `ENABLE_TRENDS_SCHEDULER=true`, cron via `TRENDS_CRON` (default: `0 9 * * 1` = Monday 9:00 AM UTC)
- **New endpoints**:
  - `GET /api/trends` - Fetch trends with optional scopeType/timeWindow filters
  - `GET /api/metrics` - Fetch metrics with optional scopeType/scopeId/period filters
  - `POST /api/admin/trends/generate` - Manually trigger trend generation (admin)
  - `POST /api/admin/metrics/capture` - Manually trigger metrics snapshot (admin)
- **Frontend** (`client/src/pages/trends.tsx`):
  - Trends page with cards showing direction, magnitude, confidence, themes
  - Empty state when no trends available yet
  - Sidebar navigation link added

### Date Verification Admin UI (January 2026)
- **Data Management page** (`client/src/pages/data-management.tsx`):
  - Date Quality Overview showing verified count, needs review, total signals, avg confidence
  - Dynamic source breakdown badges (metadata, content, unknown, etc.)
  - Progress bar showing verification percentage
  - **Batch Backfill** section with configurable limit (50-500 signals)
  - Triggers POST `/api/admin/dates/backfill` to extract dates from source URLs
  - Displays last backfill results: processed, fixed, flagged, inaccessible counts
  - Manual Date Check section for on-demand verification scans
- **Stats endpoint**: `GET /api/signals/date-stats` returns quality metrics
- **Backfill endpoint**: `POST /api/admin/dates/backfill?limit=N` processes signals with unknown date sources

### Advanced Monitoring & Deduplication (January 2026)
- **Deduplication system** (`server/dedupe.ts`):
  - SHA256-based stable hash generation with URL canonicalization
  - Jaccard similarity for near-duplicate detection (85% threshold, 75% for same domain)
  - Novelty scoring (0-100) based on 14-day lookback window
- **Auto-prioritization** (`server/priority-scoring.ts`):
  - Deterministic priority scoring (0-100) based on signal type, sentiment, relevance
  - Weight factors: regulatory (+20), acquisitions (+20), earnings (+15), funding (+10)
  - Recommended editorial format: ignore, brief, news, or analysis
- **Scheduler improvements** (`server/scheduler.ts`):
  - Enable monitoring with `ENABLE_SCHEDULER=true` environment variable
  - Configurable cron via `MONITOR_CRON` (default: `0 6 * * *` = 6:00 AM UTC)
  - Tracks runs in `monitor_runs` table with full statistics
  - **Scheduled Production Sync**: Enable with `ENABLE_SYNC_SCHEDULER=true`
  - Sync cron via `SYNC_CRON` (default: `0 7 * * *` = 7:00 AM UTC, 1 hour after monitoring)
  - Automatically pushes companies and signals from dev to production URL (`PRODUCTION_APP_URL`)
- **New endpoints**:
  - `GET /api/monitor/runs` - List recent monitoring runs
  - `GET /api/monitor/runs/:id` - Get specific run details

### Object Storage for Persistent Images (January 2026)
- Migrated AI-generated images from ephemeral filesystem to Replit Object Storage
- Images now persist across deployments and production restarts
- New endpoint `/api/storage/images/:filename` serves images from Object Storage
- Bucket configured with `DEFAULT_OBJECT_STORAGE_BUCKET_ID` environment variable
- Public images stored in `public/generated-images/` directory within the bucket

### Claude Integration for Article Generation (January 2026)
- Added Anthropic Claude as alternative AI provider for article generation
- Supports Claude Sonnet 4.5, Opus 4.5, and Haiku 4.5 models
- UI selector in Content Publishing section to choose between OpenAI and Claude
- Lazy-loaded client to avoid startup failures when Anthropic credentials not configured
- Uses Replit AI Integrations (charges to Replit credits, no separate API key needed)

### Industry Map Feature (January 2026)
- Added interactive network visualization showing company relationships
- Relationships extracted by AI from signal text (partner, competitor, supplier, customer, etc.)
- Pagination with 150 companies per page for full dataset access
- Focus mode: double-click any company to see its complete relationship network
- Industry and relationship type filters
- Deterministic sorting by relationship degree then signal count

### Media Site CMS Integration (January 2026)
- **Endpoint**: `POST /api/articles` on external media site (configured via `MEDIA_SITE_URL` env var)
- **Payload mapping**: SignalWatch fields mapped to media site schema:
  - `headline` → `title`, `body` → `content`, `seoDescription` → `excerpt`
  - `sourceSignalId` sent as string (required by media site API)
  - Auto-generated `slug` from headline + timestamp
- **Response handling**: Constructs article URL from `slug` if not returned directly
- **Article URL format**: `{MEDIA_SITE_URL}/article/{slug}`

### Idempotent Publishing System (January 2026)
- **Duplicate prevention**: Unique constraint on `(signalId, publishedTo, style)` in articles table
- **Idempotent publish logic**: Re-publishing same signal+style reuses existing content by default
- **Force regeneration**: Optional toggle to regenerate fresh content with new AI image
- **CMS idempotency key**: `clientReferenceId` field (`signalwatch:{signalId}:{style}`) sent to CMS
- **SEO support**: `canonicalUrl` field sent to CMS, updated from CMS response after each publish
- **Tag hygiene** (`server/media-site-publisher.ts sanitizeTags()`):
  - Strips company-name-only tags to ensure diversity
  - Auto-adds topic tag based on signal.type (e.g., "Funding", "Partnership", "Fire")
  - Ensures minimum 2 non-company tags with fallbacks ("Industry Update", "Market News")
  - Covers all signal types with "Business Update" fallback for unknown types
- **UI improvements**: 
  - Toggle switch in publish dialog to control regeneration
  - "Published to Baking & Milling" toast with clickable "View Article" link
- **Storage methods added**: `getArticleBySignalAndStyle()`, `updateArticle()` for article management

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with React plugin

The frontend follows a component-based architecture with:
- Page components in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/` (shadcn)
- Feature components in `client/src/components/`
- Custom hooks in `client/src/hooks/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API endpoints under `/api/`
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Build**: esbuild for production bundling

Key backend modules:
- `server/routes.ts` - API route definitions
- `server/storage.ts` - Database access layer with typed interfaces
- `server/db.ts` - Database connection pool
- `server/ai-analysis.ts` - OpenAI integration for signal analysis

### Data Model
Core entities defined in `shared/schema.ts`:
- **Companies**: Businesses being monitored with metadata (industry, location, social links)
- **Signals**: Business events/news associated with companies (funding, exec changes, news)
- **Alerts**: User-configured notifications for specific signal types
- **Users**: Team members with roles
- **Activity Log**: Audit trail of user actions
- **Conversations/Messages**: Chat functionality with AI

### Design Patterns
- **Shared Schema**: Types and validation schemas shared between frontend and backend via `@shared/` path alias
- **Query-based Data Fetching**: React Query handles caching, refetching, and optimistic updates
- **Component Composition**: shadcn/ui provides unstyled, accessible primitives customized via Tailwind

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connected via `DATABASE_URL` environment variable
- **Drizzle Kit**: Schema migrations via `drizzle-kit push`

### AI Services
- **OpenAI API**: Used for signal analysis, chat, and article generation
  - Configured via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Signal analysis: entity extraction, sentiment, priority
  - Article generation: news articles, briefs, analysis pieces from signals
  - CMS export: WordPress, Contentful, Markdown, JSON formats
- **Anthropic Claude API**: Alternative AI provider for article generation
  - Configured via `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
  - Supports Sonnet 4.5, Opus 4.5, and Haiku 4.5 models
  - Lazy-loaded to avoid startup failures when not configured

### Third-Party Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tabs, etc.)
- **date-fns**: Date formatting and manipulation
- **Zod**: Runtime schema validation
- **react-hook-form**: Form state management with Zod resolver
- **Cheerio**: HTML parsing for web scraping capabilities
- **p-limit/p-retry**: Batch processing with rate limiting

### Development Tools
- **Vite**: Development server with HMR
- **Replit Plugins**: Dev banner, cartographer, and runtime error overlay for Replit environment