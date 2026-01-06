import { storage } from "./storage";
import type { InsertCompany, InsertSignal, InsertAlert } from "@shared/schema";

// Sample companies across all four industries: Poultry, Feed, Pet Food, Baking & Milling
const sampleCompanies: InsertCompany[] = [
  // Poultry Industry
  {
    name: "Tyson Foods",
    website: "https://tysonfoods.com",
    industry: "Poultry",
    description: "One of the world's largest food companies and a leader in protein production",
    location: "Springdale, AR",
    region: "North America",
    country: "USA",
    size: "10001+",
    founded: "1935",
    linkedinUrl: "https://linkedin.com/company/tyson-foods",
    twitterHandle: "TysonFoods",
    isActive: true,
    tags: ["poultry", "protein", "food-processing"],
    productTypes: ["chicken", "beef", "pork", "prepared-foods"],
  },
  {
    name: "Pilgrim's Pride",
    website: "https://pilgrims.com",
    industry: "Poultry",
    description: "Leading chicken producer in the United States, Mexico, and Europe",
    location: "Greeley, CO",
    region: "North America",
    country: "USA",
    size: "10001+",
    founded: "1946",
    linkedinUrl: "https://linkedin.com/company/pilgrims-pride",
    isActive: true,
    tags: ["poultry", "chicken", "food-processing"],
    productTypes: ["chicken", "prepared-chicken"],
  },
  {
    name: "Perdue Farms",
    website: "https://perdue.com",
    industry: "Poultry",
    description: "Family-owned food and agriculture company focused on premium chicken",
    location: "Salisbury, MD",
    region: "North America",
    country: "USA",
    size: "5001-10000",
    founded: "1920",
    linkedinUrl: "https://linkedin.com/company/perdue-farms",
    isActive: true,
    tags: ["poultry", "organic", "antibiotic-free"],
    productTypes: ["chicken", "turkey", "organic-poultry"],
  },
  // Feed Industry
  {
    name: "Cargill Animal Nutrition",
    website: "https://cargill.com/animal-nutrition",
    industry: "Feed",
    description: "Global leader in animal nutrition and feed solutions",
    location: "Wayzata, MN",
    region: "North America",
    country: "USA",
    size: "10001+",
    founded: "1865",
    linkedinUrl: "https://linkedin.com/company/cargill",
    twitterHandle: "Cargill",
    isActive: true,
    tags: ["feed", "animal-nutrition", "agriculture"],
    productTypes: ["livestock-feed", "poultry-feed", "aqua-feed"],
  },
  {
    name: "Alltech",
    website: "https://alltech.com",
    industry: "Feed",
    description: "Global animal health and nutrition company focused on natural solutions",
    location: "Nicholasville, KY",
    region: "North America",
    country: "USA",
    size: "5001-10000",
    founded: "1980",
    linkedinUrl: "https://linkedin.com/company/alltech",
    twitterHandle: "Alltech",
    isActive: true,
    tags: ["feed", "nutrition", "sustainability"],
    productTypes: ["feed-additives", "probiotics", "enzymes"],
  },
  {
    name: "Nutreco",
    website: "https://nutreco.com",
    industry: "Feed",
    description: "Global leader in animal nutrition and aquafeed",
    location: "Amersfoort, Netherlands",
    region: "Europe",
    country: "Netherlands",
    size: "10001+",
    founded: "1994",
    linkedinUrl: "https://linkedin.com/company/nutreco",
    isActive: true,
    tags: ["feed", "aquaculture", "sustainability"],
    productTypes: ["aqua-feed", "livestock-feed", "premixes"],
  },
  // Pet Food Industry
  {
    name: "Mars Petcare",
    website: "https://mars.com/made-by-mars/petcare",
    industry: "Pet Food",
    description: "World's largest pet care company with iconic brands",
    location: "Franklin, TN",
    region: "North America",
    country: "USA",
    size: "10001+",
    founded: "1935",
    linkedinUrl: "https://linkedin.com/company/mars-petcare",
    isActive: true,
    tags: ["pet-food", "pet-care", "consumer-goods"],
    productTypes: ["dog-food", "cat-food", "pet-treats"],
  },
  {
    name: "Nestle Purina PetCare",
    website: "https://purina.com",
    industry: "Pet Food",
    description: "Leading manufacturer of pet food and treats",
    location: "St. Louis, MO",
    region: "North America",
    country: "USA",
    size: "10001+",
    founded: "1894",
    linkedinUrl: "https://linkedin.com/company/purina",
    twitterHandle: "Purina",
    isActive: true,
    tags: ["pet-food", "nutrition", "science-based"],
    productTypes: ["dog-food", "cat-food", "specialty-diets"],
  },
  {
    name: "Blue Buffalo",
    website: "https://bluebuffalo.com",
    industry: "Pet Food",
    description: "Premium natural pet food company focused on wholesome ingredients",
    location: "Wilton, CT",
    region: "North America",
    country: "USA",
    size: "1001-5000",
    founded: "2002",
    linkedinUrl: "https://linkedin.com/company/blue-buffalo",
    isActive: true,
    tags: ["pet-food", "natural", "premium"],
    productTypes: ["dog-food", "cat-food", "grain-free"],
  },
  // Baking & Milling Industry
  {
    name: "Ardent Mills",
    website: "https://ardentmills.com",
    industry: "Baking & Milling",
    description: "Premier flour-milling and ingredient company in North America",
    location: "Denver, CO",
    region: "North America",
    country: "USA",
    size: "5001-10000",
    founded: "2014",
    linkedinUrl: "https://linkedin.com/company/ardent-mills",
    isActive: true,
    tags: ["flour", "milling", "ingredients"],
    productTypes: ["flour", "specialty-grains", "pulses"],
  },
  {
    name: "ADM Milling",
    website: "https://adm.com",
    industry: "Baking & Milling",
    description: "Global leader in agricultural processing and food ingredients",
    location: "Chicago, IL",
    region: "North America",
    country: "USA",
    size: "10001+",
    founded: "1902",
    linkedinUrl: "https://linkedin.com/company/adm",
    twitterHandle: "ADMupdates",
    isActive: true,
    tags: ["milling", "ingredients", "agriculture"],
    productTypes: ["flour", "starches", "sweeteners"],
  },
  {
    name: "Grupo Bimbo",
    website: "https://grupobimbo.com",
    industry: "Baking & Milling",
    description: "World's largest baking company with operations in 34 countries",
    location: "Mexico City, Mexico",
    region: "Latin America",
    country: "Mexico",
    size: "10001+",
    founded: "1945",
    linkedinUrl: "https://linkedin.com/company/grupo-bimbo",
    isActive: true,
    tags: ["baking", "bread", "snacks"],
    productTypes: ["bread", "buns", "pastries", "tortillas"],
  },
];

// Industry-specific signal templates with full AI analysis
const signalTemplates = [
  // Poultry signals
  {
    type: "funding",
    industry: "Poultry",
    title: "{company} secures $150M for poultry processing expansion",
    content: "{company} has announced a $150 million investment to expand its poultry processing capabilities across the Midwest. The funding will support three new processing facilities and automation upgrades at existing plants.",
    priority: "high" as const,
    sentiment: "positive" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }],
      locations: ["Midwest", "United States"],
      financials: { funding: "$150M" },
    },
    aiAnalysis: {
      keyTakeaways: [
        "{company} is investing heavily in processing capacity expansion",
        "Three new facilities will be constructed in the Midwest region",
        "Automation upgrades signal focus on operational efficiency",
      ],
      industryImpact: "This expansion will increase overall U.S. poultry processing capacity by an estimated 5%, potentially affecting commodity prices and supply chain dynamics across the sector.",
      storyAngles: [
        "How automation is reshaping poultry processing jobs",
        "Regional economic impact of new processing facilities",
        "Supply chain implications for downstream customers",
      ],
      suggestedFollowUp: [
        "Contact {company} for timeline and job creation estimates",
        "Interview local economic development officials",
        "Analyze competitor responses to capacity expansion",
      ],
      relevanceScore: 85,
      priorityScore: 80,
      recommendedFormat: "analysis",
    },
  },
  {
    type: "regulatory",
    industry: "Poultry",
    title: "USDA announces new poultry inspection requirements affecting {company}",
    content: "The USDA has announced updated inspection protocols for poultry processors, requiring enhanced pathogen testing and traceability systems. {company} and other major producers must comply within 18 months.",
    priority: "high" as const,
    sentiment: "neutral" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }, { name: "USDA", relationship: "regulator" }],
      locations: ["United States"],
    },
    aiAnalysis: {
      keyTakeaways: [
        "New USDA inspection requirements mandate enhanced pathogen testing",
        "18-month compliance timeline for all major processors",
        "Traceability systems will require significant technology investment",
      ],
      industryImpact: "Industry-wide compliance costs estimated at $500M-$800M, with potential consolidation among smaller processors unable to meet new requirements.",
      storyAngles: [
        "Compliance costs and impact on smaller processors",
        "Technology vendors positioning for traceability contracts",
        "Consumer safety implications of enhanced testing",
      ],
      suggestedFollowUp: [
        "Get {company} statement on compliance readiness",
        "Interview food safety experts on regulation effectiveness",
        "Survey smaller processors on business viability concerns",
      ],
      relevanceScore: 90,
      priorityScore: 85,
      recommendedFormat: "news",
    },
  },
  // Feed signals
  {
    type: "product_launch",
    industry: "Feed",
    title: "{company} launches sustainable feed additive reducing methane emissions",
    content: "{company} has introduced a new feed additive that reduces livestock methane emissions by up to 30%. The product uses a proprietary seaweed-based formula and has received regulatory approval in the EU and North America.",
    priority: "medium" as const,
    sentiment: "positive" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }],
      locations: ["European Union", "North America"],
    },
    aiAnalysis: {
      keyTakeaways: [
        "New additive reduces methane emissions by up to 30%",
        "Seaweed-based formula represents sustainable innovation",
        "Dual regulatory approval accelerates market access",
      ],
      industryImpact: "This product positions {company} at the forefront of sustainable feed solutions, addressing growing regulatory and consumer pressure on livestock carbon footprints.",
      storyAngles: [
        "Science behind seaweed-based methane reduction",
        "ESG implications for livestock producers adopting the additive",
        "Competitive response from other feed additive manufacturers",
      ],
      suggestedFollowUp: [
        "Request trial data and producer testimonials",
        "Interview sustainability officers at major livestock operations",
        "Track adoption rates in first 6 months post-launch",
      ],
      relevanceScore: 80,
      priorityScore: 75,
      recommendedFormat: "news",
    },
  },
  {
    type: "acquisition",
    industry: "Feed",
    title: "{company} acquires European premix manufacturer for $280M",
    content: "{company} has completed the acquisition of EuroMix Nutrition, a leading European premix manufacturer, for $280 million. The deal expands {company}'s presence in the EU market and adds proprietary vitamin and mineral formulations.",
    priority: "high" as const,
    sentiment: "positive" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "acquirer" }, { name: "EuroMix Nutrition", relationship: "acquired" }],
      locations: ["Europe"],
      financials: { funding: "$280M" },
    },
    aiAnalysis: {
      keyTakeaways: [
        "{company} expands European footprint through strategic acquisition",
        "$280M deal adds proprietary premix formulations",
        "Consolidation trend continues in global feed industry",
      ],
      industryImpact: "This acquisition strengthens {company}'s position as a top-3 global feed company and may trigger additional M&A activity as competitors seek scale.",
      storyAngles: [
        "Strategic rationale behind EU market expansion",
        "Integration challenges and synergy targets",
        "Impact on European premix market competition",
      ],
      suggestedFollowUp: [
        "Interview {company} leadership on integration timeline",
        "Analyze competitive positioning post-acquisition",
        "Track regulatory approval process for the deal",
      ],
      relevanceScore: 88,
      priorityScore: 82,
      recommendedFormat: "analysis",
    },
  },
  // Pet Food signals
  {
    type: "product_launch",
    industry: "Pet Food",
    title: "{company} introduces AI-powered personalized pet nutrition service",
    content: "{company} has launched a direct-to-consumer service using AI to create personalized nutrition plans for pets. The platform analyzes pet health data, breed characteristics, and activity levels to recommend custom food formulations.",
    priority: "medium" as const,
    sentiment: "positive" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }],
    },
    aiAnalysis: {
      keyTakeaways: [
        "AI-powered personalization enters pet food market",
        "Direct-to-consumer model bypasses traditional retail channels",
        "Health data integration signals convergence with pet tech",
      ],
      industryImpact: "This launch signals the premium pet food market's shift toward personalization and data-driven nutrition, potentially disrupting traditional retail distribution models.",
      storyAngles: [
        "How AI is transforming pet nutrition recommendations",
        "Consumer willingness to pay for personalized pet food",
        "Retail channel disruption from D2C pet food brands",
      ],
      suggestedFollowUp: [
        "Interview pet nutritionists on AI recommendation accuracy",
        "Survey pet owners on personalization preferences",
        "Analyze pricing comparison with traditional premium brands",
      ],
      relevanceScore: 75,
      priorityScore: 70,
      recommendedFormat: "news",
    },
  },
  {
    type: "news",
    industry: "Pet Food",
    title: "FDA investigates grain-free pet food link to heart disease; {company} responds",
    content: "The FDA has expanded its investigation into potential links between grain-free pet foods and dilated cardiomyopathy (DCM) in dogs. {company} has issued a statement defending its formulations and citing independent safety studies.",
    priority: "high" as const,
    sentiment: "negative" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }, { name: "FDA", relationship: "regulator" }],
      locations: ["United States"],
    },
    aiAnalysis: {
      keyTakeaways: [
        "FDA expands DCM investigation into grain-free pet foods",
        "{company} defends product safety with independent studies",
        "Consumer confidence in grain-free segment may be affected",
      ],
      industryImpact: "This investigation could significantly impact the $3B grain-free pet food segment, with potential reformulation requirements and marketing restrictions.",
      storyAngles: [
        "Science behind the grain-free/DCM connection claims",
        "Consumer behavior shifts in response to FDA investigation",
        "Legal exposure for grain-free pet food manufacturers",
      ],
      suggestedFollowUp: [
        "Get {company} detailed response and study citations",
        "Interview veterinary cardiologists on DCM research",
        "Track sales data for grain-free vs. traditional formulas",
      ],
      relevanceScore: 92,
      priorityScore: 88,
      recommendedFormat: "analysis",
    },
  },
  // Baking & Milling signals
  {
    type: "partnership",
    industry: "Baking & Milling",
    title: "{company} partners with regenerative agriculture network for sustainable wheat sourcing",
    content: "{company} has announced a partnership with the Regenerative Agriculture Alliance to source 50% of its wheat from certified regenerative farms by 2028. The initiative includes farmer training programs and premium pricing for participating growers.",
    priority: "medium" as const,
    sentiment: "positive" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }, { name: "Regenerative Agriculture Alliance", relationship: "partner" }],
    },
    aiAnalysis: {
      keyTakeaways: [
        "50% regenerative wheat sourcing target by 2028",
        "Farmer training and premium pricing incentives included",
        "Major commitment to sustainable ingredient supply chain",
      ],
      industryImpact: "This partnership sets a new benchmark for sustainable sourcing in the milling industry and may pressure competitors to make similar commitments.",
      storyAngles: [
        "Economics of regenerative agriculture for wheat farmers",
        "Consumer demand driving sustainable sourcing commitments",
        "Supply chain challenges of scaling regenerative practices",
      ],
      suggestedFollowUp: [
        "Interview participating farmers on program benefits",
        "Analyze cost implications for {company} products",
        "Compare with competitor sustainability initiatives",
      ],
      relevanceScore: 78,
      priorityScore: 72,
      recommendedFormat: "news",
    },
  },
  {
    type: "earnings",
    industry: "Baking & Milling",
    title: "{company} Q3 results: Flour demand surge drives 18% revenue growth",
    content: "{company} reported Q3 revenue of $1.2B, up 18% year-over-year, driven by strong demand for specialty flours and artisan bread mixes. The company raised full-year guidance and announced capacity expansion plans.",
    priority: "high" as const,
    sentiment: "positive" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }],
      financials: { revenue: "$1.2B", growth: "18%" },
    },
    aiAnalysis: {
      keyTakeaways: [
        "Q3 revenue up 18% to $1.2B on specialty flour demand",
        "Artisan bread mix category showing exceptional growth",
        "Full-year guidance raised; capacity expansion planned",
      ],
      industryImpact: "Strong results indicate continued consumer shift toward premium and specialty baking products, benefiting ingredient suppliers focused on artisan and craft segments.",
      storyAngles: [
        "Consumer trends driving specialty flour demand",
        "Capacity constraints in artisan ingredient production",
        "Competitive implications of {company}'s market share gains",
      ],
      suggestedFollowUp: [
        "Analyze earnings call for capacity expansion details",
        "Survey artisan bakeries on ingredient sourcing challenges",
        "Compare {company} performance with peer companies",
      ],
      relevanceScore: 85,
      priorityScore: 80,
      recommendedFormat: "brief",
    },
  },
  // Cross-industry signals
  {
    type: "executive_change",
    industry: null,
    title: "{company} appoints former Cargill executive as new CEO",
    content: "{company} has named Sarah Chen, a 20-year Cargill veteran and former EVP of Global Operations, as its new CEO effective January 1. Chen will lead the company's expansion into emerging markets and digital transformation initiatives.",
    priority: "high" as const,
    sentiment: "neutral" as const,
    entities: {
      people: [{ name: "Sarah Chen", role: "CEO", company: "{company}" }],
      companies: [{ name: "{company}", relationship: "subject" }, { name: "Cargill", relationship: "previous employer" }],
    },
    aiAnalysis: {
      keyTakeaways: [
        "Sarah Chen brings 20 years of Cargill experience to CEO role",
        "Strategic focus on emerging markets and digital transformation",
        "Leadership transition signals potential strategic shift",
      ],
      industryImpact: "Chen's appointment brings significant operational expertise and may accelerate {company}'s international expansion and technology investments.",
      storyAngles: [
        "Chen's vision for {company}'s strategic direction",
        "Digital transformation priorities under new leadership",
        "Emerging market expansion opportunities and challenges",
      ],
      suggestedFollowUp: [
        "Request interview with incoming CEO",
        "Analyze Chen's track record at Cargill",
        "Survey industry analysts on expected strategic changes",
      ],
      relevanceScore: 82,
      priorityScore: 78,
      recommendedFormat: "news",
    },
  },
  {
    type: "news",
    industry: null,
    title: "Supply chain disruptions impact {company} production; shares drop 5%",
    content: "{company} announced temporary production slowdowns at three facilities due to raw material supply chain disruptions. The company expects normalized operations within 6-8 weeks but lowered Q4 guidance by 3-5%.",
    priority: "high" as const,
    sentiment: "negative" as const,
    entities: {
      companies: [{ name: "{company}", relationship: "subject" }],
      financials: { growth: "-5%" },
    },
    aiAnalysis: {
      keyTakeaways: [
        "Production slowdowns at three facilities due to supply issues",
        "Q4 guidance lowered by 3-5%",
        "Recovery expected within 6-8 weeks",
      ],
      industryImpact: "This highlights ongoing supply chain vulnerabilities in the sector and may prompt customers to diversify suppliers or increase inventory buffers.",
      storyAngles: [
        "Root causes of the supply chain disruption",
        "Customer impact and alternative sourcing strategies",
        "Long-term supply chain resilience investments needed",
      ],
      suggestedFollowUp: [
        "Get {company} update on recovery progress",
        "Interview major customers on supply continuity plans",
        "Analyze stock price impact and investor sentiment",
      ],
      relevanceScore: 88,
      priorityScore: 85,
      recommendedFormat: "news",
    },
  },
];

function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return date;
}

export async function seedDatabase() {
  console.log("Checking for existing data...");
  
  const existingCompanies = await storage.getAllCompanies();
  if (existingCompanies.length > 0) {
    console.log("Database already has data, skipping seed.");
    return;
  }

  console.log("Seeding database with sample data...");

  // Create companies
  const createdCompanies: { id: number; name: string }[] = [];
  for (const companyData of sampleCompanies) {
    const company = await storage.createCompany(companyData);
    createdCompanies.push({ id: company.id, name: company.name });
    console.log(`Created company: ${company.name}`);
  }

  // Create signals for each company - match templates to company industry
  for (const company of createdCompanies) {
    // Find industry for this company
    const companyData = sampleCompanies.find(c => c.name === company.name);
    const companyIndustry = companyData?.industry || null;
    
    // Filter templates to match company industry (or use cross-industry templates)
    const matchingTemplates = signalTemplates.filter(t => 
      t.industry === companyIndustry || t.industry === null
    );
    
    // Use all matching templates (or fall back to all if none match)
    const templatesToUse = matchingTemplates.length > 0 ? matchingTemplates : signalTemplates;
    
    // Create 3-5 signals per company
    const signalCount = Math.min(templatesToUse.length, 3 + Math.floor(Math.random() * 3));
    
    for (let i = 0; i < signalCount; i++) {
      const template = templatesToUse[i % templatesToUse.length];
      const title = template.title.replace(/{company}/g, company.name);
      const content = template.content.replace(/{company}/g, company.name);
      
      // Replace {company} in entities and aiAnalysis
      const entities = JSON.parse(JSON.stringify(template.entities || {}).replace(/{company}/g, company.name));
      const aiAnalysis = JSON.parse(JSON.stringify(template.aiAnalysis || {}).replace(/{company}/g, company.name));
      
      const signalData: InsertSignal = {
        companyId: company.id,
        type: template.type,
        title,
        content,
        summary: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
        sourceName: ["TechCrunch", "Reuters", "Business Insider", "Bloomberg", "Feed Strategy", "Pet Food Processing", "World Grain"][Math.floor(Math.random() * 7)],
        sourceUrl: `https://example.com/news/${generateHash(title)}`,
        publishedAt: randomDate(30),
        sentiment: template.sentiment,
        priority: template.priority,
        entities,
        aiAnalysis,
        isRead: Math.random() > 0.6,
        isBookmarked: Math.random() > 0.8,
        contentStatus: ["new", "new", "new", "reviewing", "writing"][Math.floor(Math.random() * 5)],
        hash: generateHash(title + company.name),
      };

      await storage.createSignal(signalData);
    }
    
    console.log(`Created ${signalCount} signals for ${company.name} (${companyIndustry})`);
  }

  // Create sample alerts for industry monitoring
  const alertsData: InsertAlert[] = [
    {
      name: "All Funding Announcements",
      companyId: null,
      triggerType: "funding_announcement",
      notificationChannel: "dashboard",
      isActive: true,
    },
    {
      name: "Regulatory Updates - All Industries",
      companyId: null,
      triggerType: "regulatory",
      notificationChannel: "dashboard",
      isActive: true,
    },
    {
      name: "Tyson Foods Activity",
      companyId: createdCompanies.find(c => c.name === "Tyson Foods")?.id || null,
      triggerType: "all",
      notificationChannel: "dashboard",
      isActive: true,
    },
    {
      name: "Pet Food Industry News",
      companyId: createdCompanies.find(c => c.name === "Mars Petcare")?.id || null,
      triggerType: "news",
      notificationChannel: "dashboard",
      isActive: true,
    },
  ];

  for (const alertData of alertsData) {
    await storage.createAlert(alertData);
    console.log(`Created alert: ${alertData.name}`);
  }

  console.log("Database seeding complete!");
}
