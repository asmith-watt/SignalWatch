import { db } from "../db";
import { signalEntities } from "@shared/schema";
import type { Company } from "@shared/schema";
import { extractCandidates } from "./extract";
import { upsertEntity, upsertAlias } from "./entities";
import { normalizeKey } from "./normalize";
import { eq, and } from "drizzle-orm";

export interface LinkResult {
  linked: number;
  errors: number;
}

export async function linkSignalToEntities(
  signalId: number,
  company: Company,
  entitiesJson: unknown
): Promise<LinkResult> {
  let linked = 0;
  let errors = 0;
  
  try {
    const candidates = extractCandidates(company, entitiesJson);
    
    for (const candidate of candidates) {
      try {
        const entity = await upsertEntity({
          type: candidate.type,
          name: candidate.name,
        });
        
        if (candidate.surface) {
          const surfaceKey = normalizeKey(candidate.surface);
          const entityNameKey = normalizeKey(entity.name);
          
          if (surfaceKey && surfaceKey !== entityNameKey) {
            await upsertAlias(entity.id, candidate.surface, "ai");
          }
        }
        
        const existing = await db
          .select()
          .from(signalEntities)
          .where(
            and(
              eq(signalEntities.signalId, signalId),
              eq(signalEntities.entityId, entity.id),
              eq(signalEntities.role, candidate.role)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(signalEntities).values({
            signalId,
            entityId: entity.id,
            role: candidate.role,
            confidence: candidate.confidence,
            surface: candidate.surface || null,
          });
          linked++;
        }
      } catch (candidateError) {
        console.error(`[Graph] Error linking candidate ${candidate.name}:`, candidateError);
        errors++;
      }
    }
  } catch (error) {
    console.error(`[Graph] Error linking signal ${signalId}:`, error);
    errors++;
  }
  
  return { linked, errors };
}

export async function hasSignalEntityLinks(signalId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(signalEntities)
    .where(eq(signalEntities.signalId, signalId))
    .limit(1);
  
  return result.length > 0;
}

export async function getSignalEntityLinks(signalId: number) {
  return await db
    .select()
    .from(signalEntities)
    .where(eq(signalEntities.signalId, signalId));
}
