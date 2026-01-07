import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface ParsedCompany {
  name: string;
  phone: string | null;
  website: string | null;
}

function cleanText(text: string): string {
  return text
    .replace(/<0x00FC>/g, "ü")  // Bühler
    .replace(/<0x00AE>/g, "®")  // Registered trademark
    .replace(/<0x00E9>/g, "é")  // é accent
    .replace(/<0x2019>/g, "'") // Smart quote
    .replace(/<0x2013>/g, "–") // En dash
    .replace(/<0x2014>/g, "—") // Em dash
    .replace(/\u2022/g, "•")   // Bullet
    .replace(/&amp;/g, "&")    // Ampersand
    .trim();
}

function parseCoNameFormat(content: string): ParsedCompany[] {
  const companies: ParsedCompany[] = [];
  const lines = content.split("\n");
  
  let currentCompany: ParsedCompany | null = null;
  let bodyLineCount = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Company name line
    if (trimmedLine.startsWith("<ParaStyle:CoName>")) {
      // Save previous company if exists
      if (currentCompany) {
        companies.push(currentCompany);
      }
      
      const match = trimmedLine.match(/<ParaStyle:CoName>(.+)/);
      if (match) {
        currentCompany = {
          name: cleanText(match[1]),
          phone: null,
          website: null
        };
        bodyLineCount = 0;
      }
      continue;
    }
    
    // Body line (phone or website)
    if (trimmedLine.startsWith("<ParaStyle:Body>") && currentCompany) {
      const match = trimmedLine.match(/<ParaStyle:Body>(.+)/);
      if (match) {
        const value = cleanText(match[1]);
        bodyLineCount++;
        
        // First body line is usually phone
        if (bodyLineCount === 1 && !value.includes(".")) {
          currentCompany.phone = value;
        } 
        // Second body line or lines with dots are usually website
        else if (value.includes(".") || value.includes("/")) {
          // Clean up website - remove trailing slashes and add https if missing
          let website = value;
          if (!website.startsWith("http")) {
            website = "https://" + website;
          }
          currentCompany.website = website.replace(/\/$/, "");
        }
      }
    }
  }
  
  // Don't forget the last company
  if (currentCompany) {
    companies.push(currentCompany);
  }
  
  return companies;
}

async function importNewFeedGrainCompanies() {
  const filePath = path.resolve(process.cwd(), "attached_assets/Pasted--ASCII-MAC-ParaStyle-CoName-4B-Components-Ltd-ParaStyle_1767804902893.txt");
  
  if (!fs.existsSync(filePath)) {
    console.error("Feed & Grain data file not found:", filePath);
    process.exit(1);
  }
  
  console.log("Reading Feed & Grain data file...");
  const content = fs.readFileSync(filePath, "utf-8");
  
  console.log("Parsing CoName format...");
  const parsedCompanies = parseCoNameFormat(content);
  
  console.log(`Found ${parsedCompanies.length} companies in file`);
  
  // Get existing Feed & Grain company names
  console.log("Fetching existing Feed & Grain companies...");
  const existingCompanies = await db.select({ name: companies.name })
    .from(companies)
    .where(eq(companies.industry, "Feed & Grain"));
  
  const existingNames = new Set(existingCompanies.map(c => c.name.toLowerCase()));
  console.log(`Found ${existingNames.size} existing Feed & Grain companies`);
  
  // Filter to only new companies
  const newCompanies = parsedCompanies.filter(c => !existingNames.has(c.name.toLowerCase()));
  
  console.log(`Found ${newCompanies.length} NEW companies to add`);
  
  if (newCompanies.length === 0) {
    console.log("No new companies to add!");
    return;
  }
  
  // Show new companies
  console.log("\nNew companies to add:");
  newCompanies.forEach(c => {
    console.log(`  - ${c.name} ${c.website ? `(${c.website})` : ""}`);
  });
  
  // Insert new companies
  console.log(`\nInserting ${newCompanies.length} new companies...`);
  
  let insertedCount = 0;
  let errorCount = 0;
  
  for (const company of newCompanies) {
    try {
      await db.insert(companies).values({
        name: company.name,
        industry: "Feed & Grain",
        website: company.website,
        description: null,
        location: null,
        tags: [],
        productTypes: [],
      }).onConflictDoNothing();
      insertedCount++;
      console.log(`  Added: ${company.name}`);
    } catch (error: any) {
      errorCount++;
      console.error(`  Error adding ${company.name}:`, error.message);
    }
  }
  
  console.log(`\nImport complete!`);
  console.log(`  Inserted: ${insertedCount}`);
  console.log(`  Errors: ${errorCount}`);
}

importNewFeedGrainCompanies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
