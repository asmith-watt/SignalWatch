# Design Guidelines: B2B Business Intelligence Platform

## Design Approach

**Selected System**: Linear-inspired modern productivity interface with enterprise data management patterns

**Design Philosophy**: This is a professional data tool for editorial teams - prioritize information density, efficient workflows, and rapid scanning of business signals. Clean, functional aesthetics that reduce cognitive load while displaying complex information.

---

## Typography System

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN) - excellent for data-heavy interfaces
- Monospace: JetBrains Mono - for metadata, timestamps, URLs

**Hierarchy**:
- Page Titles: text-2xl font-semibold (32px)
- Section Headers: text-xl font-semibold (24px)
- Card/Component Titles: text-lg font-medium (20px)
- Body Text: text-sm font-normal (14px)
- Metadata/Labels: text-xs font-medium uppercase tracking-wide (12px)
- Timestamps/Secondary: text-xs text-muted-foreground (12px)

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, 8, 12, 16
- Tight spacing: p-2, gap-2 (component internals)
- Standard spacing: p-4, gap-4 (cards, sections)
- Generous spacing: p-6, gap-6 (page sections)
- Large spacing: p-8, gap-8 (major layout divisions)

**Container Strategy**:
- Max width: max-w-7xl mx-auto for main content
- Sidebar: fixed w-64 for company list navigation
- Main content area: flex-1 with proper breathing room
- No artificial viewport constraints - natural scrolling

---

## Core Components

### Dashboard Layout
**Structure**: Sidebar + Main Content Area
- Left sidebar (w-64): Company list with search, filters, add button
- Main area: Selected company details with tabbed navigation (Signals, Timeline, Profile, Alerts)
- Top bar: Global search, team indicators, notification bell, user menu

### Company Cards (Sidebar)
- Avatar/logo placeholder (h-10 w-10 rounded)
- Company name (font-medium)
- Industry tag (text-xs badge)
- Unread signal count (small badge with number)
- Last activity timestamp (text-xs muted)
- Hover state shows quick action buttons

### Signal Feed Cards
- Signal type icon (left aligned, h-5 w-5)
- Headline/title (font-medium, line-clamp-2)
- Source and timestamp metadata (text-xs, flex row)
- AI-generated summary (text-sm, line-clamp-3, expandable)
- Tags row (flex wrap, small pill badges)
- Action buttons (bookmark, assign to team member, create content)
- Divider between cards (border-b)

### Timeline View
- Vertical timeline with connecting line
- Date markers on left (sticky positioning for current date)
- Signal cards attached to timeline points
- Grouping by week/month with collapsible sections
- Visual density controls (compact/comfortable/spacious toggle)

### Company Profile Header
- Large company name and logo area
- Key metadata grid (3-4 columns): Industry, Size, Location, Website
- Quick stats row: Total signals, Last update, Active alerts, Team notes
- Action bar: Edit profile, Configure alerts, Export data, Archive

### Signal Analysis Panel
- Two-column layout when viewing individual signal
- Left: Full signal content with source link
- Right: AI analysis (entities, sentiment score, related signals, suggested actions)
- Bottom: Team collaboration area (notes, assignments, content status)

### Filtering System
- Filter bar always visible at top of signal feed
- Multi-select dropdowns: Signal type, Date range, Priority, Team member
- Active filters show as dismissible chips
- Saved filter presets dropdown
- Results count indicator

### Alert Configuration
- Table view of all alert rules
- Columns: Company, Trigger type, Notification channel, Status, Actions
- Inline editing for quick changes
- Add new rule button (prominent, top-right)
- Alert preview/test functionality

### Search Interface
- Global search bar (⌘K shortcut indicator)
- Search across companies, signals, and content
- Recent searches dropdown
- Advanced search toggle (filters, boolean operators)
- Results grouped by type with counts

### Team Collaboration
- Inline commenting on signals
- Assignment system with user avatars
- Activity feed showing team actions
- @mention support in notes
- Status labels (New, Reviewing, Writing, Published)

---

## Data Visualization

**Signal Volume Chart**:
- Line chart showing signal count over time per company
- Bar chart for signal type distribution
- Sparklines in company cards for quick trends

**Trend Indicators**:
- Up/down arrows with percentage changes
- Visual severity indicators for urgent signals
- Color-coded priority badges (use semantic meanings, not specific colors)

---

## Tables

**Structure**: Alternating row backgrounds for scannability
- Dense padding (py-2 px-4)
- Sortable column headers with indicators
- Fixed header on scroll
- Row actions appear on hover
- Checkbox column for bulk operations
- Sticky first column for company names

---

## Forms

**Add/Edit Company**:
- Single column layout (max-w-2xl)
- Logical grouping with section headers
- Required field indicators
- Inline validation with helpful messages
- Auto-save indicator
- Cancel and Save buttons (right-aligned)

**Alert Rule Builder**:
- Step-by-step flow with progress indicator
- Conditional fields based on trigger type
- Test alert button before saving
- Template selector for common patterns

---

## Navigation

**Sidebar Navigation**:
- Active state clearly distinguished
- Icon + label for main sections
- Collapsible company groups
- Search filter at top
- Add company button (prominent)

**Tab Navigation** (within company view):
- Horizontal tabs below company header
- Active tab indicator (underline)
- Badge counts on relevant tabs
- Keyboard navigation support

---

## State Handling

**Loading States**: Skeleton screens matching content structure
**Empty States**: Friendly illustrations with clear CTAs ("Add your first company to start monitoring")
**Error States**: Inline error messages with retry options
**Success Feedback**: Toast notifications (top-right, auto-dismiss)

---

## Responsive Behavior

**Desktop-First Design** (this is a professional tool):
- Optimized for 1440px+ displays
- Minimum viable width: 1024px
- Sidebar collapses to icons-only on medium screens
- Mobile: Stack layout, prioritize signal feed

---

## Performance Considerations

- Virtualized lists for 300+ companies
- Lazy loading for signal feeds
- Pagination for timeline (load more on scroll)
- Debounced search inputs
- Optimistic UI updates for interactions