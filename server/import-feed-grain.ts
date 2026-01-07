import { db } from "./db";
import { companies } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

interface ParsedCompany {
  name: string;
  categories: Set<string>;
}

function parseInDesignTaggedText(content: string): Map<string, ParsedCompany> {
  const companyMap = new Map<string, ParsedCompany>();
  const lines = content.split("\n");
  
  let currentMajorCategory = "";
  let currentSubCategory = "";
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Major category header (e.g., "Aeration, Drying & Storage")
    if (trimmedLine.startsWith("<ParaStyle:MajorHead-")) {
      const match = trimmedLine.match(/<ParaStyle:MajorHead-\d+>(.+)/);
      if (match) {
        currentMajorCategory = cleanText(match[1]);
        currentSubCategory = currentMajorCategory; // Default to major category
      }
      continue;
    }
    
    // Sub-category header (e.g., "Aeration Fans, Pipe Systems")
    if (trimmedLine.startsWith("<ParaStyle:CatHead-")) {
      const match = trimmedLine.match(/<ParaStyle:CatHead-\d+>(.+)/);
      if (match) {
        currentSubCategory = cleanText(match[1]);
      }
      continue;
    }
    
    // Company line
    if (trimmedLine.startsWith("<ParaStyle:Company>")) {
      const match = trimmedLine.match(/<ParaStyle:Company>(.+)/);
      if (match) {
        const companyName = cleanText(match[1]);
        const category = currentSubCategory || currentMajorCategory;
        
        if (companyName && category) {
          if (companyMap.has(companyName)) {
            companyMap.get(companyName)!.categories.add(category);
          } else {
            companyMap.set(companyName, {
              name: companyName,
              categories: new Set([category])
            });
          }
        }
      }
    }
  }
  
  return companyMap;
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

async function importFeedGrainCompanies() {
  const filePath = path.resolve(process.cwd(), "attached_assets/all_1767801082758.txt");
  
  if (!fs.existsSync(filePath)) {
    console.error("Feed & Grain data file not found:", filePath);
    process.exit(1);
  }
  
  console.log("Reading Feed & Grain data file...");
  const content = fs.readFileSync(filePath, "utf-8");
  
  console.log("Parsing InDesign tagged text...");
  const companyMap = parseInDesignTaggedText(content);
  
  console.log(`Found ${companyMap.size} unique companies`);
  
  // Convert to insert format
  const companiesToInsert = Array.from(companyMap.values()).map(company => ({
    name: company.name,
    industry: "Feed & Grain",
    description: null,
    location: null,
    website: null,
    linkedIn: null,
    tags: Array.from(company.categories),
    productTypes: [] as string[],
  }));
  
  // Show sample
  console.log("\nSample companies to insert:");
  companiesToInsert.slice(0, 10).forEach(c => {
    console.log(`  - ${c.name}: ${c.tags.slice(0, 3).join(", ")}${c.tags.length > 3 ? "..." : ""}`);
  });
  
  console.log(`\nInserting ${companiesToInsert.length} companies...`);
  
  // Insert in batches of 50
  const batchSize = 50;
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < companiesToInsert.length; i += batchSize) {
    const batch = companiesToInsert.slice(i, i + batchSize);
    
    for (const company of batch) {
      try {
        await db.insert(companies).values(company).onConflictDoNothing();
        insertedCount++;
      } catch (error: any) {
        if (error.code === "23505") {
          skippedCount++;
        } else {
          console.error(`Error inserting ${company.name}:`, error.message);
        }
      }
    }
    
    console.log(`Progress: ${Math.min(i + batchSize, companiesToInsert.length)}/${companiesToInsert.length}`);
  }
  
  console.log(`\nImport complete!`);
  console.log(`  Inserted: ${insertedCount}`);
  console.log(`  Skipped (duplicates): ${skippedCount}`);
}

importFeedGrainCompanies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
