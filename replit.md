# SignalWatch - B2B Business Intelligence Platform

## Overview

SignalWatch is a B2B business intelligence platform designed for editorial teams to monitor companies and track business signals. The application allows users to track 300+ companies, collecting and analyzing signals from news, funding announcements, executive changes, job postings, and other business events. It features AI-powered analysis to help teams prioritize and act on relevant business intelligence.

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
- **OpenAI API**: Used for signal analysis and chat features
  - Configured via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Supports text analysis and image generation (gpt-image-1)

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