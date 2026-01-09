# SignalWatch - B2B Business Intelligence Platform

## Overview
SignalWatch is a B2B business intelligence platform designed for editorial teams to monitor 900+ companies and track business signals. It collects and analyzes signals from various sources like news, funding announcements, executive changes, and job postings. The platform uses AI-powered analysis to help teams prioritize relevant business intelligence, generate trend summaries, and manage content publication. Its core purpose is to provide timely, curated insights to editorial teams, enhancing their market understanding and content creation processes.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, using Wouter for routing and TanStack React Query for server state management. UI components are developed using shadcn/ui (based on Radix UI primitives) and styled with Tailwind CSS, utilizing custom design tokens and CSS variables for theming. Vite serves as the build tool. The architecture is component-based, with clear separation for pages, reusable UI, feature components, and custom hooks.

### Backend Architecture
The backend is a Node.js Express application written in TypeScript (ESM modules), providing a RESTful JSON API. Drizzle ORM is used for database interaction with PostgreSQL. Key modules include API route definitions (`server/routes.ts`), a database access layer (`server/storage.ts`), database connection management (`server/db.ts`), and OpenAI integration for AI analysis (`server/ai-analysis.ts`).

### Data Model
Core entities, defined in `shared/schema.ts`, include:
- **Companies**: Monitored businesses with metadata.
- **Signals**: Business events (e.g., funding, exec changes) linked to companies, with provenance information (source type, verification status, canonical URL).
- **Sources**: Tracks origin of signals (RSS, Feedly, crawl, LLM) with trust scores.
- **Ingestion Runs**: Records batch ingestion job statistics.
- **Signal Metrics**: Daily snapshots of signal counts and trends.
- **Trends**: AI-generated summaries of industry trends.
- **Alerts**: User-configured notifications.
- **Users**: Team members with roles.
- **Activity Log**: Audit trail.

### Design Patterns
The system leverages a shared schema for type and validation consistency between frontend and backend. React Query is central to data fetching, handling caching, refetching, and optimistic updates. Component composition using shadcn/ui provides accessible and customizable UI elements. A robust deduplication system uses SHA256 hashing and Jaccard similarity for near-duplicate detection. An auto-prioritization system scores signals based on type, sentiment, and relevance. The publishing system is idempotent, preventing duplicate articles and allowing forced regeneration.

### Key Features
- **Signal Ingestion**: Workers for RSS and Feedly ingestion with URL canonicalization, SHA256-based deduplication, and Jaccard similarity for near-duplicate detection.
- **Signal Management**: UI for filtering signals by verification status, source type, and a Discovery Inbox for reviewing unverified signals.
- **Source Management**: UI for managing and discovering sources, including domain and web discovery modes.
- **Intelligence Layer**: Daily signal metrics and weekly AI-generated trend summaries for industries, incorporating baseline guardrails for emerging activities.
- **Date Verification**: Admin UI for reviewing and backfilling signal dates with quality metrics.
- **Advanced Monitoring & Deduplication**: Scheduled monitoring runs with detailed statistics and a robust deduplication system.
- **Article Generation**: AI-powered article generation from signals, supporting multiple AI providers.
- **Idempotent Publishing**: System for publishing articles to external CMS with unique constraints and SEO support.
- **Industry Map**: Interactive network visualization of company relationships extracted by AI.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: Used for schema migrations.

### AI Services
- **OpenAI API**: Used for signal analysis (entity extraction, sentiment, priority), chat, and article generation.
- **Anthropic Claude API**: Alternative AI provider for article generation (supports Sonnet 4.5, Opus 4.5, Haiku 4.5). Integrated via Replit AI Integrations.

### Third-Party Libraries
- **Radix UI**: Accessible component primitives.
- **date-fns**: Date formatting and manipulation.
- **Zod**: Runtime schema validation.
- **react-hook-form**: Form state management with Zod resolver.
- **Cheerio**: HTML parsing for web scraping.
- **p-limit/p-retry**: For batch processing with rate limiting.

### Infrastructure
- **Replit Object Storage**: Used for persistent storage of AI-generated images.

### Integrations
- **Media Site CMS**: External CMS integration for publishing articles via a configurable endpoint, mapping SignalWatch fields to the CMS schema.