import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCompanySchema,
  insertSignalSchema,
  insertAlertSchema,
} from "@shared/schema";
import { z } from "zod";
import { analyzeSignal, enrichSignal, batchEnrichSignals, extractRelationshipsFromSignal } from "./ai-analysis";
import { generateArticleFromSignal, exportArticleForCMS } from "./article-generator";
import { generateArticleWithClaude, type ClaudeModel } from "./claude-article-generator";
import { monitorPoultryCompanies, monitorAllCompanies, monitorCompany, monitorUSPoultryCompanies, monitorCompaniesByCountry, monitorCompaniesByIndustry, enrichCompanies } from "./perplexity-monitor";
import { getProgress } from "./monitor-progress";
import { importCompanies, getUSPoultryCompanies } from "./import-companies";
import { importFeedCompanies } from "./import-feed-companies";
import { importPetfoodCompanies } from "./import-petfood-companies";
import { importBakingMillingCompanies } from "./import-baking-milling-companies";
import { importBakingMillingSignals } from "./import-signals-by-company-name";
import { generateRssFeed, generateAllSignalsRssFeed, getAvailableFeeds } from "./rss-feeds";
import { publishToWordPress, testWordPressConnection } from "./wordpress-publisher";
import { selectStockImage, buildMediaSitePayload, publishToMediaSite, generateAIImage } from "./media-site-publisher";
import { verifySignalDates, fixSignalDates, verifySourceUrl, verifySourceUrls } from "./date-verifier";
import { objectStorageClient } from "./replit_integrations/object_storage";
import express from "express";
import path from "path";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Serve stock images from public/stock-images
  app.use("/stock-images", express.static(path.resolve(process.cwd(), "public/stock-images")));
  
  // Serve AI-generated images from public/generated-images (legacy local storage)
  app.use("/generated-images", express.static(path.resolve(process.cwd(), "public/generated-images")));

  // Serve AI-generated images from Object Storage (persistent storage)
  app.get("/api/storage/images/:filename", async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const bucket = objectStorageClient.bucket(bucketId);
      const file = bucket.file(`public/generated-images/${filename}`);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "Image not found" });
      }

      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "image/png",
        "Cache-Control": "public, max-age=31536000",
      });

      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming image" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error serving image from storage:", error);
      res.status(500).json({ error: "Failed to serve image" });
    }
  });

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

  // Date verification endpoints (must be before /api/signals/:id)
  app.get("/api/signals/verify-dates", async (req: Request, res: Response) => {
    try {
      const signalId = req.query.signalId ? parseInt(req.query.signalId as string) : undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const onlyMismatches = req.query.onlyMismatches === 'true';

      const results = await verifySignalDates({ limit, companyId, onlyMismatches, signalId });
      
      const mismatches = results.filter(r => !r.match && r.extractedDate);
      const couldNotExtract = results.filter(r => !r.extractedDate && !r.error);
      const errors = results.filter(r => r.error);
      
      res.json({
        total: results.length,
        mismatches: mismatches.length,
        couldNotExtract: couldNotExtract.length,
        errors: errors.length,
        results,
      });
    } catch (error) {
      console.error("Error verifying dates:", error);
      res.status(500).json({ error: "Failed to verify dates" });
    }
  });

  app.post("/api/signals/fix-dates", async (req: Request, res: Response) => {
    try {
      const { signalIds } = req.body;
      if (!Array.isArray(signalIds) || signalIds.length === 0) {
        return res.status(400).json({ error: "signalIds array required" });
      }

      const result = await fixSignalDates(signalIds);
      res.json(result);
    } catch (error) {
      console.error("Error fixing dates:", error);
      res.status(500).json({ error: "Failed to fix dates" });
    }
  });

  // Source URL verification - checks if article headline matches signal title
  app.get("/api/signals/verify-source", async (req: Request, res: Response) => {
    try {
      const signalId = parseInt(req.query.signalId as string);
      if (isNaN(signalId)) {
        return res.status(400).json({ error: "signalId required" });
      }

      const result = await verifySourceUrl(signalId);
      res.json(result);
    } catch (error) {
      console.error("Error verifying source:", error);
      res.status(500).json({ error: "Failed to verify source" });
    }
  });

  // Batch source URL verification
  app.get("/api/signals/verify-sources", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const onlyMismatches = req.query.onlyMismatches === 'true';

      const result = await verifySourceUrls({ limit, onlyMismatches });
      res.json(result);
    } catch (error) {
      console.error("Error batch verifying sources:", error);
      res.status(500).json({ error: "Failed to verify sources" });
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

      // Ensure citations has a default value
      const signalData = {
        ...parsed.data,
        citations: parsed.data.citations || [],
      };

      const signal = await storage.createSignal(signalData);
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

  // Company Relationships for Industry Map
  app.get("/api/relationships", async (req: Request, res: Response) => {
    try {
      const relationships = await storage.getAllRelationships();
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching relationships:", error);
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  });

  app.get("/api/relationships/company/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const relationships = await storage.getRelationshipsByCompany(id);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching company relationships:", error);
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", async (req: Request, res: Response) => {
    try {
      const relationship = await storage.createRelationship(req.body);
      res.status(201).json(relationship);
    } catch (error) {
      console.error("Error creating relationship:", error);
      res.status(500).json({ error: "Failed to create relationship" });
    }
  });

  app.delete("/api/relationships/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRelationship(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting relationship:", error);
      res.status(500).json({ error: "Failed to delete relationship" });
    }
  });

  app.post("/api/relationships/extract-from-signals", async (req: Request, res: Response) => {
    try {
      const signals = await storage.getAllSignals();
      const companies = await storage.getAllCompanies();
      const existingRelationships = await storage.getAllRelationships();
      
      const existingPairs = new Set(
        existingRelationships.map(r => `${r.sourceCompanyId}-${r.targetCompanyId}-${r.relationshipType}`)
      );
      
      const companyNameToId = new Map<string, number>();
      companies.forEach(c => {
        companyNameToId.set(c.name.toLowerCase(), c.id);
      });
      
      let relationshipsCreated = 0;
      const recentSignals = signals.slice(0, 50);
      
      for (const signal of recentSignals) {
        const extracted = await extractRelationshipsFromSignal(signal, companies);
        
        for (const rel of extracted) {
          const sourceId = companyNameToId.get(rel.sourceCompanyName.toLowerCase());
          const targetId = companyNameToId.get(rel.targetCompanyName.toLowerCase());
          
          if (sourceId && targetId && sourceId !== targetId) {
            const pairKey = `${sourceId}-${targetId}-${rel.relationshipType}`;
            const reversePairKey = `${targetId}-${sourceId}-${rel.relationshipType}`;
            
            if (!existingPairs.has(pairKey) && !existingPairs.has(reversePairKey)) {
              await storage.createRelationship({
                sourceCompanyId: sourceId,
                targetCompanyId: targetId,
                relationshipType: rel.relationshipType,
                description: rel.description,
                strength: 1,
                sourceSignalId: signal.id,
                isAiExtracted: true,
                confidence: rel.confidence,
              });
              existingPairs.add(pairKey);
              relationshipsCreated++;
            }
          }
        }
      }
      
      res.json({ 
        success: true, 
        signalsProcessed: recentSignals.length,
        relationshipsCreated 
      });
    } catch (error) {
      console.error("Error extracting relationships:", error);
      res.status(500).json({ error: "Failed to extract relationships" });
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

      const updateData: any = {
        entities: enrichment.entities,
        aiAnalysis: enrichment.aiAnalysis,
      };
      
      if (!signal.publishedAt && enrichment.publicationDate) {
        const pubDate = new Date(enrichment.publicationDate);
        if (!isNaN(pubDate.getTime()) && pubDate <= new Date()) {
          updateData.publishedAt = pubDate;
          console.log(`  Updated publication date for signal ${id}: ${enrichment.publicationDate}`);
        }
      }

      const updated = await storage.updateSignal(id, updateData);

      res.json({ signal: updated, enrichment });
    } catch (error) {
      console.error("Error enriching signal:", error);
      res.status(500).json({ error: "Failed to enrich signal" });
    }
  });

  // Analyze ALL unanalyzed signals
  app.post("/api/signals/analyze-all", async (req: Request, res: Response) => {
    try {
      const allSignals = await storage.getAllSignals();
      const unanalyzed = allSignals.filter(s => !s.aiAnalysis);
      
      console.log(`Starting batch analysis of ${unanalyzed.length} unanalyzed signals...`);
      
      let analyzed = 0;
      let failed = 0;
      
      for (const signal of unanalyzed) {
        try {
          const company = await storage.getCompany(signal.companyId);
          const enrichment = await enrichSignal({
            title: signal.title,
            summary: signal.summary,
            content: signal.content,
            type: signal.type,
            companyName: company?.name,
            industry: company?.industry || undefined,
          });
          
          const updateData: any = {
            entities: enrichment.entities,
            aiAnalysis: enrichment.aiAnalysis,
          };
          
          if (!signal.publishedAt && enrichment.publicationDate) {
            const pubDate = new Date(enrichment.publicationDate);
            if (!isNaN(pubDate.getTime()) && pubDate <= new Date()) {
              updateData.publishedAt = pubDate;
            }
          }
          
          await storage.updateSignal(signal.id, updateData);
          
          analyzed++;
          console.log(`  Analyzed ${analyzed}/${unanalyzed.length}: ${signal.title}`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`  Failed to analyze signal ${signal.id}:`, err);
          failed++;
        }
      }
      
      res.json({
        success: true,
        totalUnanalyzed: unanalyzed.length,
        analyzed,
        failed,
        message: `Analyzed ${analyzed} signals (${failed} failed)`
      });
    } catch (error) {
      console.error("Error analyzing all signals:", error);
      res.status(500).json({ error: "Failed to analyze signals" });
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
      const validStyles = ["news", "analysis", "brief", "signal"];
      const provider = req.body.provider || "openai";
      const claudeModel = req.body.claudeModel || "claude-sonnet-4-5";
      
      if (!validStyles.includes(requestedStyle)) {
        return res.status(400).json({ error: `Invalid style. Must be one of: ${validStyles.join(", ")}` });
      }
      
      if (!["openai", "claude"].includes(provider)) {
        return res.status(400).json({ error: "Invalid provider. Must be 'openai' or 'claude'" });
      }
      
      const style = requestedStyle as "news" | "analysis" | "brief" | "signal";
      
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId);
      
      let article;
      if (provider === "claude") {
        const validModels = ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"];
        if (!validModels.includes(claudeModel)) {
          return res.status(400).json({ error: `Invalid Claude model. Must be one of: ${validModels.join(", ")}` });
        }
        article = await generateArticleWithClaude(signal, company, style, claudeModel as ClaudeModel);
      } else {
        article = await generateArticleFromSignal(signal, company, style);
      }
      
      const exports = exportArticleForCMS(article, signal, company);

      res.json({ article, exports, provider, model: provider === "claude" ? claudeModel : "gpt-4o" });
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
        
        await storage.createArticle({
          signalId: signal.id,
          companyId: signal.companyId,
          headline: article.headline,
          subheadline: article.subheadline,
          body: article.body,
          style: style,
          publishedTo: "wordpress",
          externalUrl: result.postUrl || null,
          externalId: result.postId?.toString() || null,
          imageUrl: null,
        });
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

  // Media Site Publishing - Push to external media site
  app.post("/api/signals/:id/publish-to-media", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { style = "news" } = req.body;

      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId) || null;
      const article = await generateArticleFromSignal(signal, company, style);

      // Use production URL if available (set during deployment), otherwise fall back to current domain
      const productionAppUrl = process.env.PRODUCTION_APP_URL;
      const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers.host || "localhost:5000";
      const baseUrl = productionAppUrl || (replitDomain ? `https://${replitDomain}` : `${protocol}://${host}`);
      
      // Always use AI-generated images for proper licensing
      const aiImage = await generateAIImage(signal, company, baseUrl);
      if (!aiImage) {
        return res.status(500).json({ error: "Failed to generate AI image" });
      }
      const imageUrl = aiImage.imageUrl;
      const imageCredit = aiImage.credit;
      
      const payload = buildMediaSitePayload(article, signal, company, imageUrl, imageCredit);

      const result = await publishToMediaSite(payload);

      if (result.success) {
        await storage.updateSignal(id, { contentStatus: "published" });
        
        // Build full external URL if the result contains a relative path
        let fullExternalUrl: string | null = null;
        if (result.articleUrl) {
          const mediaSiteUrl = process.env.MEDIA_SITE_URL?.replace(/\/$/, "") || "";
          fullExternalUrl = result.articleUrl.startsWith("http") 
            ? result.articleUrl 
            : `${mediaSiteUrl}${result.articleUrl.startsWith("/") ? "" : "/"}${result.articleUrl}`;
        }
        
        await storage.createArticle({
          signalId: signal.id,
          companyId: signal.companyId,
          headline: article.headline,
          subheadline: article.subheadline,
          body: article.body,
          style: style,
          publishedTo: "media_site",
          externalUrl: fullExternalUrl,
          externalId: result.articleId || null,
          imageUrl: imageUrl,
        });
      }

      res.json({
        ...result,
        payload: result.success ? payload : undefined,
        article: result.success ? article : undefined,
      });
    } catch (error) {
      console.error("Error publishing to media site:", error);
      res.status(500).json({ error: "Failed to publish to media site" });
    }
  });

  // Get stock image URL for a signal
  app.get("/api/signals/:id/stock-image", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId) || null;
      
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;
      
      const imageUrl = selectStockImage(signal, company, baseUrl);

      res.json({ imageUrl, industry: company?.industry || "Poultry" });
    } catch (error) {
      console.error("Error getting stock image:", error);
      res.status(500).json({ error: "Failed to get stock image" });
    }
  });

  // Article history endpoints
  app.get("/api/signals/:id/articles", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const articles = await storage.getArticlesBySignal(id);
      res.json(articles);
    } catch (error) {
      console.error("Error getting articles by signal:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

  app.get("/api/companies/:id/articles", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const articles = await storage.getArticlesByCompany(id);
      res.json(articles);
    } catch (error) {
      console.error("Error getting articles by company:", error);
      res.status(500).json({ error: "Failed to get articles" });
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

  app.get("/api/monitor/progress", async (req: Request, res: Response) => {
    try {
      const progress = getProgress();
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  app.post("/api/monitor/stop", async (req: Request, res: Response) => {
    try {
      const { requestStop } = await import("./monitor-progress");
      requestStop();
      res.json({ success: true, message: "Stop requested" });
    } catch (error) {
      console.error("Error stopping monitor:", error);
      res.status(500).json({ error: "Failed to stop monitoring" });
    }
  });

  app.get("/api/monitor/history", async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const history = await storage.getScanHistory(days);
      res.json(history);
    } catch (error) {
      console.error("Error fetching scan history:", error);
      res.status(500).json({ error: "Failed to fetch scan history" });
    }
  });

  // Monitor Runs endpoints - track scheduled monitoring runs
  app.get("/api/monitor/runs", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const runs = await storage.getMonitorRuns(limit);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching monitor runs:", error);
      res.status(500).json({ error: "Failed to fetch monitor runs" });
    }
  });

  app.get("/api/monitor/runs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const run = await storage.getMonitorRun(id);
      if (!run) {
        return res.status(404).json({ error: "Monitor run not found" });
      }
      res.json(run);
    } catch (error) {
      console.error("Error fetching monitor run:", error);
      res.status(500).json({ error: "Failed to fetch monitor run" });
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
      const result = await monitorCompany(company);
      
      let message: string;
      if (result.signalsFound === 0) {
        message = `No news found for ${company.name}`;
      } else if (result.signalsCreated === 0) {
        message = `Checked ${result.signalsFound} articles for ${company.name} - all already collected`;
      } else {
        message = `Found ${result.signalsCreated} new signals for ${company.name}`;
      }
      
      res.json({ 
        success: true, 
        message,
        company: company.name,
        signalsCreated: result.signalsCreated,
        signalsFound: result.signalsFound,
        duplicatesSkipped: result.duplicatesSkipped,
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

  app.post("/api/companies/enrich", async (req: Request, res: Response) => {
    try {
      const { companyIds, industry } = req.body as { companyIds?: number[]; industry?: string };
      
      let idsToEnrich: number[] | undefined = companyIds;
      
      if (industry && !companyIds) {
        const allCompanies = await storage.getAllCompanies();
        idsToEnrich = allCompanies
          .filter(c => c.industry === industry)
          .map(c => c.id);
      }
      
      console.log(`Starting company enrichment${idsToEnrich ? ` for ${idsToEnrich.length} companies` : " for all companies missing data"}...`);
      const results = await enrichCompanies(idsToEnrich);
      const updatedCount = results.filter(r => r.updated).length;
      
      res.json({ 
        success: true, 
        message: `Enrichment complete. Updated ${updatedCount}/${results.length} companies.`,
        companiesProcessed: results.length,
        companiesUpdated: updatedCount,
        results 
      });
    } catch (error) {
      console.error("Error enriching companies:", error);
      res.status(500).json({ error: "Failed to enrich companies" });
    }
  });

  app.post("/api/companies/:id/enrich", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      console.log(`Enriching single company: ${company.name}...`);
      const results = await enrichCompanies([id]);
      
      const updatedCompany = await storage.getCompany(id);
      
      res.json({ 
        success: true, 
        message: results[0]?.updated 
          ? `Successfully enriched ${company.name}` 
          : `No new data found for ${company.name}`,
        updated: results[0]?.updated || false,
        company: updatedCompany
      });
    } catch (error) {
      console.error("Error enriching company:", error);
      res.status(500).json({ error: "Failed to enrich company" });
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

  app.post("/api/companies/import-baking-milling", async (req: Request, res: Response) => {
    try {
      console.log("Starting Baking & Milling companies import...");
      const result = await importBakingMillingCompanies();
      res.json({ 
        success: true, 
        message: `Import complete. Added ${result.imported} new Baking & Milling companies, updated ${result.updated}, skipped ${result.skipped}.`,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped
      });
    } catch (error) {
      console.error("Error importing Baking & Milling companies:", error);
      res.status(500).json({ error: "Failed to import Baking & Milling companies" });
    }
  });

  app.post("/api/signals/import-baking-milling", async (req: Request, res: Response) => {
    try {
      console.log("Starting Baking & Milling signals import...");
      const result = await importBakingMillingSignals();
      res.json({ 
        success: true, 
        message: `Import complete. Added ${result.imported} signals, skipped ${result.skipped}.`,
        imported: result.imported,
        skipped: result.skipped,
        companyNotFound: result.companyNotFound
      });
    } catch (error) {
      console.error("Error importing Baking & Milling signals:", error);
      res.status(500).json({ error: "Failed to import Baking & Milling signals" });
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
      const headers = ["id", "company_id", "type", "title", "content", "summary", "source_url", "source_name", "citations", "published_at", "gathered_at", "sentiment", "entities", "priority", "is_read", "is_bookmarked", "assigned_to", "content_status", "notes", "ai_analysis", "hash", "created_at"];
      
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
        s.citations ? JSON.stringify(s.citations) : "",
        s.publishedAt?.toISOString(), s.gatheredAt?.toISOString(), s.sentiment,
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
          const parseTags = (val: string): string[] | null => {
            if (!val) return null;
            if (val.startsWith("[")) {
              try { return JSON.parse(val); } catch { return null; }
            }
            return val.split(";").map(t => t.trim()).filter(Boolean);
          };
          
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
            tags: parseTags(row.tags),
            productTypes: parseTags(row.product_types),
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
            citations: row.citations ? JSON.parse(row.citations) : [],
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

  // Export ALL data as JSON for production sync
  app.get("/api/export/all-data", async (req: Request, res: Response) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      const allSignals = await storage.getAllSignals();
      const allAlerts = await storage.getAllAlerts();
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        companies: allCompanies,
        signals: allSignals,
        alerts: allAlerts,
      };
      
      res.setHeader("Content-Type", "application/json");
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting all data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Import ALL data from JSON export (for production sync)
  app.post("/api/import/all-data", async (req: Request, res: Response) => {
    try {
      const { companies, signals } = req.body;
      
      console.log(`[Import All] Received ${companies?.length || 0} companies and ${signals?.length || 0} signals`);
      
      if (!Array.isArray(companies) || !Array.isArray(signals)) {
        return res.status(400).json({ error: "Invalid import data format" });
      }
      
      const idMapping = new Map<number, number>();
      let companiesImported = 0;
      let companiesUpdated = 0;
      let signalsImported = 0;
      let signalsUpdated = 0;
      const errors: string[] = [];
      
      // Import/update companies
      for (const company of companies) {
        try {
          const existing = await storage.getCompanyByName(company.name);
          
          if (existing) {
            idMapping.set(company.id, existing.id);
            // Update existing company with new data
            await storage.updateCompany(existing.id, {
              website: company.website,
              industry: company.industry,
              description: company.description,
              region: company.region,
              country: company.country,
              tags: company.tags,
              productTypes: company.productTypes,
            });
            companiesUpdated++;
          } else {
            const { id, createdAt, updatedAt, ...companyData } = company;
            const created = await storage.createCompany(companyData);
            idMapping.set(company.id, created.id);
            companiesImported++;
          }
        } catch (e: any) {
          errors.push(`Company ${company.name}: ${e.message}`);
        }
      }
      
      // Import/update signals
      for (const signal of signals) {
        try {
          const newCompanyId = idMapping.get(signal.companyId);
          if (!newCompanyId) {
            errors.push(`No company mapping for signal ${signal.id}`);
            continue;
          }
          
          // Check if signal exists by hash
          const existingSignal = signal.hash ? await storage.getSignalByHash(signal.hash) : null;
          
          if (existingSignal) {
            // Update existing signal with corrected dates
            await storage.updateSignal(existingSignal.id, {
              publishedAt: signal.publishedAt ? new Date(signal.publishedAt) : null,
              gatheredAt: signal.gatheredAt ? new Date(signal.gatheredAt) : null,
            });
            signalsUpdated++;
          } else {
            await storage.createSignal({
              companyId: newCompanyId,
              type: signal.type,
              title: signal.title,
              content: signal.content || null,
              summary: signal.summary || null,
              sourceUrl: signal.sourceUrl || null,
              sourceName: signal.sourceName || null,
              citations: signal.citations || [],
              publishedAt: signal.publishedAt ? new Date(signal.publishedAt) : null,
              gatheredAt: signal.gatheredAt ? new Date(signal.gatheredAt) : new Date(),
              sentiment: signal.sentiment || null,
              entities: signal.entities || null,
              priority: signal.priority || "medium",
              isRead: signal.isRead || false,
              isBookmarked: signal.isBookmarked || false,
              assignedTo: signal.assignedTo || null,
              contentStatus: signal.contentStatus || "new",
              notes: signal.notes || null,
              aiAnalysis: signal.aiAnalysis || null,
              hash: signal.hash || null,
            });
            signalsImported++;
          }
        } catch (e: any) {
          errors.push(`Signal ${signal.id}: ${e.message}`);
        }
      }
      
      console.log(`[Import All] Companies: ${companiesImported} new, ${companiesUpdated} updated`);
      console.log(`[Import All] Signals: ${signalsImported} new, ${signalsUpdated} updated`);
      
      res.json({ 
        success: true, 
        companiesImported,
        companiesUpdated,
        signalsImported,
        signalsUpdated,
        errors: errors.slice(0, 20),
      });
    } catch (error) {
      console.error("Error importing all data:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  // Export Baking & Milling data as JSON for production import
  app.get("/api/export/baking-milling", async (req: Request, res: Response) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      const bakingCompanies = allCompanies.filter(c => 
        c.industry?.toLowerCase().includes("baking") ||
        c.industry?.toLowerCase().includes("milling") ||
        c.industry?.toLowerCase().includes("flour") ||
        c.industry?.toLowerCase().includes("grain") ||
        c.industry?.toLowerCase().includes("mill")
      );
      
      const companyIds = new Set(bakingCompanies.map(c => c.id));
      const allSignals = await storage.getAllSignals();
      const bakingSignals = allSignals.filter(s => companyIds.has(s.companyId));
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        companies: bakingCompanies,
        signals: bakingSignals,
      };
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=baking-milling-export.json");
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting Baking & Milling data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Import Baking & Milling data from JSON export
  app.post("/api/import/baking-milling", async (req: Request, res: Response) => {
    try {
      const { companies, signals } = req.body;
      
      console.log(`[Import] Received ${companies?.length || 0} companies and ${signals?.length || 0} signals`);
      
      if (!Array.isArray(companies) || !Array.isArray(signals)) {
        return res.status(400).json({ error: "Invalid import data format" });
      }
      
      const idMapping = new Map<number, number>();
      let companiesImported = 0;
      let companiesSkipped = 0;
      let signalsImported = 0;
      let signalErrors: string[] = [];
      
      // Import companies first - force create for B&M industry
      let companyErrors: string[] = [];
      for (const company of companies) {
        try {
          const existing = await storage.getCompanyByName(company.name);
          
          // If existing company has same industry, skip; otherwise create new
          if (existing && existing.industry === company.industry) {
            idMapping.set(company.id, existing.id);
            companiesSkipped++;
          } else {
            const { id, createdAt, updatedAt, ...companyData } = company;
            const created = await storage.createCompany(companyData);
            idMapping.set(company.id, created.id);
            companiesImported++;
          }
        } catch (e: any) {
          companyErrors.push(`${company.name}: ${e.message}`);
          console.error(`Error importing company ${company.name}:`, e);
        }
      }
      
      console.log(`[Import] Companies: ${companiesImported} imported, ${companiesSkipped} skipped`);
      
      // Import signals with new company IDs
      for (const signal of signals) {
        try {
          const newCompanyId = idMapping.get(signal.companyId);
          if (!newCompanyId) {
            signalErrors.push(`No company mapping for signal ${signal.id}`);
            continue;
          }
          
          // Explicitly construct signal to avoid date serialization issues
          await storage.createSignal({
            companyId: newCompanyId,
            type: signal.type,
            title: signal.title,
            content: signal.content || null,
            summary: signal.summary || null,
            sourceUrl: signal.sourceUrl || null,
            sourceName: signal.sourceName || null,
            citations: signal.citations || [],
            publishedAt: signal.publishedAt ? new Date(signal.publishedAt) : null,
            gatheredAt: signal.gatheredAt ? new Date(signal.gatheredAt) : new Date(),
            sentiment: signal.sentiment || null,
            entities: signal.entities || null,
            priority: signal.priority || "medium",
            isRead: signal.isRead || false,
            isBookmarked: signal.isBookmarked || false,
            assignedTo: signal.assignedTo || null,
            contentStatus: signal.contentStatus || "new",
            notes: signal.notes || null,
            aiAnalysis: signal.aiAnalysis || null,
            hash: signal.hash || null,
          });
          signalsImported++;
        } catch (e: any) {
          signalErrors.push(`Signal ${signal.id}: ${e.message}`);
        }
      }
      
      console.log(`[Import] Signals: ${signalsImported} imported, ${signalErrors.length} errors`);
      
      res.json({ 
        success: true, 
        companiesImported, 
        companiesSkipped,
        companyErrors: companyErrors.slice(0, 10),
        signalsImported,
        signalErrors: signalErrors.slice(0, 10),
        totalCompanies: companies.length,
        totalSignals: signals.length,
      });
    } catch (error) {
      console.error("Error importing Baking & Milling data:", error);
      res.status(500).json({ error: "Failed to import data" });
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
