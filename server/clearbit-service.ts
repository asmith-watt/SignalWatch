interface ClearbitCompanySuggestion {
  name: string;
  domain: string;
  logo: string | null;
}

interface LookupResult {
  found: boolean;
  domain?: string;
  matchedName?: string;
  alternatives?: Array<{ name: string; domain: string }>;
}

export async function lookupCompanyDomain(companyName: string): Promise<LookupResult> {
  try {
    const response = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`
    );
    
    if (!response.ok) {
      console.error(`Clearbit API error: ${response.status}`);
      return { found: false };
    }

    const results = await response.json() as ClearbitCompanySuggestion[];
    
    if (!results || results.length === 0) {
      return { found: false };
    }

    const bestMatch = results[0];
    
    return {
      found: true,
      domain: bestMatch.domain,
      matchedName: bestMatch.name,
      alternatives: results.slice(1, 5).map(r => ({ name: r.name, domain: r.domain }))
    };
  } catch (error) {
    console.error("Error querying Clearbit:", error);
    return { found: false };
  }
}

export async function batchLookupDomains(
  companyNames: Array<{ id: number; name: string }>
): Promise<Array<{
  companyId: number;
  companyName: string;
  found: boolean;
  domain?: string;
  error?: string;
}>> {
  const results = [];

  for (const { id, name } of companyNames) {
    try {
      const lookup = await lookupCompanyDomain(name);
      
      if (lookup.found && lookup.domain) {
        results.push({
          companyId: id,
          companyName: name,
          found: true,
          domain: lookup.domain
        });
      } else {
        results.push({
          companyId: id,
          companyName: name,
          found: false
        });
      }
    } catch (error) {
      results.push({
        companyId: id,
        companyName: name,
        found: false,
        error: "Lookup failed"
      });
    }
  }

  return results;
}
