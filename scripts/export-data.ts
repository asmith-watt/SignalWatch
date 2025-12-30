import { db } from "../server/db";
import { companies, signals, alerts, users, conversations, messages, activityLog } from "../shared/schema";
import * as fs from "fs";

function escapeString(str: string | null | undefined): string {
  if (str === null || str === undefined) return "NULL";
  return `'${str.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return escapeString(val.toISOString());
  if (Array.isArray(val)) {
    const items = val.map(v => typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : String(v));
    return `'{${items.join(",")}}'`;
  }
  if (typeof val === "object") return escapeString(JSON.stringify(val));
  return escapeString(String(val));
}

async function exportData() {
  const output: string[] = [];
  
  output.push("-- SignalWatch Data Export");
  output.push("-- Generated: " + new Date().toISOString());
  output.push("-- Run this in your PRODUCTION database via the Database pane");
  output.push("");
  output.push("-- Clear existing data (optional - uncomment if you want to replace all data)");
  output.push("-- TRUNCATE companies, signals, alerts, users, conversations, messages, activity_log CASCADE;");
  output.push("");
  
  const allCompanies = await db.select().from(companies).orderBy(companies.id);
  output.push(`-- Companies (${allCompanies.length} rows)`);
  for (const c of allCompanies) {
    output.push(`INSERT INTO companies (id, name, website, industry, description, logo_url, location, size, founded, tags, rss_feed_url, linkedin_url, twitter_handle, is_active, created_at, updated_at, region, country, product_types) VALUES (${c.id}, ${formatValue(c.name)}, ${formatValue(c.website)}, ${formatValue(c.industry)}, ${formatValue(c.description)}, ${formatValue(c.logoUrl)}, ${formatValue(c.location)}, ${formatValue(c.size)}, ${formatValue(c.founded)}, ${formatValue(c.tags)}, ${formatValue(c.rssFeedUrl)}, ${formatValue(c.linkedinUrl)}, ${formatValue(c.twitterHandle)}, ${formatValue(c.isActive)}, ${formatValue(c.createdAt)}, ${formatValue(c.updatedAt)}, ${formatValue(c.region)}, ${formatValue(c.country)}, ${formatValue(c.productTypes)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  const allSignals = await db.select().from(signals).orderBy(signals.id);
  output.push(`-- Signals (${allSignals.length} rows)`);
  for (const s of allSignals) {
    output.push(`INSERT INTO signals (id, company_id, type, title, content, summary, source_url, source_name, published_at, sentiment, entities, priority, is_read, is_bookmarked, assigned_to, content_status, notes, ai_analysis, hash, created_at) VALUES (${s.id}, ${formatValue(s.companyId)}, ${formatValue(s.type)}, ${formatValue(s.title)}, ${formatValue(s.content)}, ${formatValue(s.summary)}, ${formatValue(s.sourceUrl)}, ${formatValue(s.sourceName)}, ${formatValue(s.publishedAt)}, ${formatValue(s.sentiment)}, ${formatValue(s.entities)}, ${formatValue(s.priority)}, ${formatValue(s.isRead)}, ${formatValue(s.isBookmarked)}, ${formatValue(s.assignedTo)}, ${formatValue(s.contentStatus)}, ${formatValue(s.notes)}, ${formatValue(s.aiAnalysis)}, ${formatValue(s.hash)}, ${formatValue(s.createdAt)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  const allAlerts = await db.select().from(alerts).orderBy(alerts.id);
  output.push(`-- Alerts (${allAlerts.length} rows)`);
  for (const a of allAlerts) {
    output.push(`INSERT INTO alerts (id, company_id, name, trigger_type, keywords, is_active, notification_channel, created_by, created_at) VALUES (${a.id}, ${formatValue(a.companyId)}, ${formatValue(a.name)}, ${formatValue(a.triggerType)}, ${formatValue(a.keywords)}, ${formatValue(a.isActive)}, ${formatValue(a.notificationChannel)}, ${formatValue(a.createdBy)}, ${formatValue(a.createdAt)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  const allUsers = await db.select().from(users).orderBy(users.id);
  output.push(`-- Users (${allUsers.length} rows)`);
  for (const u of allUsers) {
    output.push(`INSERT INTO users (id, username, password, display_name, avatar_url, role) VALUES (${u.id}, ${formatValue(u.username)}, ${formatValue(u.password)}, ${formatValue(u.displayName)}, ${formatValue(u.avatarUrl)}, ${formatValue(u.role)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  const allConversations = await db.select().from(conversations).orderBy(conversations.id);
  output.push(`-- Conversations (${allConversations.length} rows)`);
  for (const c of allConversations) {
    output.push(`INSERT INTO conversations (id, title, created_at) VALUES (${c.id}, ${formatValue(c.title)}, ${formatValue(c.createdAt)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  const allMessages = await db.select().from(messages).orderBy(messages.id);
  output.push(`-- Messages (${allMessages.length} rows)`);
  for (const m of allMessages) {
    output.push(`INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (${m.id}, ${formatValue(m.conversationId)}, ${formatValue(m.role)}, ${formatValue(m.content)}, ${formatValue(m.createdAt)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  const allActivity = await db.select().from(activityLog).orderBy(activityLog.id);
  output.push(`-- Activity Log (${allActivity.length} rows)`);
  for (const a of allActivity) {
    output.push(`INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (${a.id}, ${formatValue(a.userId)}, ${formatValue(a.action)}, ${formatValue(a.entityType)}, ${formatValue(a.entityId)}, ${formatValue(a.details)}, ${formatValue(a.createdAt)}) ON CONFLICT (id) DO NOTHING;`);
  }
  output.push("");
  
  output.push("-- Reset sequences to continue from max ID");
  output.push("SELECT setval('companies_id_seq', (SELECT COALESCE(MAX(id), 0) FROM companies));");
  output.push("SELECT setval('signals_id_seq', (SELECT COALESCE(MAX(id), 0) FROM signals));");
  output.push("SELECT setval('alerts_id_seq', (SELECT COALESCE(MAX(id), 0) FROM alerts));");
  output.push("SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) FROM users));");
  output.push("SELECT setval('conversations_id_seq', (SELECT COALESCE(MAX(id), 0) FROM conversations));");
  output.push("SELECT setval('messages_id_seq', (SELECT COALESCE(MAX(id), 0) FROM messages));");
  output.push("SELECT setval('activity_log_id_seq', (SELECT COALESCE(MAX(id), 0) FROM activity_log));");
  
  const sql = output.join("\n");
  fs.writeFileSync("production-data.sql", sql);
  
  console.log(`Export complete! File saved to: production-data.sql`);
  console.log(`Total: ${allCompanies.length} companies, ${allSignals.length} signals, ${allAlerts.length} alerts`);
}

exportData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
