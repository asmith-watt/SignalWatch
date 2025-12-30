import { db } from "../server/db";
import { companies, signals } from "../shared/schema";
import * as fs from "fs";

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseValue(val: string, type: "string" | "number" | "boolean" | "json" | "date"): any {
  if (!val || val === "") return null;
  switch (type) {
    case "number": return parseInt(val, 10);
    case "boolean": return val === "true";
    case "json": try { return JSON.parse(val); } catch { return null; }
    case "date": return new Date(val);
    default: return val;
  }
}

async function importCompanies(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} companies...`);
  
  for (const row of rows) {
    await db.insert(companies).values({
      id: parseValue(row.id, "number"),
      name: row.name,
      website: row.website || null,
      industry: row.industry || null,
      description: row.description || null,
      logoUrl: row.logo_url || null,
      location: row.location || null,
      region: row.region || null,
      country: row.country || null,
      size: row.size || null,
      founded: row.founded || null,
      tags: parseValue(row.tags, "json"),
      productTypes: parseValue(row.product_types, "json"),
      rssFeedUrl: row.rss_feed_url || null,
      linkedinUrl: row.linkedin_url || null,
      twitterHandle: row.twitter_handle || null,
      isActive: parseValue(row.is_active, "boolean") ?? true,
    }).onConflictDoNothing();
  }
  
  console.log(`Imported ${rows.length} companies`);
}

async function importSignals(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} signals...`);
  
  for (const row of rows) {
    await db.insert(signals).values({
      id: parseValue(row.id, "number"),
      companyId: parseValue(row.company_id, "number"),
      type: row.type,
      title: row.title,
      content: row.content || null,
      summary: row.summary || null,
      sourceUrl: row.source_url || null,
      sourceName: row.source_name || null,
      publishedAt: parseValue(row.published_at, "date"),
      sentiment: row.sentiment || null,
      entities: parseValue(row.entities, "json"),
      priority: row.priority || "medium",
      isRead: parseValue(row.is_read, "boolean") ?? false,
      isBookmarked: parseValue(row.is_bookmarked, "boolean") ?? false,
      assignedTo: row.assigned_to || null,
      contentStatus: row.content_status || "new",
      notes: row.notes || null,
      aiAnalysis: parseValue(row.ai_analysis, "json"),
      hash: row.hash || null,
    }).onConflictDoNothing();
  }
  
  console.log(`Imported ${rows.length} signals`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("Usage:");
    console.log("  npx tsx scripts/import-csv.ts companies companies-export.csv");
    console.log("  npx tsx scripts/import-csv.ts signals signals-export.csv");
    process.exit(1);
  }
  
  const [type, filePath] = args;
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  if (type === "companies") {
    await importCompanies(filePath);
  } else if (type === "signals") {
    await importSignals(filePath);
  } else {
    console.error(`Unknown type: ${type}. Use 'companies' or 'signals'`);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
