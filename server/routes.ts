import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCompanySchema,
  insertSignalSchema,
  insertAlertSchema,
} from "@shared/schema";
import { z } from "zod";
import { analyzeSignal, enrichSignal, batchEnrichSignals } from "./ai-analysis";
import { generateArticleFromSignal, exportArticleForCMS } from "./article-generator";
import { monitorPoultryCompanies, monitorAllCompanies, monitorCompany, monitorUSPoultryCompanies, monitorCompaniesByCountry, monitorCompaniesByIndustry } from "./perplexity-monitor";
import { importCompanies, getUSPoultryCompanies } from "./import-companies";
import { importFeedCompanies } from "./import-feed-companies";
import { importPetfoodCompanies } from "./import-petfood-companies";
import { generateRssFeed, generateAllSignalsRssFeed, getAvailableFeeds } from "./rss-feeds";
import { publishToWordPress, testWordPressConnection } from "./wordpress-publisher";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Companies CRUD
  app.get("/api/companies", async (req: Request, res: Response) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/us", async (req: Request, res: Response) => {
    try {
      const usCompanies = await getUSPoultryCompanies();
      res.json(usCompanies);
    } catch (error) {
      console.error("Error fetching US companies:", error);
      res.status(500).json({ error: "Failed to fetch US companies" });
    }
  });

  app.get("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", async (req: Request, res: Response) => {
    try {
      const parsed = insertCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const company = await storage.createCompany(parsed.data);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertCompanySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const company = await storage.updateCompany(id, parsed.data);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompany(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  app.get("/api/companies/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      const companies = await storage.searchCompanies(query);
      res.json(companies);
    } catch (error) {
      console.error("Error searching companies:", error);
      res.status(500).json({ error: "Failed to search companies" });
    }
  });

  // Signals CRUD
  app.get("/api/signals", async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
      
      let signalList;
      if (companyId) {
        signalList = await storage.getSignalsByCompany(companyId);
      } else {
        signalList = await storage.getAllSignals();
      }
      res.json(signalList);
    } catch (error) {
      console.error("Error fetching signals:", error);
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });

  app.get("/api/signals/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }
      res.json(signal);
    } catch (error) {
      console.error("Error fetching signal:", error);
      res.status(500).json({ error: "Failed to fetch signal" });
    }
  });

  app.post("/api/signals", async (req: Request, res: Response) => {
    try {
      const parsed = insertSignalSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      // Check for duplicates using hash
      if (parsed.data.hash) {
        const existing = await storage.getSignalByHash(parsed.data.hash);
        if (existing) {
          return res.status(409).json({ error: "Duplicate signal", existing });
        }
      }

      const signal = await storage.createSignal(parsed.data);
      res.status(201).json(signal);
    } catch (error) {
      console.error("Error creating signal:", error);
      res.status(500).json({ error: "Failed to create signal" });
    }
  });

  app.patch("/api/signals/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertSignalSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const signal = await storage.updateSignal(id, parsed.data);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }
      res.json(signal);
    } catch (error) {
      console.error("Error updating signal:", error);
      res.status(500).json({ error: "Failed to update signal" });
    }
  });

  app.delete("/api/signals/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSignal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting signal:", error);
      res.status(500).json({ error: "Failed to delete signal" });
    }
  });

  // Alerts CRUD
  app.get("/api/alerts", async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
      
      let alertList;
      if (companyId) {
        alertList = await storage.getAlertsByCompany(companyId);
      } else {
        alertList = await storage.getAllAlerts();
      }
      res.json(alertList);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.getAlert(id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error fetching alert:", error);
      res.status(500).json({ error: "Failed to fetch alert" });
    }
  });

  app.post("/api/alerts", async (req: Request, res: Response) => {
    try {
      const parsed = insertAlertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const alert = await storage.createAlert(parsed.data);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.patch("/api/alerts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertAlertSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const alert = await storage.updateAlert(id, parsed.data);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAlert(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // Users
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const userList = await storage.getAllUsers();
      res.json(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Activity log
  app.get("/api/activity", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activity = await storage.getRecentActivity(limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // AI Signal Analysis
  app.post("/api/signals/:id/analyze", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      // Get company name
      const company = await storage.getCompany(signal.companyId);
      
      const analysis = await analyzeSignal({
        title: signal.title,
        content: signal.content,
        type: signal.type,
        companyName: company?.name,
      });

      // Update signal with analysis
      const updated = await storage.updateSignal(id, {
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        priority: analysis.priority,
        entities: analysis.entities,
        aiAnalysis: {
          keyPoints: analysis.keyPoints,
          suggestedActions: analysis.suggestedActions,
          relatedTopics: analysis.relatedTopics,
        },
      });

      res.json({ signal: updated, analysis });
    } catch (error) {
      console.error("Error analyzing signal:", error);
      res.status(500).json({ error: "Failed to analyze signal" });
    }
  });

  // Deep Signal Enrichment - Extract entities and AI insights
  app.post("/api/signals/:id/enrich", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId);
      
      const enrichment = await enrichSignal({
        title: signal.title,
        summary: signal.summary,
        content: signal.content,
        type: signal.type,
        companyName: company?.name,
        industry: company?.industry || undefined,
      });

      const updated = await storage.updateSignal(id, {
        entities: enrichment.entities,
        aiAnalysis: enrichment.aiAnalysis,
      });

      res.json({ signal: updated, enrichment });
    } catch (error) {
      console.error("Error enriching signal:", error);
      res.status(500).json({ error: "Failed to enrich signal" });
    }
  });

  // Batch enrich multiple signals
  app.post("/api/signals/enrich-batch", async (req: Request, res: Response) => {
    try {
      const { signalIds, limit } = req.body;
      let signalsToEnrich: any[] = [];

      if (signalIds && Array.isArray(signalIds)) {
        for (const id of signalIds) {
          const signal = await storage.getSignal(id);
          if (signal) {
            const company = await storage.getCompany(signal.companyId);
            signalsToEnrich.push({
              id: signal.id,
              title: signal.title,
              summary: signal.summary,
              content: signal.content,
              type: signal.type,
              companyName: company?.name,
              industry: company?.industry,
            });
          }
        }
      } else {
        const allSignals = await storage.getAllSignals();
        const unenriched = allSignals.filter(s => !s.aiAnalysis);
        const toProcess = unenriched.slice(0, limit || 10);
        
        for (const signal of toProcess) {
          const company = await storage.getCompany(signal.companyId);
          signalsToEnrich.push({
            id: signal.id,
            title: signal.title,
            summary: signal.summary,
            content: signal.content,
            type: signal.type,
            companyName: company?.name,
            industry: company?.industry,
          });
        }
      }

      const enrichments = await batchEnrichSignals(signalsToEnrich);
      
      let updatedCount = 0;
      for (const [id, enrichment] of Array.from(enrichments.entries())) {
        await storage.updateSignal(id, {
          entities: enrichment.entities,
          aiAnalysis: enrichment.aiAnalysis,
        });
        updatedCount++;
      }

      res.json({ 
        success: true, 
        enrichedCount: updatedCount,
        message: `Enriched ${updatedCount} signals with entities and AI insights`
      });
    } catch (error) {
      console.error("Error batch enriching signals:", error);
      res.status(500).json({ error: "Failed to batch enrich signals" });
    }
  });

  // Article Generation - Generate draft article from signal
  app.post("/api/signals/:id/generate-article", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const requestedStyle = req.body.style || "news";
      const validStyles = ["news", "analysis", "brief"];
      
      if (!validStyles.includes(requestedStyle)) {
        return res.status(400).json({ error: `Invalid style. Must be one of: ${validStyles.join(", ")}` });
      }
      
      const style = requestedStyle as "news" | "analysis" | "brief";
      
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId);
      const article = await generateArticleFromSignal(signal, company, style);
      const exports = exportArticleForCMS(article, signal, company);

      res.json({ article, exports });
    } catch (error) {
      console.error("Error generating article:", error);
      res.status(500).json({ error: "Failed to generate article" });
    }
  });

  // Export signal as article in various formats
  app.get("/api/signals/:id/export/:format", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const requestedFormat = req.params.format;
      const validFormats = ["wordpress", "contentful", "markdown", "json"];
      
      if (!validFormats.includes(requestedFormat)) {
        return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(", ")}` });
      }
      
      const format = requestedFormat as "wordpress" | "contentful" | "markdown" | "json";
      
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId);
      const article = await generateArticleFromSignal(signal, company, "news");
      const exports = exportArticleForCMS(article, signal, company);

      if (format === "markdown") {
        res.setHeader("Content-Type", "text/markdown");
        res.setHeader("Content-Disposition", `attachment; filename="article-${id}.md"`);
        return res.send(exports.markdown);
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="article-${id}-${format}.json"`);
      
      if (format === "wordpress") {
        res.json(exports.wordpress);
      } else if (format === "contentful") {
        res.json(exports.contentful);
      } else {
        res.json(exports.json);
      }
    } catch (error) {
      console.error("Error exporting article:", error);
      res.status(500).json({ error: "Failed to export article" });
    }
  });

  // Webhook endpoint - push article to external CMS
  app.post("/api/signals/:id/publish", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { webhookUrl, format = "json" } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ error: "webhookUrl is required" });
      }

      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId);
      const article = await generateArticleFromSignal(signal, company, "news");
      const exports = exportArticleForCMS(article, signal, company);

      // Send to webhook
      const payload = format === "wordpress" ? exports.wordpress 
        : format === "contentful" ? exports.contentful 
        : exports.json;

      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        throw new Error(`Webhook failed: ${webhookResponse.status}`);
      }

      // Update signal status to published
      await storage.updateSignal(id, { contentStatus: "published" });

      res.json({ 
        success: true, 
        message: "Article published successfully",
        article 
      });
    } catch (error) {
      console.error("Error publishing article:", error);
      res.status(500).json({ error: "Failed to publish article" });
    }
  });

  // WordPress direct publishing
  app.post("/api/wordpress/test", async (req: Request, res: Response) => {
    try {
      const { siteUrl, username, applicationPassword } = req.body;
      
      if (!siteUrl || !username || !applicationPassword) {
        return res.status(400).json({ 
          error: "siteUrl, username, and applicationPassword are required" 
        });
      }

      const result = await testWordPressConnection({ siteUrl, username, applicationPassword });
      res.json(result);
    } catch (error) {
      console.error("Error testing WordPress connection:", error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });

  app.post("/api/signals/:id/publish-wordpress", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { siteUrl, username, applicationPassword, status = "draft", style = "news" } = req.body;
      
      if (!siteUrl || !username || !applicationPassword) {
        return res.status(400).json({ 
          error: "WordPress credentials (siteUrl, username, applicationPassword) are required" 
        });
      }

      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId);
      const article = await generateArticleFromSignal(signal, company, style);
      
      const result = await publishToWordPress(
        article,
        signal,
        company,
        { siteUrl, username, applicationPassword },
        status
      );

      if (result.success) {
        await storage.updateSignal(id, { contentStatus: "published" });
      }

      res.json({
        ...result,
        article: result.success ? article : undefined,
      });
    } catch (error) {
      console.error("Error publishing to WordPress:", error);
      res.status(500).json({ error: "Failed to publish to WordPress" });
    }
  });

  // Monitoring endpoints
  app.post("/api/monitor/poultry", async (req: Request, res: Response) => {
    try {
      console.log("Starting poultry company monitoring...");
      const results = await monitorPoultryCompanies();
      const totalSignals = results.reduce((sum, r) => sum + r.signalsCreated, 0);
      res.json({ 
        success: true, 
        message: `Monitoring complete. Created ${totalSignals} new signals.`,
        results 
      });
    } catch (error) {
      console.error("Error monitoring poultry companies:", error);
      res.status(500).json({ error: "Failed to monitor companies" });
    }
  });

  app.post("/api/monitor/all", async (req: Request, res: Response) => {
    try {
      console.log("Starting full company monitoring...");
      const results = await monitorAllCompanies();
      const totalSignals = results.reduce((sum, r) => sum + r.signalsCreated, 0);
      res.json({ 
        success: true, 
        companiesMonitored: results.length,
        message: `Monitoring complete. Created ${totalSignals} new signals.`,
        results 
      });
    } catch (error) {
      console.error("Error monitoring companies:", error);
      res.status(500).json({ error: "Failed to monitor companies" });
    }
  });

  app.post("/api/monitor/company/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      console.log(`Starting monitoring for ${company.name}...`);
      const signalsCreated = await monitorCompany(company);
      res.json({ 
        success: true, 
        message: `Created ${signalsCreated} new signals for ${company.name}`,
        signalsCreated 
      });
    } catch (error) {
      console.error("Error monitoring company:", error);
      res.status(500).json({ error: "Failed to monitor company" });
    }
  });

  app.post("/api/monitor/us", async (req: Request, res: Response) => {
    try {
      console.log("Starting US poultry company monitoring...");
      const results = await monitorUSPoultryCompanies();
      const totalSignals = results.reduce((sum, r) => sum + r.signalsCreated, 0);
      res.json({ 
        success: true, 
        message: `Monitoring complete. Created ${totalSignals} new signals from ${results.length} US companies.`,
        results 
      });
    } catch (error) {
      console.error("Error monitoring US companies:", error);
      res.status(500).json({ error: "Failed to monitor US companies" });
    }
  });

  app.post("/api/monitor/country/:country", async (req: Request, res: Response) => {
    try {
      const country = req.params.country;
      console.log(`Starting ${country} company monitoring...`);
      const results = await monitorCompaniesByCountry(country);
      const totalSignals = results.reduce((sum, r) => sum + r.signalsCreated, 0);
      res.json({ 
        success: true, 
        message: `Monitoring complete. Created ${totalSignals} new signals from ${results.length} ${country} companies.`,
        results 
      });
    } catch (error) {
      console.error("Error monitoring companies by country:", error);
      res.status(500).json({ error: "Failed to monitor companies" });
    }
  });

  app.post("/api/monitor/industry/:industry", async (req: Request, res: Response) => {
    try {
      const industry = decodeURIComponent(req.params.industry);
      console.log(`Starting ${industry} industry monitoring...`);
      const results = await monitorCompaniesByIndustry(industry);
      const totalSignals = results.reduce((sum, r) => sum + r.signalsCreated, 0);
      res.json({ 
        success: true, 
        companiesMonitored: results.length,
        message: `Monitoring complete. Created ${totalSignals} new signals from ${results.length} ${industry} companies.`,
        results 
      });
    } catch (error) {
      console.error("Error monitoring companies by industry:", error);
      res.status(500).json({ error: "Failed to monitor companies" });
    }
  });

  app.post("/api/companies/import", async (req: Request, res: Response) => {
    try {
      console.log("Starting company import from file...");
      const result = await importCompanies();
      res.json({ 
        success: true, 
        message: `Import complete. Added ${result.imported} new companies, updated ${result.skipped} existing companies.`,
        imported: result.imported,
        skipped: result.skipped,
        usCompanies: result.usCompanies
      });
    } catch (error) {
      console.error("Error importing companies:", error);
      res.status(500).json({ error: "Failed to import companies" });
    }
  });

  app.post("/api/companies/import-feed", async (req: Request, res: Response) => {
    try {
      console.log("Starting feed companies import...");
      const result = await importFeedCompanies();
      res.json({ 
        success: true, 
        message: `Import complete. Added ${result.imported} new feed companies, skipped ${result.skipped} existing.`,
        imported: result.imported,
        skipped: result.skipped
      });
    } catch (error) {
      console.error("Error importing feed companies:", error);
      res.status(500).json({ error: "Failed to import feed companies" });
    }
  });

  app.post("/api/companies/import-petfood", async (req: Request, res: Response) => {
    try {
      console.log("Starting pet food companies import...");
      const result = await importPetfoodCompanies();
      res.json({ 
        success: true, 
        message: `Import complete. Added ${result.imported} new pet food companies, skipped ${result.skipped} existing.`,
        imported: result.imported,
        skipped: result.skipped
      });
    } catch (error) {
      console.error("Error importing pet food companies:", error);
      res.status(500).json({ error: "Failed to import pet food companies" });
    }
  });

  // CSV Export endpoints
  app.get("/api/export/companies.csv", async (req: Request, res: Response) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      const headers = ["id", "name", "website", "industry", "description", "logo_url", "location", "region", "country", "size", "founded", "tags", "product_types", "rss_feed_url", "linkedin_url", "twitter_handle", "is_active", "created_at", "updated_at"];
      
      const escapeCSV = (val: unknown): string => {
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const rows = allCompanies.map(c => [
        c.id, c.name, c.website, c.industry, c.description, c.logoUrl, c.location, c.region, c.country, c.size, c.founded,
        c.tags ? JSON.stringify(c.tags) : "",
        c.productTypes ? JSON.stringify(c.productTypes) : "",
        c.rssFeedUrl, c.linkedinUrl, c.twitterHandle, c.isActive, c.createdAt?.toISOString(), c.updatedAt?.toISOString()
      ].map(escapeCSV).join(","));
      
      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=companies-export.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting companies:", error);
      res.status(500).json({ error: "Failed to export companies" });
    }
  });

  app.get("/api/export/signals.csv", async (req: Request, res: Response) => {
    try {
      const allSignals = await storage.getAllSignals();
      const headers = ["id", "company_id", "type", "title", "content", "summary", "source_url", "source_name", "published_at", "sentiment", "entities", "priority", "is_read", "is_bookmarked", "assigned_to", "content_status", "notes", "ai_analysis", "hash", "created_at"];
      
      const escapeCSV = (val: unknown): string => {
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const rows = allSignals.map(s => [
        s.id, s.companyId, s.type, s.title, s.content, s.summary, s.sourceUrl, s.sourceName,
        s.publishedAt?.toISOString(), s.sentiment,
        s.entities ? JSON.stringify(s.entities) : "",
        s.priority, s.isRead, s.isBookmarked, s.assignedTo, s.contentStatus, s.notes,
        s.aiAnalysis ? JSON.stringify(s.aiAnalysis) : "",
        s.hash, s.createdAt?.toISOString()
      ].map(escapeCSV).join(","));
      
      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=signals-export.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting signals:", error);
      res.status(500).json({ error: "Failed to export signals" });
    }
  });

  // CSV Import endpoints
  app.post("/api/import/companies", async (req: Request, res: Response) => {
    try {
      const { csv } = req.body;
      if (!csv) return res.status(400).json({ error: "No CSV data provided" });
      
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (char === "," && !inQuotes) { result.push(current); current = ""; }
          else { current += char; }
        }
        result.push(current);
        return result;
      };
      
      const lines = csv.split("\n").filter((line: string) => line.trim());
      if (lines.length < 2) return res.status(400).json({ error: "CSV must have header and at least one row" });
      
      const headers = parseCSVLine(lines[0]);
      let imported = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
        
        try {
          await storage.createCompany({
            name: row.name,
            website: row.website || null,
            industry: row.industry || null,
            description: row.description || null,
            logoUrl: row.logo_url || null,
            location: row.location || null,
            region: row.region || null,
            country: row.country || null,
            size: row.size || null,
            founded: row.founded || null,
            tags: row.tags ? JSON.parse(row.tags) : null,
            productTypes: row.product_types ? JSON.parse(row.product_types) : null,
            rssFeedUrl: row.rss_feed_url || null,
            linkedinUrl: row.linkedin_url || null,
            twitterHandle: row.twitter_handle || null,
            isActive: row.is_active === "true",
          });
          imported++;
        } catch (e) {
          console.error(`Error importing company row ${i}:`, e);
        }
      }
      
      res.json({ success: true, imported, total: lines.length - 1 });
    } catch (error) {
      console.error("Error importing companies:", error);
      res.status(500).json({ error: "Failed to import companies" });
    }
  });

  app.post("/api/import/signals", async (req: Request, res: Response) => {
    try {
      const { csv } = req.body;
      if (!csv) return res.status(400).json({ error: "No CSV data provided" });
      
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (char === "," && !inQuotes) { result.push(current); current = ""; }
          else { current += char; }
        }
        result.push(current);
        return result;
      };
      
      const lines = csv.split("\n").filter((line: string) => line.trim());
      if (lines.length < 2) return res.status(400).json({ error: "CSV must have header and at least one row" });
      
      const headers = parseCSVLine(lines[0]);
      let imported = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
        
        try {
          await storage.createSignal({
            companyId: parseInt(row.company_id, 10),
            type: row.type || "news",
            title: row.title,
            content: row.content || null,
            summary: row.summary || null,
            sourceUrl: row.source_url || null,
            sourceName: row.source_name || null,
            publishedAt: row.published_at ? new Date(row.published_at) : null,
            sentiment: row.sentiment || null,
            entities: row.entities ? JSON.parse(row.entities) : null,
            priority: row.priority || "medium",
            isRead: row.is_read === "true",
            isBookmarked: row.is_bookmarked === "true",
            assignedTo: row.assigned_to || null,
            contentStatus: row.content_status || "new",
            notes: row.notes || null,
            aiAnalysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null,
            hash: row.hash || null,
          });
          imported++;
        } catch (e) {
          console.error(`Error importing signal row ${i}:`, e);
        }
      }
      
      res.json({ success: true, imported, total: lines.length - 1 });
    } catch (error) {
      console.error("Error importing signals:", error);
      res.status(500).json({ error: "Failed to import signals" });
    }
  });

  app.get("/api/rss", (req: Request, res: Response) => {
    const feeds = getAvailableFeeds();
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const feedsWithUrls = feeds.map(f => ({
      ...f,
      url: `${baseUrl}/api/rss/${f.slug}`,
    }));
    res.json(feedsWithUrls);
  });

  app.get("/api/rss/:group", async (req: Request, res: Response) => {
    try {
      const group = decodeURIComponent(req.params.group);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      
      let xml: string;
      if (group === "all") {
        xml = await generateAllSignalsRssFeed(baseUrl);
      } else {
        const groupName = group.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        xml = await generateRssFeed(groupName, baseUrl);
      }
      
      res.set("Content-Type", "application/rss+xml; charset=utf-8");
      res.send(xml);
    } catch (error) {
      console.error("Error generating RSS feed:", error);
      res.status(500).json({ error: "Failed to generate RSS feed" });
    }
  });

  return httpServer;
}
