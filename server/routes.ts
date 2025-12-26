import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCompanySchema,
  insertSignalSchema,
  insertAlertSchema,
} from "@shared/schema";
import { z } from "zod";
import { analyzeSignal } from "./ai-analysis";
import { generateArticleFromSignal, exportArticleForCMS } from "./article-generator";
import { monitorPoultryCompanies, monitorAllCompanies, monitorCompany, monitorUSPoultryCompanies, monitorCompaniesByCountry } from "./perplexity-monitor";
import { importCompanies, getUSPoultryCompanies } from "./import-companies";

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

  return httpServer;
}
