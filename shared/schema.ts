import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

// Signals table - captured business intelligence
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
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
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

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

// Re-export chat models for OpenAI integration
export * from "./models/chat";
