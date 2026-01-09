import * as cheerio from "cheerio";

interface DiscoveredSource {
  id: string;
  name: string;
  type: "rss" | "crawl" | "regulator" | "association";
  url: string;
  domain: string;
  verified: boolean;
  sampleTitles: string[];
  confidence: number;
}

const COMMON_RSS_PATHS = [
  "/feed",
  "/feed/",
  "/rss",
  "/rss/",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feeds/posts/default",
  "/blog/feed",
  "/blog/rss",
  "/news/feed",
  "/news/rss",
  "/?feed=rss2",
  "/feed/rss2",
];

const COMMON_NEWS_PATHS = [
  "/news",
  "/press",
  "/press-releases",
  "/media",
  "/newsroom",
  "/blog",
  "/articles",
  "/updates",
  "/announcements",
];

async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SignalWatch/1.0; +https://signalwatch.app)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    return null;
  }
}

async function isValidRssFeed(url: string): Promise<{ valid: boolean; title?: string; items?: string[] }> {
  try {
    const response = await fetchWithTimeout(url, 5000);
    if (!response || !response.ok) return { valid: false };
    
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    
    const isXml = contentType.includes("xml") || 
                  contentType.includes("rss") || 
                  contentType.includes("atom") ||
                  text.trim().startsWith("<?xml") ||
                  text.includes("<rss") ||
                  text.includes("<feed");
    
    if (!isXml) return { valid: false };
    
    const $ = cheerio.load(text, { xmlMode: true });
    
    let title = $("channel > title").first().text() || 
                $("feed > title").first().text() ||
                "RSS Feed";
    
    const items: string[] = [];
    $("item > title, entry > title").slice(0, 3).each((_, el) => {
      const itemTitle = $(el).text().trim();
      if (itemTitle) items.push(itemTitle);
    });
    
    const hasItems = $("item").length > 0 || $("entry").length > 0;
    
    return { 
      valid: hasItems, 
      title: title.trim() || "RSS Feed",
      items 
    };
  } catch (error) {
    return { valid: false };
  }
}

async function findRssLinksInPage(html: string, baseUrl: string): Promise<string[]> {
  const $ = cheerio.load(html);
  const rssLinks: string[] = [];
  
  $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        const fullUrl = new URL(href, baseUrl).toString();
        rssLinks.push(fullUrl);
      } catch {}
    }
  });
  
  $('a[href*="rss"], a[href*="feed"], a[href*="atom"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && (href.includes("rss") || href.includes("feed") || href.includes("atom"))) {
      try {
        const fullUrl = new URL(href, baseUrl).toString();
        if (!rssLinks.includes(fullUrl)) {
          rssLinks.push(fullUrl);
        }
      } catch {}
    }
  });
  
  return rssLinks;
}

async function findNewsPages(html: string, baseUrl: string): Promise<{ url: string; name: string }[]> {
  const $ = cheerio.load(html);
  const newsPages: { url: string; name: string }[] = [];
  const domain = new URL(baseUrl).hostname;
  
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim().toLowerCase();
    
    if (!href) return;
    
    const newsKeywords = ["news", "press", "media", "blog", "updates", "announcements", "articles"];
    const hasNewsKeyword = newsKeywords.some(kw => 
      href.toLowerCase().includes(kw) || text.includes(kw)
    );
    
    if (hasNewsKeyword) {
      try {
        const fullUrl = new URL(href, baseUrl);
        if (fullUrl.hostname === domain || fullUrl.hostname.endsWith(`.${domain}`)) {
          const path = fullUrl.pathname;
          if (path.split("/").length <= 3) {
            const existing = newsPages.find(p => p.url === fullUrl.toString());
            if (!existing) {
              newsPages.push({
                url: fullUrl.toString(),
                name: $(el).text().trim() || path.replace(/\//g, " ").trim() || "News",
              });
            }
          }
        }
      } catch {}
    }
  });
  
  return newsPages.slice(0, 5);
}

export async function discoverDomainSources(
  domain: string,
  companyName?: string
): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const baseUrl = `https://${cleanDomain}`;
  
  console.log(`[Source Discovery] Starting discovery for domain: ${cleanDomain}`);
  
  let homepageHtml = "";
  try {
    const response = await fetchWithTimeout(baseUrl);
    if (response && response.ok) {
      homepageHtml = await response.text();
    }
  } catch (error) {
    console.log(`[Source Discovery] Could not fetch homepage: ${error}`);
  }
  
  const rssLinksFromPage = homepageHtml ? await findRssLinksInPage(homepageHtml, baseUrl) : [];
  console.log(`[Source Discovery] Found ${rssLinksFromPage.length} RSS links in page`);
  
  for (const rssUrl of rssLinksFromPage) {
    const result = await isValidRssFeed(rssUrl);
    if (result.valid) {
      sources.push({
        id: `rss-${Date.now()}-${sources.length + 1}`,
        name: result.title || `${companyName || cleanDomain} Feed`,
        type: "rss",
        url: rssUrl,
        domain: cleanDomain,
        verified: true,
        sampleTitles: result.items || [],
        confidence: 95,
      });
    }
  }
  
  const pathsToCheck = COMMON_RSS_PATHS.filter(path => {
    const fullUrl = `${baseUrl}${path}`;
    return !rssLinksFromPage.includes(fullUrl);
  });
  
  const rssChecks = await Promise.all(
    pathsToCheck.slice(0, 8).map(async (path) => {
      const url = `${baseUrl}${path}`;
      const result = await isValidRssFeed(url);
      return { path, url, ...result };
    })
  );
  
  for (const check of rssChecks) {
    if (check.valid) {
      const existing = sources.find(s => s.url === check.url);
      if (!existing) {
        sources.push({
          id: `rss-${Date.now()}-${sources.length + 1}`,
          name: check.title || `${companyName || cleanDomain} Feed`,
          type: "rss",
          url: check.url,
          domain: cleanDomain,
          verified: true,
          sampleTitles: check.items || [],
          confidence: 90,
        });
      }
    }
  }
  
  if (homepageHtml) {
    const newsPages = await findNewsPages(homepageHtml, baseUrl);
    for (const page of newsPages) {
      const existing = sources.find(s => s.url === page.url);
      if (!existing) {
        sources.push({
          id: `crawl-${Date.now()}-${sources.length + 1}`,
          name: `${companyName || cleanDomain} - ${page.name}`,
          type: "crawl",
          url: page.url,
          domain: cleanDomain,
          verified: false,
          sampleTitles: [],
          confidence: 60,
        });
      }
    }
  }
  
  for (const newsPath of COMMON_NEWS_PATHS.slice(0, 5)) {
    const url = `${baseUrl}${newsPath}`;
    const existing = sources.find(s => s.url === url);
    if (!existing) {
      try {
        const response = await fetchWithTimeout(url, 3000);
        if (response && response.ok) {
          sources.push({
            id: `crawl-${Date.now()}-${sources.length + 1}`,
            name: `${companyName || cleanDomain} - ${newsPath.replace("/", "").replace(/-/g, " ")}`,
            type: "crawl",
            url: url,
            domain: cleanDomain,
            verified: false,
            sampleTitles: [],
            confidence: 50,
          });
        }
      } catch {}
    }
  }
  
  console.log(`[Source Discovery] Found ${sources.length} sources for ${cleanDomain}`);
  
  return sources.sort((a, b) => b.confidence - a.confidence);
}

export async function discoverWebSources(
  market: string,
  keywords: string
): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  
  console.log(`[Source Discovery] Web discovery for market: ${market}, keywords: ${keywords}`);
  
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  
  if (perplexityKey) {
    try {
      const prompt = `Find authoritative RSS feeds, news sources, and industry publications for the ${market} industry. Focus on: ${keywords}. 
      
      Return ONLY a JSON array of sources with this exact format:
      [
        {"name": "Source Name", "url": "https://example.com/rss", "type": "rss|regulator|association", "description": "Brief description"}
      ]
      
      Include trade associations, regulatory bodies, and major industry news sites. Maximum 10 sources.`;
      
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${perplexityKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            { role: "system", content: "You are a helpful assistant that finds industry news sources. Always respond with valid JSON only." },
            { role: "user", content: prompt }
          ],
          max_tokens: 2000,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          try {
            const parsedSources = JSON.parse(jsonMatch[0]);
            for (const src of parsedSources) {
              if (src.url && src.name) {
                const domain = new URL(src.url).hostname;
                sources.push({
                  id: `web-${Date.now()}-${sources.length + 1}`,
                  name: src.name,
                  type: src.type === "regulator" ? "regulator" : 
                        src.type === "association" ? "association" : "rss",
                  url: src.url,
                  domain: domain,
                  verified: false,
                  sampleTitles: src.description ? [src.description] : [],
                  confidence: 70,
                });
              }
            }
          } catch (parseError) {
            console.log("[Source Discovery] Failed to parse Perplexity response as JSON");
          }
        }
      }
    } catch (error) {
      console.log(`[Source Discovery] Perplexity API error: ${error}`);
    }
  }
  
  if (sources.length === 0) {
    console.log("[Source Discovery] Using fallback sources (Perplexity unavailable or failed)");
    
    const fallbackByMarket: Record<string, DiscoveredSource[]> = {
      "Poultry": [
        { id: `web-${Date.now()}-1`, name: "WATTPoultry", type: "rss", url: "https://www.wattagnet.com/rss/content_feeds/poultry-feed", domain: "wattagnet.com", verified: true, sampleTitles: ["Poultry industry news"], confidence: 85 },
        { id: `web-${Date.now()}-2`, name: "Poultry World", type: "rss", url: "https://www.poultryworld.net/rss/latest-news", domain: "poultryworld.net", verified: true, sampleTitles: ["Global poultry updates"], confidence: 85 },
      ],
      "Pet Food": [
        { id: `web-${Date.now()}-1`, name: "Pet Food Processing", type: "rss", url: "https://www.petfoodprocessing.net/rss", domain: "petfoodprocessing.net", verified: true, sampleTitles: ["Pet food industry news"], confidence: 85 },
        { id: `web-${Date.now()}-2`, name: "Pet Food Industry", type: "rss", url: "https://www.petfoodindustry.com/rss", domain: "petfoodindustry.com", verified: true, sampleTitles: ["Pet food market updates"], confidence: 85 },
      ],
      "Feed & Grain": [
        { id: `web-${Date.now()}-1`, name: "Feed & Grain Magazine", type: "rss", url: "https://www.feedandgrain.com/rss", domain: "feedandgrain.com", verified: true, sampleTitles: ["Feed industry news"], confidence: 85 },
      ],
      "Baking & Milling": [
        { id: `web-${Date.now()}-1`, name: "Baking Business", type: "rss", url: "https://www.bakingbusiness.com/rss", domain: "bakingbusiness.com", verified: true, sampleTitles: ["Baking industry updates"], confidence: 85 },
        { id: `web-${Date.now()}-2`, name: "World Grain", type: "rss", url: "https://www.world-grain.com/rss", domain: "world-grain.com", verified: true, sampleTitles: ["Global grain news"], confidence: 85 },
      ],
    };
    
    const marketSources = fallbackByMarket[market] || [];
    sources.push(...marketSources);
  }
  
  return sources;
}
