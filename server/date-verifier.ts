import * as cheerio from 'cheerio';
import { storage } from './storage';

interface DateVerificationResult {
  signalId: number;
  title: string;
  sourceUrl: string;
  storedDate: string | null;
  extractedDate: string | null;
  match: boolean;
  error?: string;
}

// Common date patterns to look for
const datePatterns = [
  // ISO format: 2025-12-10
  /(\d{4}-\d{2}-\d{2})/,
  // US format: 12/10/2025 or 12-10-2025
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  // Written format: December 10, 2025 or 10 December 2025
  /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
  // Short month: Dec 10, 2025 or 10 Dec 2025
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
  /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i,
];

const monthMap: { [key: string]: number } = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12,
};

function parseExtractedDate(text: string): string | null {
  // Try ISO format first
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Try "10 December 2025" format
  const dayFirstMatch = text.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (dayFirstMatch) {
    const day = parseInt(dayFirstMatch[1]);
    const month = monthMap[dayFirstMatch[2].toLowerCase()];
    const year = parseInt(dayFirstMatch[3]);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try "December 10, 2025" format
  const monthFirstMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (monthFirstMatch) {
    const month = monthMap[monthFirstMatch[1].toLowerCase()];
    const day = parseInt(monthFirstMatch[2]);
    const year = parseInt(monthFirstMatch[3]);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try short month "10 Dec 2025" format
  const shortDayFirstMatch = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (shortDayFirstMatch) {
    const day = parseInt(shortDayFirstMatch[1]);
    const month = monthMap[shortDayFirstMatch[2].toLowerCase()];
    const year = parseInt(shortDayFirstMatch[3]);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try short month "Dec 10, 2025" format
  const shortMonthFirstMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (shortMonthFirstMatch) {
    const month = monthMap[shortMonthFirstMatch[1].toLowerCase()];
    const day = parseInt(shortMonthFirstMatch[2]);
    const year = parseInt(shortMonthFirstMatch[3]);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

async function fetchAndExtractDate(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try meta tags first (most reliable)
    const metaDate = $('meta[property="article:published_time"]').attr('content') ||
                     $('meta[name="date"]').attr('content') ||
                     $('meta[name="publish-date"]').attr('content') ||
                     $('meta[name="pubdate"]').attr('content') ||
                     $('meta[property="og:article:published_time"]').attr('content') ||
                     $('meta[itemprop="datePublished"]').attr('content');

    if (metaDate) {
      const parsed = parseExtractedDate(metaDate);
      if (parsed) return parsed;
      // Try direct ISO extraction
      const dateOnly = metaDate.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        return dateOnly;
      }
    }

    // Try time/date elements with datetime attribute
    const timeEl = $('time[datetime]').first().attr('datetime');
    if (timeEl) {
      const dateOnly = timeEl.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        return dateOnly;
      }
    }

    // Try common date selectors in article headers
    const dateSelectors = [
      '.article-date', '.post-date', '.publish-date', '.date', '.byline-date',
      '.article-meta time', '.post-meta time', '.entry-date', '.published',
      '[class*="date"]', '[class*="publish"]', '.timestamp',
    ];

    for (const selector of dateSelectors) {
      const text = $(selector).first().text().trim();
      if (text) {
        const parsed = parseExtractedDate(text);
        if (parsed) return parsed;
      }
    }

    // Last resort: look in the first 500 chars of visible text near the title
    const headerArea = $('header, .article-header, .post-header, h1').first().parent().text();
    const parsed = parseExtractedDate(headerArea.slice(0, 1000));
    if (parsed) return parsed;

    return null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

export async function verifySignalDates(options?: {
  limit?: number;
  companyId?: number;
  onlyMismatches?: boolean;
}): Promise<DateVerificationResult[]> {
  const limit = options?.limit || 50;
  const results: DateVerificationResult[] = [];

  // Get signals with source URLs
  let signals = await storage.getAllSignals();
  
  if (options?.companyId) {
    signals = signals.filter(s => s.companyId === options.companyId);
  }

  // Filter to only those with sourceUrl
  signals = signals.filter(s => s.sourceUrl && s.sourceUrl.startsWith('http'));
  
  // Limit the number to process
  signals = signals.slice(0, limit);

  console.log(`Verifying dates for ${signals.length} signals...`);

  for (const signal of signals) {
    const storedDate = signal.publishedAt 
      ? new Date(signal.publishedAt).toISOString().split('T')[0]
      : null;

    try {
      const extractedDate = await fetchAndExtractDate(signal.sourceUrl!);
      
      const match = storedDate === extractedDate || 
                    (!storedDate && !extractedDate);

      const result: DateVerificationResult = {
        signalId: signal.id,
        title: signal.title,
        sourceUrl: signal.sourceUrl!,
        storedDate,
        extractedDate,
        match,
      };

      if (!options?.onlyMismatches || !match) {
        results.push(result);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        signalId: signal.id,
        title: signal.title,
        sourceUrl: signal.sourceUrl!,
        storedDate,
        extractedDate: null,
        match: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

export async function fixSignalDates(signalIds: number[]): Promise<{ fixed: number; errors: number }> {
  let fixed = 0;
  let errors = 0;

  for (const signalId of signalIds) {
    const signal = await storage.getSignal(signalId);
    if (!signal || !signal.sourceUrl) {
      errors++;
      continue;
    }

    try {
      const extractedDate = await fetchAndExtractDate(signal.sourceUrl);
      if (extractedDate) {
        await storage.updateSignal(signalId, {
          publishedAt: new Date(extractedDate),
        });
        console.log(`Fixed signal ${signalId}: ${extractedDate}`);
        fixed++;
      } else {
        console.log(`Could not extract date for signal ${signalId}`);
        errors++;
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error fixing signal ${signalId}:`, error);
      errors++;
    }
  }

  return { fixed, errors };
}
