import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface CompanyData {
  name: string;
  region: string;
  country: string;
  productTypes: string[];
  broilerMmt?: string;
  eggsBillion?: string;
  turkeyMmt?: string;
}

export function parseCompanyList(filePath: string): CompanyData[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());
  
  const companies: CompanyData[] = [];
  
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    
    const name = parts[0]?.trim();
    const region = parts[1]?.trim();
    const country = parts[2]?.trim();
    
    if (!name || !region || !country) continue;
    
    const productTypesStr = parts[7]?.trim() || "";
    const productTypes = productTypesStr.split(",").map(p => p.trim()).filter(Boolean);
    
    companies.push({
      name,
      region,
      country,
      productTypes,
      broilerMmt: parts[4]?.trim() || undefined,
      eggsBillion: parts[5]?.trim() || undefined,
      turkeyMmt: parts[6]?.trim() || undefined,
    });
  }
  
  return companies;
}

export async function importCompanies(onlyUS: boolean = false): Promise<{ imported: number; skipped: number; usCompanies: string[] }> {
  const filePath = path.join(process.cwd(), "attached_assets", "Pasted-2-Sisters-Food-Group-Europe-United-Kingdom-10-500-Chick_1766774305255.txt");
  
  const companyList = parseCompanyList(filePath);
  
  let imported = 0;
  let skipped = 0;
  const usCompanies: string[] = [];
  
  for (const company of companyList) {
    const existing = await db.select().from(companies).where(eq(companies.name, company.name)).limit(1);
    
    if (existing.length > 0) {
      await db.update(companies)
        .set({
          region: company.region,
          country: company.country,
          productTypes: company.productTypes.length > 0 ? company.productTypes : null,
          industry: "Poultry",
        })
        .where(eq(companies.name, company.name));
      skipped++;
      
      if (company.country === "United States") {
        usCompanies.push(company.name);
      }
      continue;
    }
    
    const isUS = company.country === "United States";
    
    if (isUS) {
      usCompanies.push(company.name);
    }
    
    await db.insert(companies).values({
      name: company.name,
      region: company.region,
      country: company.country,
      industry: "Poultry",
      productTypes: company.productTypes.length > 0 ? company.productTypes : null,
      tags: ["poultry", ...company.productTypes.map(p => p.toLowerCase().replace(/\s+/g, "-"))],
      isActive: isUS,
    });
    
    imported++;
  }
  
  return { imported, skipped, usCompanies };
}

export async function getCompaniesByRegion(region?: string, country?: string) {
  let query = db.select().from(companies);
  
  if (country) {
    return await db.select().from(companies).where(eq(companies.country, country));
  }
  
  if (region) {
    return await db.select().from(companies).where(eq(companies.region, region));
  }
  
  return await query;
}

export async function getUSPoultryCompanies() {
  return await db.select().from(companies)
    .where(eq(companies.country, "United States"));
}
