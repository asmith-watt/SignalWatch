import { canonicalKey } from "./normalize";
import type { Company } from "@shared/schema";

export interface EntityCandidate {
  type: string;
  name: string;
  role: string;
  confidence: number;
  surface?: string;
  metadata?: Record<string, unknown>;
}

interface EntitiesJson {
  dates?: Array<{ date: string; event: string }>;
  people?: string[] | Array<{ name: string }>;
  companies?: Array<{ name: string; relationship?: string }>;
  locations?: string[];
  financials?: {
    growth?: string | null;
    funding?: string | null;
    revenue?: string | null;
    valuation?: string | null;
  };
}

const VALID_ROLES = new Set([
  "subject",
  "investor",
  "competitor",
  "partner",
  "supplier",
  "customer",
  "acquired",
  "actor",
  "target",
  "location",
  "other",
]);

function normalizeRole(relationship?: string): string {
  if (!relationship) return "other";
  
  const lower = relationship.toLowerCase().trim();
  
  if (VALID_ROLES.has(lower)) {
    return lower;
  }
  
  const mappings: Record<string, string> = {
    "invests": "investor",
    "invested": "investor",
    "investing": "investor",
    "competes": "competitor",
    "competing": "competitor",
    "partners": "partner",
    "partnered": "partner",
    "supplies": "supplier",
    "supplied": "supplier",
    "buys": "customer",
    "bought": "customer",
    "acquires": "acquired",
    "acquiring": "acquired",
  };
  
  return mappings[lower] || "other";
}

export function extractCandidates(
  company: Company,
  entitiesJson: unknown
): EntityCandidate[] {
  const candidates: EntityCandidate[] = [];
  const seenKeys = new Set<string>();
  
  const subjectKey = `${canonicalKey("company", company.name)}:subject`;
  candidates.push({
    type: "company",
    name: company.name,
    role: "subject",
    confidence: 100,
    surface: company.name,
  });
  seenKeys.add(subjectKey);
  
  if (!entitiesJson || typeof entitiesJson !== "object") {
    return candidates;
  }
  
  const data = entitiesJson as EntitiesJson;
  
  if (Array.isArray(data.companies)) {
    for (const item of data.companies) {
      if (!item.name || typeof item.name !== "string") continue;
      
      const role = normalizeRole(item.relationship);
      const key = `${canonicalKey("company", item.name)}:${role}`;
      
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      
      candidates.push({
        type: "company",
        name: item.name.trim(),
        role,
        confidence: 90,
        surface: item.name.trim(),
      });
    }
  }
  
  if (Array.isArray(data.people)) {
    for (const item of data.people) {
      const name = typeof item === "string" ? item : item?.name;
      if (!name || typeof name !== "string") continue;
      
      const key = `${canonicalKey("person", name)}:other`;
      
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      
      candidates.push({
        type: "person",
        name: name.trim(),
        role: "other",
        confidence: 80,
        surface: name.trim(),
      });
    }
  }
  
  if (Array.isArray(data.locations)) {
    for (const location of data.locations) {
      if (!location || typeof location !== "string") continue;
      
      const key = `${canonicalKey("geography", location)}:location`;
      
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      
      candidates.push({
        type: "geography",
        name: location.trim(),
        role: "location",
        confidence: 80,
        surface: location.trim(),
      });
    }
  }
  
  return candidates;
}
