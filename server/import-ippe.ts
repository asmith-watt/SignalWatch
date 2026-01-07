import fs from "fs";
import path from "path";
import { db } from "./db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ExhibitorRow {
  adv: string;
  company: string;
  booth: string;
  parent: string;
  child: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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

export async function importIPPEExhibitors(): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const csvPath = path.join(
    process.cwd(),
    "attached_assets/Exhibiting_Companies_1767796552809.csv"
  );

  // Read and convert from ISO-8859-1 to UTF-8
  const rawBuffer = fs.readFileSync(csvPath);
  const content = rawBuffer.toString("latin1");
  const lines = content.split("\n").filter((line) => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  // Aggregate companies with their categories
  const companyMap = new Map<
    string,
    {
      name: string;
      booth: string;
      isAdvertiser: boolean;
      parentCategories: Set<string>;
      childCategories: Set<string>;
    }
  >();

  const validParentCategories = new Set([
    "Ammonia",
    "Bird & Animal Health",
    "Bird Production & Housing",
    "Buildings & Supplies",
    "Cleaning & Sanitation",
    "Climate Control",
    "Clothing & Accessories",
    "Egg Handling/Equipment",
    "Egg Processing",
    "Energy - Renewable & Alternative",
    "Environmental & Water Treatment",
    "Feed Additives & Ingredients",
    "Feed Equipment & Supplies",
    "Feed Types",
    "Food Ingredients",
    "Food Safety & Pathogen Control",
    "Genetics & Breeding",
    "Hatchery & Incubation",
    "Meat & Poultry 1st & 2nd Processing",
    "Meat & Poultry Further Processing",
    "Meat & Poultry Packaging",
    "Pet Food",
    "Poultry",
    "Rendering",
    "Robotics & Automation",
    "Services",
    "Software & Technology",
    "Transportation & Logistics",
    "Waste Management",
  ]);

  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    if (fields.length < 5) continue;

    const [adv, companyName, booth, parent, child] = fields;

    if (!companyName || companyName.trim() === "") continue;

    const normalizedName = companyName.trim();
    const normalizedParent = parent?.trim() || "";
    const normalizedChild = child?.trim() || "";

    // Skip rows where parent looks like a booth number (data quality issue)
    if (normalizedParent.match(/^[A-Z]+\d+/)) continue;

    if (!companyMap.has(normalizedName)) {
      companyMap.set(normalizedName, {
        name: normalizedName,
        booth: booth?.trim() || "",
        isAdvertiser: adv?.trim().toUpperCase() === "X",
        parentCategories: new Set(),
        childCategories: new Set(),
      });
    }

    const company = companyMap.get(normalizedName)!;

    if (normalizedParent && validParentCategories.has(normalizedParent)) {
      company.parentCategories.add(normalizedParent);
    }

    if (normalizedChild) {
      company.childCategories.add(normalizedChild);
    }
  }

  console.log(`Found ${companyMap.size} unique IPPE exhibitor companies`);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [name, data] of companyMap) {
    try {
      // Check if company already exists
      const existing = await db
        .select()
        .from(companies)
        .where(eq(companies.name, name))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Create tags from parent categories
      const tags = Array.from(data.parentCategories);
      if (data.isAdvertiser) {
        tags.push("IPPE Advertiser");
      }

      // Create productTypes from child categories
      const productTypes = Array.from(data.childCategories);

      await db.insert(companies).values({
        name: data.name,
        industry: "IPPE Exhibitors",
        location: data.booth ? `Booth ${data.booth}` : null,
        tags: tags.length > 0 ? tags : null,
        productTypes: productTypes.length > 0 ? productTypes : null,
        isActive: true,
        country: "United States",
        region: "North America",
      });

      imported++;

      if (imported % 100 === 0) {
        console.log(`Imported ${imported} companies...`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to import ${name}: ${message}`);
    }
  }

  console.log(`Import complete: ${imported} imported, ${skipped} skipped`);
  return { imported, skipped, errors };
}
