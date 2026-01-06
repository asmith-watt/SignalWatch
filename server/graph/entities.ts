import { db } from "../db";
import { entities, entityAliases, type Entity, type EntityAlias } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { canonicalKey, normalizeKey } from "./normalize";

export interface UpsertEntityInput {
  type: string;
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function upsertEntity(input: UpsertEntityInput): Promise<Entity> {
  const key = canonicalKey(input.type, input.name);
  
  if (!key) {
    throw new Error(`Invalid entity: type=${input.type}, name=${input.name}`);
  }
  
  const existing = await db
    .select()
    .from(entities)
    .where(eq(entities.canonicalKey, key))
    .limit(1);
  
  if (existing.length > 0) {
    await db
      .update(entities)
      .set({ updatedAt: new Date() })
      .where(eq(entities.id, existing[0].id));
    return existing[0];
  }
  
  const [inserted] = await db
    .insert(entities)
    .values({
      name: input.name.trim(),
      type: input.type,
      canonicalKey: key,
      description: input.description || null,
      metadata: input.metadata || null,
    })
    .returning();
  
  return inserted;
}

export async function upsertAlias(
  entityId: number,
  alias: string,
  source: string = "ai"
): Promise<EntityAlias | null> {
  const aliasKeyValue = normalizeKey(alias);
  
  if (!aliasKeyValue) {
    return null;
  }
  
  const existing = await db
    .select()
    .from(entityAliases)
    .where(eq(entityAliases.aliasKey, aliasKeyValue))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  try {
    const [inserted] = await db
      .insert(entityAliases)
      .values({
        entityId,
        alias: alias.trim(),
        aliasKey: aliasKeyValue,
        source,
      })
      .returning();
    
    return inserted;
  } catch (error) {
    return null;
  }
}

export async function getEntityByCanonicalKey(key: string): Promise<Entity | null> {
  const result = await db
    .select()
    .from(entities)
    .where(eq(entities.canonicalKey, key))
    .limit(1);
  
  return result[0] || null;
}

export async function findEntityByAlias(alias: string): Promise<Entity | null> {
  const aliasKeyValue = normalizeKey(alias);
  
  const aliasResult = await db
    .select()
    .from(entityAliases)
    .where(eq(entityAliases.aliasKey, aliasKeyValue))
    .limit(1);
  
  if (aliasResult.length === 0) {
    return null;
  }
  
  const entityResult = await db
    .select()
    .from(entities)
    .where(eq(entities.id, aliasResult[0].entityId))
    .limit(1);
  
  return entityResult[0] || null;
}
