import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for team members
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: text("role").default("editor"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  avatarUrl: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Companies table - core entity for monitoring businesses
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  description: text("description"),
  logoUrl: text("logo_url"),
  location: text("location"),
  region: text("region"),
  country: text("country"),
  size: text("size"),
  founded: text("founded"),
  tags: text("tags").array(),
  productTypes: text("product_types").array(),
  rssFeedUrl: text("rss_feed_url"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  signals: many(signals),
  alerts: many(alerts),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Signal types enum
export const signalTypes = [
  "news",
  "press_release",
  "job_posting",
  "funding",
  "executive_change",
  "product_launch",
  "partnership",
  "acquisition",
  "website_change",
  "social_media",
  "regulatory",
  "earnings",
  "other",
] as const;

export type SignalType = (typeof signalTypes)[number];

// Theme taxonomy for signal classification
export const signalThemes = [
  "hiring_pressure",
  "capacity_expansion",
  "regulatory_risk",
  "supply_chain",
  "m_a_activity",
  "market_expansion",
  "cost_pressures",
  "sustainability",
  "leadership_change",
  "product_innovation",
] as const;

export type SignalTheme = (typeof signalThemes)[number];

// Date source types for tracking how publishedAt was determined
export const dateSourceTypes = [
  "metadata",   // From schema.org, OpenGraph, or meta tags
  "rss",        // From RSS feed timestamp
  "content",    // Parsed from page content
  "manual",     // Manually set by editor
  "unknown",    // Could not determine source
] as const;

export type DateSource = (typeof dateSourceTypes)[number];

// Source status types for tracking URL accessibility
export const sourceStatusTypes = [
  "accessible",    // URL was reachable and content fetched
  "inaccessible",  // URL returned 4xx/5xx error or connection failed
  "timeout",       // URL request timed out
  "blocked",       // Access blocked by robots/paywall
  "unknown",       // Not yet checked
] as const;

export type SourceStatus = (typeof sourceStatusTypes)[number];

// ============================================
// Sources & Ingestion System (PR1)
// ============================================

// Source types for the ingestion system
export const sourceTypes = [
  "rss",
  "feedly",
  "crawl",
  "regulator",
  "association",
  "llm",
] as const;

export type SourceType = (typeof sourceTypes)[number];

// Source categories for classification
export const sourceCategories = [
  "regulatory",
  "company",
  "trade_publication",
  "trade_association",
] as const;

export type SourceCategory = (typeof sourceCategories)[number];

// Verification status for sources
export const sourceVerificationStatuses = [
  "verified",
  "needs_review",
  "broken",
] as const;

export type SourceVerificationStatus = (typeof sourceVerificationStatuses)[number];

// Signal verification statuses
export const signalVerificationStatuses = [
  "verified",
  "unverified",
  "rejected",
] as const;

export type SignalVerificationStatus = (typeof signalVerificationStatuses)[number];

// Sources table - tracks where signals come from
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  category: text("category"),
  url: text("url"),
  domain: text("domain"),
  trustScore: integer("trust_score").default(50),
  verificationStatus: text("verification_status").default("needs_review"),
  isActive: boolean("is_active").default(true),
  lastVerifiedAt: timestamp("last_verified_at"),
  lastIngestedAt: timestamp("last_ingested_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSourceSchema = createInsertSchema(sources).omit({
  id: true,
  createdAt: true,
});

export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Source = typeof sources.$inferSelect;

// Source markets - what markets/regions a source covers
export const sourceMarkets = pgTable("source_markets", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
});

export const sourceMarketsRelations = relations(sourceMarkets, ({ one }) => ({
  source: one(sources, {
    fields: [sourceMarkets.sourceId],
    references: [sources.id],
  }),
}));

export const insertSourceMarketSchema = createInsertSchema(sourceMarkets).omit({
  id: true,
});

export type InsertSourceMarket = z.infer<typeof insertSourceMarketSchema>;
export type SourceMarket = typeof sourceMarkets.$inferSelect;

// Company-source relationships (which companies are covered by which sources)
export const companySources = pgTable("company_sources", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type"),
});

export const companySourcesRelations = relations(companySources, ({ one }) => ({
  company: one(companies, {
    fields: [companySources.companyId],
    references: [companies.id],
  }),
  source: one(sources, {
    fields: [companySources.sourceId],
    references: [sources.id],
  }),
}));

export const insertCompanySourceSchema = createInsertSchema(companySources).omit({
  id: true,
});

export type InsertCompanySource = z.infer<typeof insertCompanySourceSchema>;
export type CompanySource = typeof companySources.$inferSelect;

// Ingestion runs - tracks batch ingestion jobs
export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
  sourceType: text("source_type"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  itemsFound: integer("items_found").default(0),
  itemsCreated: integer("items_created").default(0),
  errors: jsonb("errors"),
});

export const ingestionRunsRelations = relations(ingestionRuns, ({ one }) => ({
  source: one(sources, {
    fields: [ingestionRuns.sourceId],
    references: [sources.id],
  }),
}));

export const insertIngestionRunSchema = createInsertSchema(ingestionRuns).omit({
  id: true,
  startedAt: true,
});

export type InsertIngestionRun = z.infer<typeof insertIngestionRunSchema>;
export type IngestionRun = typeof ingestionRuns.$inferSelect;

// ============================================
// End Sources & Ingestion System
// ============================================

// Signals table - captured business intelligence
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  summary: text("summary"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  citations: text("citations").array().default([]),
  publishedAt: timestamp("published_at"),
  gatheredAt: timestamp("gathered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  sentiment: text("sentiment"),
  entities: jsonb("entities"),
  priority: text("priority").default("medium"),
  isRead: boolean("is_read").default(false),
  isBookmarked: boolean("is_bookmarked").default(false),
  assignedTo: varchar("assigned_to").references(() => users.id),
  contentStatus: text("content_status").default("new"),
  notes: text("notes"),
  aiAnalysis: jsonb("ai_analysis"),
  hash: text("hash"),
  themes: text("themes").array().default([]),
  themesVersion: integer("themes_version").default(1),
  dateSource: text("date_source").default("unknown"),
  dateConfidence: integer("date_confidence").default(0),
  needsDateReview: boolean("needs_date_review").default(false),
  sourceStatus: text("source_status").default("unknown"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  // PR1: Signal provenance fields
  ingestionSourceType: text("ingestion_source_type").default("llm_discovery"),
  verificationStatus: text("verification_status").default("unverified"),
  verificationMethod: text("verification_method"),
  sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
  providerName: text("provider_name"),
  providerItemId: text("provider_item_id"),
  canonicalUrl: text("canonical_url"),
});

export const signalsRelations = relations(signals, ({ one }) => ({
  company: one(companies, {
    fields: [signals.companyId],
    references: [companies.id],
  }),
  assignee: one(users, {
    fields: [signals.assignedTo],
    references: [users.id],
  }),
}));

export const insertSignalSchema = createInsertSchema(signals).omit({
  id: true,
  createdAt: true,
  gatheredAt: true,
});

export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signals.$inferSelect;

// Alert trigger types
export const alertTriggerTypes = [
  "any_signal",
  "funding_announcement",
  "executive_change",
  "product_launch",
  "partnership",
  "acquisition",
  "negative_news",
  "positive_news",
  "job_posting_spike",
  "custom_keyword",
] as const;

export type AlertTriggerType = (typeof alertTriggerTypes)[number];

// Alerts table - notification rules
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  keywords: text("keywords").array(),
  isActive: boolean("is_active").default(true),
  notificationChannel: text("notification_channel").default("dashboard"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const alertsRelations = relations(alerts, ({ one }) => ({
  company: one(companies, {
    fields: [alerts.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [alerts.createdBy],
    references: [users.id],
  }),
}));

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Company relationship types
export const relationshipTypes = [
  "partner",
  "competitor",
  "supplier",
  "customer",
  "acquired",
  "investor",
  "subsidiary",
  "joint_venture",
  "distributor",
] as const;

export type RelationshipType = (typeof relationshipTypes)[number];

// Company relationships table for industry map
export const companyRelationships = pgTable("company_relationships", {
  id: serial("id").primaryKey(),
  sourceCompanyId: integer("source_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  targetCompanyId: integer("target_company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  strength: integer("strength").default(1),
  description: text("description"),
  sourceSignalId: integer("source_signal_id").references(() => signals.id),
  isAiExtracted: boolean("is_ai_extracted").default(false),
  confidence: integer("confidence").default(100),
  firstSeenAt: timestamp("first_seen_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSeenAt: timestamp("last_seen_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const companyRelationshipsRelations = relations(companyRelationships, ({ one }) => ({
  sourceCompany: one(companies, {
    fields: [companyRelationships.sourceCompanyId],
    references: [companies.id],
  }),
  targetCompany: one(companies, {
    fields: [companyRelationships.targetCompanyId],
    references: [companies.id],
  }),
  sourceSignal: one(signals, {
    fields: [companyRelationships.sourceSignalId],
    references: [signals.id],
  }),
}));

export const insertCompanyRelationshipSchema = createInsertSchema(companyRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompanyRelationship = z.infer<typeof insertCompanyRelationshipSchema>;
export type CompanyRelationship = typeof companyRelationships.$inferSelect;

// Published destinations for articles
export const publishDestinations = [
  "media_site",
  "wordpress",
  "export_markdown",
  "export_json",
] as const;

export type PublishDestination = (typeof publishDestinations)[number];

// Generated articles table - tracks article history
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").notNull().references(() => signals.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  headline: text("headline").notNull(),
  subheadline: text("subheadline"),
  body: text("body").notNull(),
  style: text("style").notNull(),
  publishedTo: text("published_to"),
  externalUrl: text("external_url"),
  externalId: text("external_id"),
  imageUrl: text("image_url"),
  keyTakeaways: jsonb("key_takeaways"),
  seoDescription: text("seo_description"),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("articles_signal_published_style_unique").on(table.signalId, table.publishedTo, table.style),
]);

export const articlesRelations = relations(articles, ({ one }) => ({
  signal: one(signals, {
    fields: [articles.signalId],
    references: [signals.id],
  }),
  company: one(companies, {
    fields: [articles.companyId],
    references: [companies.id],
  }),
}));

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

// Activity log for team collaboration
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

// Monitor runs table - tracks monitoring job history
export const monitorRuns = pgTable("monitor_runs", {
  id: serial("id").primaryKey(),
  scope: text("scope").notNull(),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  finishedAt: timestamp("finished_at"),
  signalsFound: integer("signals_found").default(0),
  signalsCreated: integer("signals_created").default(0),
  duplicatesSkipped: integer("duplicates_skipped").default(0),
  nearDuplicatesSkipped: integer("near_duplicates_skipped").default(0),
  status: text("status").default("running"),
  error: text("error"),
});

export const insertMonitorRunSchema = createInsertSchema(monitorRuns).omit({
  id: true,
  startedAt: true,
});

export type InsertMonitorRun = z.infer<typeof insertMonitorRunSchema>;
export type MonitorRun = typeof monitorRuns.$inferSelect;

// ============================================
// Signal Graph Tables (Phase 1)
// ============================================

// Entity types for the graph
export const entityTypes = [
  "company",
  "regulator",
  "commodity",
  "ingredient",
  "product",
  "facility",
  "disease",
  "geography",
  "person",
  "standard_program",
] as const;

export type EntityType = (typeof entityTypes)[number];

// Entity roles in signals
export const entityRoles = [
  "subject",
  "investor",
  "competitor",
  "partner",
  "supplier",
  "customer",
  "acquired",
  "actor",
  "target",
  "location",
  "other",
] as const;

export type EntityRole = (typeof entityRoles)[number];

// Canonical entities table - shared nodes across signals
export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  canonicalKey: text("canonical_key").notNull().unique(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const entitiesRelations = relations(entities, ({ many }) => ({
  aliases: many(entityAliases),
  signalLinks: many(signalEntities),
}));

export const insertEntitySchema = createInsertSchema(entities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entities.$inferSelect;

// Entity aliases for fuzzy matching
export const entityAliases = pgTable("entity_aliases", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  aliasKey: text("alias_key").notNull().unique(),
  source: text("source"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const entityAliasesRelations = relations(entityAliases, ({ one }) => ({
  entity: one(entities, {
    fields: [entityAliases.entityId],
    references: [entities.id],
  }),
}));

export const insertEntityAliasSchema = createInsertSchema(entityAliases).omit({
  id: true,
  createdAt: true,
});

export type InsertEntityAlias = z.infer<typeof insertEntityAliasSchema>;
export type EntityAlias = typeof entityAliases.$inferSelect;

// Signal-entity links (many-to-many with role and confidence)
export const signalEntities = pgTable("signal_entities", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").notNull().references(() => signals.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  confidence: integer("confidence").notNull().default(80),
  surface: text("surface"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const signalEntitiesRelations = relations(signalEntities, ({ one }) => ({
  signal: one(signals, {
    fields: [signalEntities.signalId],
    references: [signals.id],
  }),
  entity: one(entities, {
    fields: [signalEntities.entityId],
    references: [entities.id],
  }),
}));

export const insertSignalEntitySchema = createInsertSchema(signalEntities).omit({
  id: true,
  createdAt: true,
});

export type InsertSignalEntity = z.infer<typeof insertSignalEntitySchema>;
export type SignalEntity = typeof signalEntities.$inferSelect;

// Signal metrics table - rolling counts for trend analysis
export const metricScopeTypes = ["industry", "company", "theme"] as const;
export type MetricScopeType = (typeof metricScopeTypes)[number];

export const metricPeriods = ["7d", "30d", "prev_30d"] as const;
export type MetricPeriod = (typeof metricPeriods)[number];

export const signalMetrics = pgTable("signal_metrics", {
  id: serial("id").primaryKey(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  signalType: text("signal_type"),
  theme: text("theme"),
  period: text("period").notNull(),
  currentCount: integer("current_count").notNull().default(0),
  prevCount: integer("prev_count"),
  deltaPercent: numeric("delta_percent"),
  capturedAt: timestamp("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("signal_metrics_captured_scope_idx").on(table.capturedAt, table.scopeType),
  index("signal_metrics_scope_period_idx").on(table.scopeType, table.scopeId, table.period),
  index("signal_metrics_theme_period_idx").on(table.theme, table.period, table.capturedAt),
]);

export const insertSignalMetricSchema = createInsertSchema(signalMetrics).omit({
  id: true,
  capturedAt: true,
});

export type InsertSignalMetric = z.infer<typeof insertSignalMetricSchema>;
export type SignalMetric = typeof signalMetrics.$inferSelect;

// Trends table - aggregated intelligence with AI explanations
export const trendScopeTypes = ["industry", "company", "region", "theme"] as const;
export type TrendScopeType = (typeof trendScopeTypes)[number];

export const trendTimeWindows = ["7d", "30d", "90d"] as const;
export type TrendTimeWindow = (typeof trendTimeWindows)[number];

export const trendDirections = ["up", "down", "flat"] as const;
export type TrendDirection = (typeof trendDirections)[number];

export const trends = pgTable("trends", {
  id: serial("id").primaryKey(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  signalTypes: text("signal_types").array().default([]),
  themes: text("themes").array().default([]),
  timeWindow: text("time_window").notNull(),
  direction: text("direction").notNull(),
  magnitude: numeric("magnitude"),
  confidence: integer("confidence").default(50),
  explanation: text("explanation"),
  generatedAt: timestamp("generated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("trends_scope_idx").on(table.scopeType, table.scopeId),
  index("trends_generated_idx").on(table.generatedAt),
]);

export const insertTrendSchema = createInsertSchema(trends).omit({
  id: true,
  generatedAt: true,
});

export type InsertTrend = z.infer<typeof insertTrendSchema>;
export type Trend = typeof trends.$inferSelect;

// Re-export chat models for OpenAI integration
export * from "./models/chat";
