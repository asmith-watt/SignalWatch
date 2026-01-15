/**
 * Source seed script - Adds categorized sources for the Feed & Grain industry
 * Categories: regulatory, company, trade_publication, trade_association
 */

import { db, sources, type InsertSource } from "../shared/schema";
import { eq } from "drizzle-orm";

interface SourceSeed {
  name: string;
  sourceType: "rss" | "crawl" | "regulator" | "association" | "feedly" | "llm";
  category: "regulatory" | "company" | "trade_publication" | "trade_association";
  url: string;
  domain: string;
  trustScore?: number;
}

// Additional regulatory sources (need ~12 more to reach 20)
const regulatorySources: SourceSeed[] = [
  // Federal agencies
  {
    name: "FDA - Animal & Veterinary News",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.fda.gov/animal-veterinary/rss",
    domain: "fda.gov",
    trustScore: 95,
  },
  {
    name: "FDA - Food Safety Recalls",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds",
    domain: "fda.gov",
    trustScore: 95,
  },
  {
    name: "USDA APHIS - Animal Health",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.aphis.usda.gov/aphis/newsroom/rss",
    domain: "aphis.usda.gov",
    trustScore: 95,
  },
  {
    name: "USDA Economic Research Service",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.ers.usda.gov/rss/",
    domain: "ers.usda.gov",
    trustScore: 90,
  },
  {
    name: "USDA FSIS - Food Safety Alerts",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.fsis.usda.gov/rss",
    domain: "fsis.usda.gov",
    trustScore: 95,
  },
  {
    name: "USDA AMS - Market News",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.ams.usda.gov/market-news/rss-feeds",
    domain: "ams.usda.gov",
    trustScore: 90,
  },
  {
    name: "EPA - Agricultural Programs",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.epa.gov/newsreleases/rss",
    domain: "epa.gov",
    trustScore: 90,
  },
  {
    name: "Federal Register - Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.federalregister.gov/api/v1/articles.rss?conditions%5Bagencies%5D%5B%5D=agriculture-department",
    domain: "federalregister.gov",
    trustScore: 95,
  },
  // State agencies
  {
    name: "Iowa Dept of Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://iowaagriculture.gov/news",
    domain: "iowaagriculture.gov",
    trustScore: 80,
  },
  {
    name: "Texas Dept of Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.texasagriculture.gov/News-Events/News-Archive",
    domain: "texasagriculture.gov",
    trustScore: 80,
  },
  {
    name: "California Dept of Food & Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.cdfa.ca.gov/news/",
    domain: "cdfa.ca.gov",
    trustScore: 80,
  },
  {
    name: "Kansas Dept of Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://agriculture.ks.gov/news-events",
    domain: "agriculture.ks.gov",
    trustScore: 80,
  },
  {
    name: "Nebraska Dept of Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://nda.nebraska.gov/news/",
    domain: "nda.nebraska.gov",
    trustScore: 80,
  },
  {
    name: "Minnesota Dept of Agriculture",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.mda.state.mn.us/news",
    domain: "mda.state.mn.us",
    trustScore: 80,
  },
  // International regulatory
  {
    name: "European Food Safety Authority (EFSA)",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://www.efsa.europa.eu/en/rss",
    domain: "efsa.europa.eu",
    trustScore: 90,
  },
  {
    name: "Canadian Food Inspection Agency",
    sourceType: "regulator",
    category: "regulatory",
    url: "https://inspection.canada.ca/about-cfia/newsroom/news-releases/eng/1299073792503/1299076004307",
    domain: "inspection.canada.ca",
    trustScore: 90,
  },
];

// Trade associations
const tradeAssociationSources: SourceSeed[] = [
  {
    name: "American Feed Industry Association (AFIA)",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.afia.org/news/",
    domain: "afia.org",
    trustScore: 85,
  },
  {
    name: "National Grain and Feed Association (NGFA)",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.ngfa.org/news/",
    domain: "ngfa.org",
    trustScore: 85,
  },
  {
    name: "Pet Food Institute",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.petfoodinstitute.org/news/",
    domain: "petfoodinstitute.org",
    trustScore: 85,
  },
  {
    name: "National Chicken Council",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.nationalchickencouncil.org/news/",
    domain: "nationalchickencouncil.org",
    trustScore: 85,
  },
  {
    name: "U.S. Poultry & Egg Association",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.uspoultry.org/news/",
    domain: "uspoultry.org",
    trustScore: 85,
  },
  {
    name: "North American Millers Association",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.namamillers.org/news/",
    domain: "namamillers.org",
    trustScore: 85,
  },
  {
    name: "American Bakers Association",
    sourceType: "association",
    category: "trade_association",
    url: "https://www.americanbakers.org/news",
    domain: "americanbakers.org",
    trustScore: 85,
  },
  {
    name: "International Feed Industry Federation (IFIF)",
    sourceType: "association",
    category: "trade_association",
    url: "https://ifif.org/news/",
    domain: "ifif.org",
    trustScore: 85,
  },
];

// Trade publications
const tradePublicationSources: SourceSeed[] = [
  {
    name: "Feed & Grain Magazine",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.feedandgrain.com/rss",
    domain: "feedandgrain.com",
    trustScore: 85,
  },
  {
    name: "Feedstuffs",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.feedstuffs.com/rss",
    domain: "feedstuffs.com",
    trustScore: 85,
  },
  {
    name: "World Grain",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.world-grain.com/rss",
    domain: "world-grain.com",
    trustScore: 85,
  },
  {
    name: "Pet Food Processing",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.petfoodprocessing.net/rss",
    domain: "petfoodprocessing.net",
    trustScore: 85,
  },
  {
    name: "Pet Food Industry",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.petfoodindustry.com/rss",
    domain: "petfoodindustry.com",
    trustScore: 85,
  },
  {
    name: "WATT Poultry",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.wattagnet.com/rss/content_feeds/poultry-feed",
    domain: "wattagnet.com",
    trustScore: 85,
  },
  {
    name: "Poultry World",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.poultryworld.net/rss",
    domain: "poultryworld.net",
    trustScore: 85,
  },
  {
    name: "Meat+Poultry",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.meatpoultry.com/rss",
    domain: "meatpoultry.com",
    trustScore: 85,
  },
  {
    name: "Baking Business",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.bakingbusiness.com/rss",
    domain: "bakingbusiness.com",
    trustScore: 85,
  },
  {
    name: "AgriPulse",
    sourceType: "rss",
    category: "trade_publication",
    url: "https://www.agri-pulse.com/rss",
    domain: "agri-pulse.com",
    trustScore: 80,
  },
];

// Company newsrooms (major industry players)
const companySources: SourceSeed[] = [
  // Feed companies
  {
    name: "Cargill Newsroom",
    sourceType: "crawl",
    category: "company",
    url: "https://www.cargill.com/news",
    domain: "cargill.com",
    trustScore: 80,
  },
  {
    name: "ADM News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.adm.com/news",
    domain: "adm.com",
    trustScore: 80,
  },
  {
    name: "Nutreco News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.nutreco.com/news",
    domain: "nutreco.com",
    trustScore: 80,
  },
  {
    name: "Alltech News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.alltech.com/news",
    domain: "alltech.com",
    trustScore: 80,
  },
  {
    name: "DSM Animal Nutrition News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.dsm.com/anh/news.html",
    domain: "dsm.com",
    trustScore: 80,
  },
  {
    name: "Evonik Animal Nutrition",
    sourceType: "crawl",
    category: "company",
    url: "https://animal-nutrition.evonik.com/en/news-events",
    domain: "evonik.com",
    trustScore: 80,
  },
  // Poultry companies
  {
    name: "Tyson Foods Newsroom",
    sourceType: "crawl",
    category: "company",
    url: "https://www.tysonfoods.com/news",
    domain: "tysonfoods.com",
    trustScore: 80,
  },
  {
    name: "Pilgrim's Pride News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.pilgrims.com/news",
    domain: "pilgrims.com",
    trustScore: 80,
  },
  {
    name: "Perdue Farms News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.perdue.com/news",
    domain: "perdue.com",
    trustScore: 80,
  },
  {
    name: "Sanderson Farms News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.sandersonfarms.com/news",
    domain: "sandersonfarms.com",
    trustScore: 80,
  },
  // Pet food companies
  {
    name: "Mars Petcare News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.mars.com/news-and-stories/press-releases",
    domain: "mars.com",
    trustScore: 80,
  },
  {
    name: "Nestle Purina News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.purina.com/about-purina/press-room",
    domain: "purina.com",
    trustScore: 80,
  },
  {
    name: "Hill's Pet Nutrition News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.hillspet.com/about-hills/newsroom",
    domain: "hillspet.com",
    trustScore: 80,
  },
  {
    name: "Blue Buffalo News",
    sourceType: "crawl",
    category: "company",
    url: "https://bluebuffalo.com/about/press-releases",
    domain: "bluebuffalo.com",
    trustScore: 80,
  },
  // Animal health companies
  {
    name: "Zoetis News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.zoetis.com/news",
    domain: "zoetis.com",
    trustScore: 80,
  },
  {
    name: "Elanco News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.elanco.com/news",
    domain: "elanco.com",
    trustScore: 80,
  },
  {
    name: "Boehringer Ingelheim Animal Health",
    sourceType: "crawl",
    category: "company",
    url: "https://www.boehringer-ingelheim.com/animal-health/news",
    domain: "boehringer-ingelheim.com",
    trustScore: 80,
  },
  // Milling/baking companies
  {
    name: "Ardent Mills News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.ardentmills.com/news",
    domain: "ardentmills.com",
    trustScore: 80,
  },
  {
    name: "Bunge News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.bunge.com/news",
    domain: "bunge.com",
    trustScore: 80,
  },
  {
    name: "Grupo Bimbo News",
    sourceType: "crawl",
    category: "company",
    url: "https://www.grupobimbo.com/en/press",
    domain: "grupobimbo.com",
    trustScore: 80,
  },
];

const allSources = [
  ...regulatorySources,
  ...tradeAssociationSources,
  ...tradePublicationSources,
  ...companySources,
];

export async function seedSources() {
  console.log("Starting source seeding...");
  console.log(`Total sources to check: ${allSources.length}`);

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const sourceSeed of allSources) {
    // Check if source already exists (by URL or name)
    const existing = await db.select().from(sources)
      .where(eq(sources.url, sourceSeed.url))
      .limit(1);

    if (existing.length > 0) {
      // Update category if not set
      if (!existing[0].category) {
        await db.update(sources)
          .set({ category: sourceSeed.category })
          .where(eq(sources.id, existing[0].id));
        updated++;
        console.log(`Updated category for: ${sourceSeed.name}`);
      } else {
        skipped++;
      }
    } else {
      // Check by name as well
      const existingByName = await db.select().from(sources)
        .where(eq(sources.name, sourceSeed.name))
        .limit(1);

      if (existingByName.length > 0) {
        if (!existingByName[0].category) {
          await db.update(sources)
            .set({ category: sourceSeed.category })
            .where(eq(sources.id, existingByName[0].id));
          updated++;
          console.log(`Updated category for: ${sourceSeed.name}`);
        } else {
          skipped++;
        }
      } else {
        // Add new source
        await db.insert(sources).values({
          name: sourceSeed.name,
          sourceType: sourceSeed.sourceType,
          category: sourceSeed.category,
          url: sourceSeed.url,
          domain: sourceSeed.domain,
          trustScore: sourceSeed.trustScore || 70,
          verificationStatus: "needs_review",
          isActive: true,
        });
        added++;
        console.log(`Added: ${sourceSeed.name} (${sourceSeed.category})`);
      }
    }
  }

  console.log("\nSource seeding complete!");
  console.log(`  Added: ${added}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already exist): ${skipped}`);

  // Show final distribution
  const allDbSources = await db.select().from(sources);
  const byCat = {
    regulatory: 0,
    company: 0,
    trade_publication: 0,
    trade_association: 0,
    uncategorized: 0,
  };

  for (const s of allDbSources) {
    if (s.category && s.category in byCat) {
      byCat[s.category as keyof typeof byCat]++;
    } else {
      byCat.uncategorized++;
    }
  }

  console.log("\nFinal source distribution:");
  console.log(`  Regulatory: ${byCat.regulatory}`);
  console.log(`  Company: ${byCat.company}`);
  console.log(`  Trade Publication: ${byCat.trade_publication}`);
  console.log(`  Trade Association: ${byCat.trade_association}`);
  console.log(`  Uncategorized: ${byCat.uncategorized}`);
  console.log(`  Total: ${allDbSources.length}`);
}

// Update existing sources with categories based on name patterns
export async function updateExistingSourceCategories() {
  console.log("Updating existing source categories...");

  const allDbSources = await db.select().from(sources);
  let updated = 0;

  for (const source of allDbSources) {
    if (source.category) continue; // Already has category

    let category: string | null = null;
    const name = source.name.toLowerCase();
    const type = source.sourceType;

    // Determine category based on name patterns and source type
    if (type === "regulator" ||
        name.includes("fda") ||
        name.includes("usda") ||
        name.includes("aphis") ||
        name.includes("epa") ||
        name.includes("fsis") ||
        name.includes("department") ||
        name.includes("federal register")) {
      category = "regulatory";
    } else if (type === "association" ||
               name.includes("association") ||
               name.includes("council") ||
               name.includes("institute") ||
               name.includes("federation")) {
      category = "trade_association";
    } else if (name.includes("magazine") ||
               name.includes("feedstuffs") ||
               name.includes("world grain") ||
               name.includes("agri-pulse") ||
               name.includes("meatingplace") ||
               name.includes("meat+poultry") ||
               name.includes("poultry world") ||
               name.includes("dairy herd") ||
               name.includes("beef") ||
               name.includes("pork business") ||
               name.includes("reuters") ||
               name.includes("agweb") ||
               name.includes("baking business") ||
               name.includes("pet food processing") ||
               name.includes("pet food industry") ||
               name.includes("watt")) {
      category = "trade_publication";
    } else if (name.includes("newsroom") ||
               name.includes("news") ||
               type === "crawl" ||
               source.domain) {
      category = "company";
    }

    if (category) {
      await db.update(sources)
        .set({ category })
        .where(eq(sources.id, source.id));
      updated++;
      console.log(`Set ${source.name} → ${category}`);
    }
  }

  console.log(`Updated ${updated} source categories`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSources()
    .then(() => updateExistingSourceCategories())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error seeding sources:", err);
      process.exit(1);
    });
}
