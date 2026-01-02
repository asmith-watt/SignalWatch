import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InsertCompany } from "@shared/schema";

interface BakingMillingCompany {
  id: string;
  name: string;
  industry: string;
  region: string;
  country: string;
  website: string;
  location: string;
  description: string;
  linkedinUrl: string;
  twitterHandle: string;
  productTypes: string[];
  tags: string[];
  isActive: boolean;
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

export function parseBakingMillingCSV(filePath: string): BakingMillingCompany[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const companies: BakingMillingCompany[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 12) continue;
    
    const [id, name, industry, region, country, website, location, description, linkedinUrl, twitterHandle, productTypesStr, tagsStr, isActiveStr] = fields;
    
    if (!name) continue;
    
    const tags = tagsStr
      ? tagsStr.split(";").map(t => t.trim()).filter(Boolean)
      : [];
    
    const productTypes = productTypesStr
      ? productTypesStr.split(";").map(p => p.trim()).filter(Boolean)
      : [];
    
    companies.push({
      id: id || "",
      name: name.replace(/^"|"$/g, ""),
      industry: industry || "Baking & Milling",
      region: region || "",
      country: country || "",
      website: website || "",
      location: location || "",
      description: description || "",
      linkedinUrl: linkedinUrl || "",
      twitterHandle: twitterHandle || "",
      productTypes,
      tags,
      isActive: isActiveStr?.toLowerCase() === "true",
    });
  }
  
  return companies;
}

export async function importBakingMillingCompanies(): Promise<{ imported: number; skipped: number; updated: number }> {
  const filePath = path.join(process.cwd(), "attached_assets", "companies_export_2026-01-02_1767389622702.csv");
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  
  const companyList = parseBakingMillingCSV(filePath);
  console.log(`Parsed ${companyList.length} Baking & Milling companies from CSV`);
  
  let imported = 0;
  let skipped = 0;
  let updated = 0;
  
  for (const company of companyList) {
    const existing = await db.select().from(companies).where(eq(companies.name, company.name)).limit(1);
    
    if (existing.length > 0) {
      if (existing[0].industry !== "Baking & Milling") {
        skipped++;
        continue;
      }
      
      await db.update(companies)
        .set({
          industry: company.industry,
          region: company.region || null,
          country: company.country || null,
          website: company.website || null,
          location: company.location || null,
          description: company.description || null,
          linkedinUrl: company.linkedinUrl || null,
          twitterHandle: company.twitterHandle || null,
          productTypes: company.productTypes.length > 0 ? company.productTypes : null,
          tags: company.tags.length > 0 ? company.tags : null,
          isActive: company.isActive,
        })
        .where(eq(companies.name, company.name));
      updated++;
      continue;
    }
    
    await db.insert(companies).values({
      name: company.name,
      industry: company.industry,
      region: company.region || null,
      country: company.country || null,
      website: company.website || null,
      location: company.location || null,
      description: company.description || null,
      linkedinUrl: company.linkedinUrl || null,
      twitterHandle: company.twitterHandle || null,
      productTypes: company.productTypes.length > 0 ? company.productTypes : null,
      tags: company.tags.length > 0 ? company.tags : ["baking-milling"],
      isActive: company.isActive,
    });
    
    imported++;
  }
  
  console.log(`Baking & Milling import complete: ${imported} imported, ${updated} updated, ${skipped} skipped (different industry)`);
  return { imported, skipped, updated };
}
