import { storage } from "./storage";

const industryGroups: Record<string, string[]> = {
  Poultry: ["Poultry", "Chicken", "Turkey", "Egg", "Duck", "Broiler", "Layer", "Hatchery"],
  Feed: ["Feed", "Nutrition", "Premix", "Compound"],
  "Pet Food": ["Pet Food", "Pet", "Dog Food", "Cat Food"],
};

function matchesIndustryGroup(companyIndustry: string | null, groupName: string): boolean {
  if (!companyIndustry) return false;
  const groupKeywords = industryGroups[groupName] || [groupName];
  const industryLower = companyIndustry.toLowerCase();
  return groupKeywords.some(keyword => industryLower.includes(keyword.toLowerCase()));
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRFC822Date(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const day = days[date.getUTCDay()];
  const dayNum = String(date.getUTCDate()).padStart(2, "0");
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  
  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} +0000`;
}

export async function generateRssFeed(
  groupName: string,
  baseUrl: string
): Promise<string> {
  const companies = await storage.getAllCompanies();
  const allSignals = await storage.getAllSignals();
  const signals = allSignals.slice(0, 100);
  
  const groupCompanyIds = new Set(
    companies
      .filter(c => matchesIndustryGroup(c.industry, groupName))
      .map(c => c.id)
  );
  
  const companyMap = new Map(companies.map(c => [c.id, c]));
  
  const groupSignals = signals
    .filter(s => groupCompanyIds.has(s.companyId))
    .slice(0, 50);
  
  const now = new Date();
  const feedUrl = `${baseUrl}/api/rss/${encodeURIComponent(groupName.toLowerCase().replace(/\s+/g, "-"))}`;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SignalWatch - ${escapeXml(groupName)} Industry Signals</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Business intelligence signals for the ${escapeXml(groupName)} industry</description>
    <language>en-us</language>
    <lastBuildDate>${formatRFC822Date(now)}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
`;

  for (const signal of groupSignals) {
    const company = companyMap.get(signal.companyId);
    const companyName = company?.name || "Unknown Company";
    const pubDate = signal.publishedAt ? new Date(signal.publishedAt) : signal.createdAt;
    const signalUrl = `${baseUrl}/signals/${signal.id}`;
    
    let description = signal.content || signal.summary || "";
    if (signal.sourceUrl) {
      description += `\n\nSource: ${signal.sourceName || signal.sourceUrl}: ${signal.sourceUrl}`;
    }
    
    xml += `    <item>
      <title>${escapeXml(`[${companyName}] ${signal.title}`)}</title>
      <link>${escapeXml(signalUrl)}</link>
      <description><![CDATA[${description}]]></description>
      <pubDate>${formatRFC822Date(pubDate)}</pubDate>
      <guid isPermaLink="true">${escapeXml(signalUrl)}</guid>
      <category>${escapeXml(signal.type || "news")}</category>
    </item>
`;
  }

  xml += `  </channel>
</rss>`;

  return xml;
}

export async function generateAllSignalsRssFeed(baseUrl: string): Promise<string> {
  const companies = await storage.getAllCompanies();
  const allSignals = await storage.getAllSignals();
  const signals = allSignals.slice(0, 50);
  
  const companyMap = new Map(companies.map(c => [c.id, c]));
  const now = new Date();
  const feedUrl = `${baseUrl}/api/rss/all`;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SignalWatch - All Industry Signals</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Business intelligence signals across all monitored industries</description>
    <language>en-us</language>
    <lastBuildDate>${formatRFC822Date(now)}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
`;

  for (const signal of signals) {
    const company = companyMap.get(signal.companyId);
    const companyName = company?.name || "Unknown Company";
    const pubDate = signal.publishedAt ? new Date(signal.publishedAt) : signal.createdAt;
    const signalUrl = `${baseUrl}/signals/${signal.id}`;
    
    let description = signal.content || signal.summary || "";
    if (signal.sourceUrl) {
      description += `\n\nSource: ${signal.sourceName || signal.sourceUrl}: ${signal.sourceUrl}`;
    }
    
    xml += `    <item>
      <title>${escapeXml(`[${companyName}] ${signal.title}`)}</title>
      <link>${escapeXml(signalUrl)}</link>
      <description><![CDATA[${description}]]></description>
      <pubDate>${formatRFC822Date(pubDate)}</pubDate>
      <guid isPermaLink="true">${escapeXml(signalUrl)}</guid>
      <category>${escapeXml(signal.type || "news")}</category>
    </item>
`;
  }

  xml += `  </channel>
</rss>`;

  return xml;
}

export function getAvailableFeeds(): { name: string; slug: string }[] {
  return [
    { name: "All Signals", slug: "all" },
    ...Object.keys(industryGroups).map(name => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    })),
  ];
}
