import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { companies, signals } from "@shared/schema";
import { eq } from "drizzle-orm";

interface SignalRow {
  company_name: string;
  company_industry: string;
  type: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  content_status: string;
  priority: string;
  sentiment: string;
  created_at: string;
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
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

export async function importSignalsByCompanyName(filePath: string): Promise<{ 
  imported: number; 
  skipped: number; 
  companyNotFound: string[];
  errors: string[];
}> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error("CSV must have header and at least one data row");
  }
  
  const headers = parseCSVLine(lines[0]);
  const companyNameIdx = headers.indexOf("company_name");
  const typeIdx = headers.indexOf("type");
  const titleIdx = headers.indexOf("title");
  const summaryIdx = headers.indexOf("summary");
  const sourceUrlIdx = headers.indexOf("source_url");
  const sourceNameIdx = headers.indexOf("source_name");
  const contentStatusIdx = headers.indexOf("content_status");
  const priorityIdx = headers.indexOf("priority");
  const sentimentIdx = headers.indexOf("sentiment");
  const createdAtIdx = headers.indexOf("created_at");
  
  if (companyNameIdx === -1 || titleIdx === -1) {
    throw new Error("CSV must have company_name and title columns");
  }
  
  let imported = 0;
  let skipped = 0;
  const companyNotFound: string[] = [];
  const errors: string[] = [];
  
  const companyCache = new Map<string, number>();
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    const companyName = values[companyNameIdx]?.replace(/^"|"$/g, "");
    const title = values[titleIdx]?.replace(/^"|"$/g, "");
    
    if (!companyName || !title) {
      skipped++;
      continue;
    }
    
    let companyId = companyCache.get(companyName.toLowerCase());
    
    if (!companyId) {
      const found = await db.select({ id: companies.id })
        .from(companies)
        .where(eq(companies.name, companyName))
        .limit(1);
      
      if (found.length === 0) {
        if (!companyNotFound.includes(companyName)) {
          companyNotFound.push(companyName);
        }
        skipped++;
        continue;
      }
      
      companyId = found[0].id;
      companyCache.set(companyName.toLowerCase(), companyId);
    }
    
    try {
      await db.insert(signals).values({
        companyId,
        type: values[typeIdx] || "news",
        title,
        summary: values[summaryIdx] || null,
        sourceUrl: values[sourceUrlIdx] || null,
        sourceName: values[sourceNameIdx] || null,
        contentStatus: values[contentStatusIdx] || "new",
        priority: values[priorityIdx] || "medium",
        sentiment: values[sentimentIdx] || null,
        publishedAt: values[createdAtIdx] ? new Date(values[createdAtIdx]) : null,
      });
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i}: ${e.message}`);
      skipped++;
    }
  }
  
  console.log(`Signal import complete: ${imported} imported, ${skipped} skipped`);
  if (companyNotFound.length > 0) {
    console.log(`Companies not found: ${companyNotFound.join(", ")}`);
  }
  
  return { imported, skipped, companyNotFound, errors };
}

export async function importBakingMillingSignals(): Promise<{ 
  imported: number; 
  skipped: number; 
  companyNotFound: string[];
}> {
  const filePath = path.join(process.cwd(), "attached_assets", "signals_export_2026-01-02_1767389998995.csv");
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  
  const result = await importSignalsByCompanyName(filePath);
  return {
    imported: result.imported,
    skipped: result.skipped,
    companyNotFound: result.companyNotFound,
  };
}
