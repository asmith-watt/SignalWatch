import { db } from "../server/db";
import { companies, signals } from "../shared/schema";
import * as fs from "fs";

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportCSV() {
  // Export companies
  const allCompanies = await db.select().from(companies).orderBy(companies.id);
  const companyHeaders = ["id", "name", "website", "industry", "description", "logo_url", "location", "region", "country", "size", "founded", "tags", "product_types", "rss_feed_url", "linkedin_url", "twitter_handle", "is_active", "created_at", "updated_at"];
  
  const companyRows = allCompanies.map(c => [
    c.id, c.name, c.website, c.industry, c.description, c.logoUrl, c.location, c.region, c.country, c.size, c.founded, 
    c.tags ? JSON.stringify(c.tags) : "", 
    c.productTypes ? JSON.stringify(c.productTypes) : "",
    c.rssFeedUrl, c.linkedinUrl, c.twitterHandle, c.isActive, c.createdAt?.toISOString(), c.updatedAt?.toISOString()
  ].map(escapeCSV).join(","));
  
  const companiesCSV = [companyHeaders.join(","), ...companyRows].join("\n");
  fs.writeFileSync("companies-export.csv", companiesCSV);
  console.log(`Exported ${allCompanies.length} companies to companies-export.csv`);

  // Export signals
  const allSignals = await db.select().from(signals).orderBy(signals.id);
  const signalHeaders = ["id", "company_id", "type", "title", "content", "summary", "source_url", "source_name", "published_at", "sentiment", "entities", "priority", "is_read", "is_bookmarked", "assigned_to", "content_status", "notes", "ai_analysis", "hash", "created_at"];
  
  const signalRows = allSignals.map(s => [
    s.id, s.companyId, s.type, s.title, s.content, s.summary, s.sourceUrl, s.sourceName, 
    s.publishedAt?.toISOString(), s.sentiment, 
    s.entities ? JSON.stringify(s.entities) : "",
    s.priority, s.isRead, s.isBookmarked, s.assignedTo, s.contentStatus, s.notes,
    s.aiAnalysis ? JSON.stringify(s.aiAnalysis) : "",
    s.hash, s.createdAt?.toISOString()
  ].map(escapeCSV).join(","));
  
  const signalsCSV = [signalHeaders.join(","), ...signalRows].join("\n");
  fs.writeFileSync("signals-export.csv", signalsCSV);
  console.log(`Exported ${allSignals.length} signals to signals-export.csv`);
}

exportCSV().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
