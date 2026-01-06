const COMPANY_SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "co",
  "corp",
  "corporation",
  "company",
  "companies",
  "group",
  "holdings",
  "holding",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "nv",
  "bv",
  "pty",
  "pte",
];

export function normalizeKey(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompanySuffixes(name: string): string {
  if (!name) return "";
  
  let normalized = name.toLowerCase().trim();
  
  for (const suffix of COMPANY_SUFFIXES) {
    const patterns = [
      new RegExp(`\\s+${suffix}\\.?$`, "i"),
      new RegExp(`\\s*,\\s*${suffix}\\.?$`, "i"),
      new RegExp(`\\s+\\(${suffix}\\.?\\)$`, "i"),
    ];
    
    for (const pattern of patterns) {
      normalized = normalized.replace(pattern, "");
    }
  }
  
  return normalized.trim();
}

export function canonicalKey(type: string, name: string): string {
  if (!type || !name) return "";
  
  let normalizedName = name;
  
  if (type === "company") {
    normalizedName = normalizeCompanySuffixes(name);
  }
  
  return `${type}:${normalizeKey(normalizedName)}`;
}

export function isSimilarKey(key1: string, key2: string): boolean {
  return key1 === key2;
}
