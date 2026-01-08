import {
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type Signal,
  type InsertSignal,
  type Alert,
  type InsertAlert,
  type ActivityLog,
  type InsertActivityLog,
  type CompanyRelationship,
  type InsertCompanyRelationship,
  type Article,
  type InsertArticle,
  type MonitorRun,
  type InsertMonitorRun,
  type Entity,
  type SignalMetric,
  type InsertSignalMetric,
  type Trend,
  type InsertTrend,
  users,
  companies,
  signals,
  alerts,
  activityLog,
  companyRelationships,
  articles,
  monitorRuns,
  signalEntities,
  entities,
  signalMetrics,
  trends,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, sql, gt, inArray } from "drizzle-orm";
import { linkSignalToEntities, hasSignalEntityLinks } from "./graph";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;
  searchCompanies(query: string): Promise<Company[]>;

  // Signals
  getSignal(id: number): Promise<Signal | undefined>;
  getAllSignals(): Promise<Signal[]>;
  getSignalsByCompany(companyId: number): Promise<Signal[]>;
  getRecentSignalsForCompany(companyId: number, lookbackDays?: number, limit?: number): Promise<Signal[]>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  updateSignal(id: number, signal: Partial<InsertSignal>): Promise<Signal | undefined>;
  deleteSignal(id: number): Promise<void>;
  getSignalByHash(hash: string): Promise<Signal | undefined>;

  // Alerts
  getAlert(id: number): Promise<Alert | undefined>;
  getAllAlerts(): Promise<Alert[]>;
  getAlertsByCompany(companyId: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, alert: Partial<InsertAlert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;

  // Activity Log
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getRecentActivity(limit?: number): Promise<ActivityLog[]>;

  // Company Relationships
  getAllRelationships(): Promise<CompanyRelationship[]>;
  getRelationshipsByCompany(companyId: number): Promise<CompanyRelationship[]>;
  createRelationship(relationship: InsertCompanyRelationship): Promise<CompanyRelationship>;
  deleteRelationship(id: number): Promise<void>;

  // Scan History
  getScanHistory(days: number): Promise<{ date: string; industry: string; signalsFound: number }[]>;

  // Articles
  getArticle(id: number): Promise<Article | undefined>;
  getAllArticles(limit?: number): Promise<Article[]>;
  getArticlesBySignal(signalId: number): Promise<Article[]>;
  getArticlesByCompany(companyId: number): Promise<Article[]>;
  getArticleBySignalAndStyle(signalId: number, publishedTo: string, style: string): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: number, updates: Partial<InsertArticle>): Promise<Article | undefined>;

  // Monitor Runs
  createMonitorRun(run: InsertMonitorRun): Promise<MonitorRun>;
  updateMonitorRun(id: number, updates: Partial<InsertMonitorRun>): Promise<MonitorRun | undefined>;
  getMonitorRun(id: number): Promise<MonitorRun | undefined>;
  getMonitorRuns(limit?: number): Promise<MonitorRun[]>;
  getActiveMonitorRun(): Promise<MonitorRun | undefined>;

  // Signal Graph
  getRelatedSignals(signalId: number, limit?: number, days?: number): Promise<RelatedSignalResult[]>;
  backfillSignalEntities(startAfterId: number, limit: number): Promise<BackfillResult>;

  // Signal Metrics
  createSignalMetric(metric: InsertSignalMetric): Promise<SignalMetric>;
  getSignalMetrics(scopeType?: string, scopeId?: string, period?: string): Promise<SignalMetric[]>;
  getLatestMetrics(scopeType: string, period: string, limit?: number): Promise<SignalMetric[]>;
  deleteOldMetrics(beforeDate: Date): Promise<number>;

  // Trends
  createTrend(trend: InsertTrend): Promise<Trend>;
  getTrends(scopeType?: string, timeWindow?: string, limit?: number): Promise<Trend[]>;
  getLatestTrends(limit?: number): Promise<Trend[]>;
  deleteTrend(id: number): Promise<void>;
}

export interface RelatedSignalResult {
  signal: Signal;
  company: Company | null;
  sharedEntityCount: number;
  sharedEntitiesPreview: string[];
}

export interface BackfillResult {
  scanned: number;
  linkedSignals: number;
  linksCreated: number;
  skipped: number;
  errors: number;
  lastId: number;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // Companies
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.name, name));
    return company || undefined;
  }

  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.name);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.update(companies).set({ isActive: false }).where(eq(companies.id, id));
  }

  async searchCompanies(query: string): Promise<Company[]> {
    return db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.isActive, true),
          or(
            ilike(companies.name, `%${query}%`),
            ilike(companies.industry, `%${query}%`)
          )
        )
      )
      .orderBy(companies.name);
  }

  // Signals
  async getSignal(id: number): Promise<Signal | undefined> {
    const [signal] = await db.select().from(signals).where(eq(signals.id, id));
    return signal || undefined;
  }

  async getAllSignals(): Promise<Signal[]> {
    return db.select().from(signals).orderBy(desc(signals.createdAt));
  }

  async getSignalsByCompany(companyId: number): Promise<Signal[]> {
    return db
      .select()
      .from(signals)
      .where(eq(signals.companyId, companyId))
      .orderBy(desc(signals.createdAt));
  }

  async getRecentSignalsForCompany(companyId: number, lookbackDays: number = 14, limit: number = 200): Promise<Signal[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    return db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.companyId, companyId),
          sql`${signals.gatheredAt} >= ${cutoffDate}`
        )
      )
      .orderBy(desc(signals.gatheredAt))
      .limit(limit);
  }

  async createSignal(signal: InsertSignal): Promise<Signal> {
    const [created] = await db.insert(signals).values(signal).returning();
    return created;
  }

  async updateSignal(id: number, updates: Partial<InsertSignal>): Promise<Signal | undefined> {
    const [updated] = await db
      .update(signals)
      .set(updates)
      .where(eq(signals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSignal(id: number): Promise<void> {
    await db.delete(signals).where(eq(signals.id, id));
  }

  async getSignalByHash(hash: string): Promise<Signal | undefined> {
    const [signal] = await db.select().from(signals).where(eq(signals.hash, hash));
    return signal || undefined;
  }

  // Alerts
  async getAlert(id: number): Promise<Alert | undefined> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    return alert || undefined;
  }

  async getAllAlerts(): Promise<Alert[]> {
    return db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async getAlertsByCompany(companyId: number): Promise<Alert[]> {
    return db
      .select()
      .from(alerts)
      .where(eq(alerts.companyId, companyId))
      .orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async updateAlert(id: number, updates: Partial<InsertAlert>): Promise<Alert | undefined> {
    const [updated] = await db
      .update(alerts)
      .set(updates)
      .where(eq(alerts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteAlert(id: number): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }

  // Activity Log
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLog).values(log).returning();
    return created;
  }

  async getRecentActivity(limit: number = 50): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  // Company Relationships
  async getAllRelationships(): Promise<CompanyRelationship[]> {
    return db.select().from(companyRelationships).orderBy(desc(companyRelationships.createdAt));
  }

  async getRelationshipsByCompany(companyId: number): Promise<CompanyRelationship[]> {
    return db
      .select()
      .from(companyRelationships)
      .where(
        or(
          eq(companyRelationships.sourceCompanyId, companyId),
          eq(companyRelationships.targetCompanyId, companyId)
        )
      )
      .orderBy(desc(companyRelationships.createdAt));
  }

  async createRelationship(relationship: InsertCompanyRelationship): Promise<CompanyRelationship> {
    const [created] = await db.insert(companyRelationships).values(relationship).returning();
    return created;
  }

  async deleteRelationship(id: number): Promise<void> {
    await db.delete(companyRelationships).where(eq(companyRelationships.id, id));
  }

  // Scan History
  async getScanHistory(days: number): Promise<{ date: string; industry: string; signalsFound: number }[]> {
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD') as date,
        COALESCE(c.industry, 'Unknown') as industry,
        COUNT(s.id)::integer as signals_found
      FROM signals s
      JOIN companies c ON s.company_id = c.id
      WHERE s.created_at >= CURRENT_DATE - ${days} * INTERVAL '1 day'
      GROUP BY DATE(s.created_at), c.industry
      ORDER BY DATE(s.created_at) DESC, signals_found DESC
    `);
    return result.rows.map((row: any) => ({
      date: row.date,
      industry: row.industry,
      signalsFound: row.signals_found,
    }));
  }

  // Articles
  async getArticle(id: number): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.id, id));
    return article || undefined;
  }

  async getAllArticles(limit: number = 100): Promise<Article[]> {
    return db
      .select()
      .from(articles)
      .orderBy(desc(articles.createdAt))
      .limit(limit);
  }

  async getArticlesBySignal(signalId: number): Promise<Article[]> {
    return db
      .select()
      .from(articles)
      .where(eq(articles.signalId, signalId))
      .orderBy(desc(articles.createdAt));
  }

  async getArticlesByCompany(companyId: number): Promise<Article[]> {
    return db
      .select()
      .from(articles)
      .where(eq(articles.companyId, companyId))
      .orderBy(desc(articles.createdAt));
  }

  async getArticleBySignalAndStyle(signalId: number, publishedTo: string, style: string): Promise<Article | undefined> {
    const [article] = await db
      .select()
      .from(articles)
      .where(and(
        eq(articles.signalId, signalId),
        eq(articles.publishedTo, publishedTo),
        eq(articles.style, style)
      ));
    return article || undefined;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [created] = await db.insert(articles).values(article).returning();
    return created;
  }

  async updateArticle(id: number, updates: Partial<InsertArticle>): Promise<Article | undefined> {
    const [updated] = await db
      .update(articles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return updated || undefined;
  }

  // Monitor Runs
  async createMonitorRun(run: InsertMonitorRun): Promise<MonitorRun> {
    const [created] = await db.insert(monitorRuns).values(run).returning();
    return created;
  }

  async updateMonitorRun(id: number, updates: Partial<InsertMonitorRun>): Promise<MonitorRun | undefined> {
    const [updated] = await db
      .update(monitorRuns)
      .set(updates)
      .where(eq(monitorRuns.id, id))
      .returning();
    return updated || undefined;
  }

  async getMonitorRun(id: number): Promise<MonitorRun | undefined> {
    const [run] = await db.select().from(monitorRuns).where(eq(monitorRuns.id, id));
    return run || undefined;
  }

  async getMonitorRuns(limit: number = 20): Promise<MonitorRun[]> {
    return db
      .select()
      .from(monitorRuns)
      .orderBy(desc(monitorRuns.startedAt))
      .limit(limit);
  }

  async getActiveMonitorRun(): Promise<MonitorRun | undefined> {
    const [run] = await db
      .select()
      .from(monitorRuns)
      .where(eq(monitorRuns.status, "running"))
      .orderBy(desc(monitorRuns.startedAt))
      .limit(1);
    return run || undefined;
  }

  // Signal Graph
  async getRelatedSignals(signalId: number, limit: number = 10, days: number = 30): Promise<RelatedSignalResult[]> {
    const originalSignal = await this.getSignal(signalId);
    if (!originalSignal) {
      return [];
    }
    
    const signalEntityLinks = await db
      .select()
      .from(signalEntities)
      .where(eq(signalEntities.signalId, signalId));
    
    if (signalEntityLinks.length === 0) {
      return [];
    }
    
    const entityIds = signalEntityLinks.map(se => se.entityId);
    
    // Get subject entity IDs (role = 'subject') to filter from previews
    const subjectEntityIds = new Set(
      signalEntityLinks
        .filter(se => se.role === "subject")
        .map(se => se.entityId)
    );
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const relatedLinks = await db
      .select({
        signalId: signalEntities.signalId,
        entityId: signalEntities.entityId,
      })
      .from(signalEntities)
      .where(
        and(
          inArray(signalEntities.entityId, entityIds),
          sql`${signalEntities.signalId} != ${signalId}`
        )
      );
    
    if (relatedLinks.length === 0) {
      return [];
    }
    
    const signalEntityCounts = new Map<number, Set<number>>();
    for (const link of relatedLinks) {
      if (!signalEntityCounts.has(link.signalId)) {
        signalEntityCounts.set(link.signalId, new Set());
      }
      signalEntityCounts.get(link.signalId)!.add(link.entityId);
    }
    
    const sortedSignalIds = Array.from(signalEntityCounts.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, limit * 2)
      .map(([id]) => id);
    
    if (sortedSignalIds.length === 0) {
      return [];
    }
    
    const relatedSignals = await db
      .select()
      .from(signals)
      .where(
        and(
          inArray(signals.id, sortedSignalIds),
          sql`COALESCE(${signals.publishedAt}, ${signals.gatheredAt}) >= ${cutoffDate}`
        )
      )
      .orderBy(desc(signals.publishedAt));
    
    const results: RelatedSignalResult[] = [];
    
    for (const signal of relatedSignals.slice(0, limit * 2)) {
      if (results.length >= limit) break;
      
      const sharedEntityIds = signalEntityCounts.get(signal.id);
      if (!sharedEntityIds) continue;
      
      // Filter out subject entities from the shared set  
      const nonSubjectEntityIds = Array.from(sharedEntityIds).filter(id => !subjectEntityIds.has(id));
      
      // Skip signals that only share subject entities
      if (nonSubjectEntityIds.length === 0) continue;
      
      const sharedEntities = await db
        .select({ name: entities.name })
        .from(entities)
        .where(inArray(entities.id, nonSubjectEntityIds))
        .limit(10);
      
      const company = await this.getCompany(signal.companyId);
      
      // Deduplicate entity names for preview
      const seenNames = new Set<string>();
      const filteredPreview: string[] = [];
      for (const e of sharedEntities) {
        const lowerName = e.name.toLowerCase();
        if (!seenNames.has(lowerName)) {
          seenNames.add(lowerName);
          filteredPreview.push(e.name);
          if (filteredPreview.length >= 5) break;
        }
      }
      
      results.push({
        signal,
        company: company || null,
        sharedEntityCount: nonSubjectEntityIds.length,
        sharedEntitiesPreview: filteredPreview,
      });
    }
    
    return results.sort((a, b) => b.sharedEntityCount - a.sharedEntityCount);
  }

  async backfillSignalEntities(startAfterId: number, limit: number): Promise<BackfillResult> {
    const result: BackfillResult = {
      scanned: 0,
      linkedSignals: 0,
      linksCreated: 0,
      skipped: 0,
      errors: 0,
      lastId: startAfterId,
    };
    
    const signalBatch = await db
      .select()
      .from(signals)
      .where(gt(signals.id, startAfterId))
      .orderBy(signals.id)
      .limit(limit);
    
    for (const signal of signalBatch) {
      result.scanned++;
      result.lastId = signal.id;
      
      try {
        const hasLinks = await hasSignalEntityLinks(signal.id);
        if (hasLinks) {
          result.skipped++;
          continue;
        }
        
        const company = await this.getCompany(signal.companyId);
        if (!company) {
          result.errors++;
          continue;
        }
        
        const linkResult = await linkSignalToEntities(signal.id, company, signal.entities);
        result.linkedSignals++;
        result.linksCreated += linkResult.linked;
        result.errors += linkResult.errors;
      } catch (error) {
        console.error(`Backfill error for signal ${signal.id}:`, error);
        result.errors++;
      }
    }
    
    return result;
  }

  // Signal Metrics
  async createSignalMetric(metric: InsertSignalMetric): Promise<SignalMetric> {
    const [result] = await db.insert(signalMetrics).values(metric).returning();
    return result;
  }

  async getSignalMetrics(scopeType?: string, scopeId?: string, period?: string): Promise<SignalMetric[]> {
    const conditions = [];
    if (scopeType) conditions.push(eq(signalMetrics.scopeType, scopeType));
    if (scopeId) conditions.push(eq(signalMetrics.scopeId, scopeId));
    if (period) conditions.push(eq(signalMetrics.period, period));
    
    if (conditions.length === 0) {
      return db.select().from(signalMetrics).orderBy(desc(signalMetrics.capturedAt)).limit(1000);
    }
    
    return db.select().from(signalMetrics)
      .where(and(...conditions))
      .orderBy(desc(signalMetrics.capturedAt))
      .limit(1000);
  }

  async getLatestMetrics(scopeType: string, period: string, limit: number = 50): Promise<SignalMetric[]> {
    return db.select().from(signalMetrics)
      .where(and(
        eq(signalMetrics.scopeType, scopeType),
        eq(signalMetrics.period, period)
      ))
      .orderBy(desc(signalMetrics.capturedAt))
      .limit(limit);
  }

  async deleteOldMetrics(beforeDate: Date): Promise<number> {
    const result = await db.delete(signalMetrics)
      .where(sql`${signalMetrics.capturedAt} < ${beforeDate}`)
      .returning();
    return result.length;
  }

  // Trends
  async createTrend(trend: InsertTrend): Promise<Trend> {
    const [result] = await db.insert(trends).values(trend).returning();
    return result;
  }

  async getTrends(scopeType?: string, timeWindow?: string, limit: number = 50): Promise<Trend[]> {
    const conditions = [];
    if (scopeType) conditions.push(eq(trends.scopeType, scopeType));
    if (timeWindow) conditions.push(eq(trends.timeWindow, timeWindow));
    
    if (conditions.length === 0) {
      return db.select().from(trends).orderBy(desc(trends.generatedAt)).limit(limit);
    }
    
    return db.select().from(trends)
      .where(and(...conditions))
      .orderBy(desc(trends.generatedAt))
      .limit(limit);
  }

  async getLatestTrends(limit: number = 50): Promise<Trend[]> {
    return db.select().from(trends)
      .orderBy(desc(trends.generatedAt))
      .limit(limit);
  }

  async deleteTrend(id: number): Promise<void> {
    await db.delete(trends).where(eq(trends.id, id));
  }
}

export const storage = new DatabaseStorage();
