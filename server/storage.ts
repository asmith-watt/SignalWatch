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
  users,
  companies,
  signals,
  alerts,
  activityLog,
  companyRelationships,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;
  searchCompanies(query: string): Promise<Company[]>;

  // Signals
  getSignal(id: number): Promise<Signal | undefined>;
  getAllSignals(): Promise<Signal[]>;
  getSignalsByCompany(companyId: number): Promise<Signal[]>;
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
}

export const storage = new DatabaseStorage();
