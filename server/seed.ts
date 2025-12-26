import { storage } from "./storage";
import type { InsertCompany, InsertSignal, InsertAlert } from "@shared/schema";

const sampleCompanies: InsertCompany[] = [
  {
    name: "Stripe",
    website: "https://stripe.com",
    industry: "Fintech",
    description: "Financial infrastructure platform for the internet",
    location: "San Francisco, CA",
    size: "5001-10000",
    founded: "2010",
    linkedinUrl: "https://linkedin.com/company/stripe",
    twitterHandle: "stripe",
    isActive: true,
    tags: ["payments", "fintech", "infrastructure"],
  },
  {
    name: "OpenAI",
    website: "https://openai.com",
    industry: "AI/ML",
    description: "AI research and deployment company",
    location: "San Francisco, CA",
    size: "1001-5000",
    founded: "2015",
    linkedinUrl: "https://linkedin.com/company/openai",
    twitterHandle: "OpenAI",
    isActive: true,
    tags: ["artificial-intelligence", "research", "llm"],
  },
  {
    name: "Databricks",
    website: "https://databricks.com",
    industry: "Cloud",
    description: "Unified analytics platform for data engineering and data science",
    location: "San Francisco, CA",
    size: "5001-10000",
    founded: "2013",
    linkedinUrl: "https://linkedin.com/company/databricks",
    twitterHandle: "datababorricks",
    isActive: true,
    tags: ["data", "analytics", "cloud"],
  },
  {
    name: "Figma",
    website: "https://figma.com",
    industry: "SaaS",
    description: "Collaborative interface design tool",
    location: "San Francisco, CA",
    size: "1001-5000",
    founded: "2012",
    linkedinUrl: "https://linkedin.com/company/figma",
    twitterHandle: "figma",
    isActive: true,
    tags: ["design", "collaboration", "saas"],
  },
  {
    name: "Anthropic",
    website: "https://anthropic.com",
    industry: "AI/ML",
    description: "AI safety research company",
    location: "San Francisco, CA",
    size: "201-500",
    founded: "2021",
    linkedinUrl: "https://linkedin.com/company/anthropic",
    twitterHandle: "AnthropicAI",
    isActive: true,
    tags: ["artificial-intelligence", "safety", "research"],
  },
  {
    name: "Notion",
    website: "https://notion.so",
    industry: "SaaS",
    description: "All-in-one workspace for notes, docs, and collaboration",
    location: "San Francisco, CA",
    size: "501-1000",
    founded: "2016",
    linkedinUrl: "https://linkedin.com/company/notionhq",
    twitterHandle: "NotionHQ",
    isActive: true,
    tags: ["productivity", "collaboration", "notes"],
  },
  {
    name: "Snowflake",
    website: "https://snowflake.com",
    industry: "Cloud",
    description: "Cloud-based data warehousing company",
    location: "Bozeman, MT",
    size: "5001-10000",
    founded: "2012",
    linkedinUrl: "https://linkedin.com/company/snowflake-computing",
    twitterHandle: "SnowflakeDB",
    isActive: true,
    tags: ["data", "cloud", "warehouse"],
  },
  {
    name: "Plaid",
    website: "https://plaid.com",
    industry: "Fintech",
    description: "Financial data network powering digital finance",
    location: "San Francisco, CA",
    size: "1001-5000",
    founded: "2013",
    linkedinUrl: "https://linkedin.com/company/plaid",
    twitterHandle: "Plaid",
    isActive: true,
    tags: ["fintech", "api", "banking"],
  },
];

const signalTemplates = [
  {
    type: "funding",
    titles: [
      "{company} raises $500M in Series F funding",
      "{company} announces $200M growth round led by Sequoia",
      "{company} closes $100M Series D to fuel global expansion",
    ],
    priority: "high" as const,
    sentiment: "positive" as const,
  },
  {
    type: "executive_change",
    titles: [
      "{company} appoints new Chief Revenue Officer from Google",
      "{company} CEO announces transition to Executive Chairman role",
      "{company} hires former AWS VP as Chief Product Officer",
    ],
    priority: "high" as const,
    sentiment: "neutral" as const,
  },
  {
    type: "product_launch",
    titles: [
      "{company} launches new enterprise security features",
      "{company} unveils AI-powered workflow automation tool",
      "{company} releases major platform update with 50+ new integrations",
    ],
    priority: "medium" as const,
    sentiment: "positive" as const,
  },
  {
    type: "partnership",
    titles: [
      "{company} announces strategic partnership with Microsoft",
      "{company} expands AWS integration with new certified partnership",
      "{company} and Salesforce announce joint go-to-market initiative",
    ],
    priority: "medium" as const,
    sentiment: "positive" as const,
  },
  {
    type: "news",
    titles: [
      "{company} featured in Forbes 100 Cloud Companies list",
      "{company} CEO speaks at Web Summit on future of work",
      "Industry analysts predict strong growth for {company} in 2025",
    ],
    priority: "low" as const,
    sentiment: "positive" as const,
  },
  {
    type: "press_release",
    titles: [
      "{company} achieves SOC 2 Type II certification",
      "{company} expands to EMEA with new London headquarters",
      "{company} reports 150% year-over-year revenue growth",
    ],
    priority: "medium" as const,
    sentiment: "positive" as const,
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

  // Create signals for each company
  for (const company of createdCompanies) {
    const signalCount = 3 + Math.floor(Math.random() * 5); // 3-7 signals per company
    
    for (let i = 0; i < signalCount; i++) {
      const template = signalTemplates[Math.floor(Math.random() * signalTemplates.length)];
      const titleTemplate = template.titles[Math.floor(Math.random() * template.titles.length)];
      const title = titleTemplate.replace("{company}", company.name);
      
      const signalData: InsertSignal = {
        companyId: company.id,
        type: template.type,
        title,
        summary: `This signal indicates important business activity for ${company.name}. Click to view more details and take action.`,
        sourceName: ["TechCrunch", "Reuters", "Business Insider", "Bloomberg", "Company Blog"][Math.floor(Math.random() * 5)],
        sourceUrl: `https://example.com/news/${generateHash(title)}`,
        publishedAt: randomDate(30),
        sentiment: template.sentiment,
        priority: template.priority,
        isRead: Math.random() > 0.6,
        isBookmarked: Math.random() > 0.8,
        contentStatus: ["new", "new", "new", "reviewing"][Math.floor(Math.random() * 4)],
        hash: generateHash(title + company.name),
      };

      await storage.createSignal(signalData);
    }
    
    console.log(`Created ${signalCount} signals for ${company.name}`);
  }

  // Create sample alerts
  const alertsData: InsertAlert[] = [
    {
      name: "All Funding Announcements",
      companyId: null,
      triggerType: "funding_announcement",
      notificationChannel: "dashboard",
      isActive: true,
    },
    {
      name: "Executive Changes - Tech Companies",
      companyId: null,
      triggerType: "executive_change",
      notificationChannel: "dashboard",
      isActive: true,
    },
    {
      name: "OpenAI Product Launches",
      companyId: createdCompanies.find(c => c.name === "OpenAI")?.id || null,
      triggerType: "product_launch",
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
