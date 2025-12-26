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
  size: text("size"),
  founded: text("founded"),
  tags: text("tags").array(),
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
  publishedAt: timestamp("published_at"),
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

// Re-export chat models for OpenAI integration
export * from "./models/chat";
