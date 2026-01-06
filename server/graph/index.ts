export { normalizeKey, normalizeCompanySuffixes, canonicalKey } from "./normalize";
export { upsertEntity, upsertAlias, getEntityByCanonicalKey, findEntityByAlias } from "./entities";
export { extractCandidates, type EntityCandidate } from "./extract";
export { linkSignalToEntities, hasSignalEntityLinks, getSignalEntityLinks, type LinkResult } from "./link";
