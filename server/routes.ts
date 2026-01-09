import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCompanySchema,
  insertSignalSchema,
  insertAlertSchema,
} from "@shared/schema";
import { z } from "zod";
import { analyzeSignal, enrichSignal, batchEnrichSignals, extractRelationshipsFromSignal, batchExtractThemes, generateTrendExplanation, THEME_TAXONOMY } from "./ai-analysis";
import { generateArticleFromSignal, exportArticleForCMS } from "./article-generator";
import { generateArticleWithClaude, type ClaudeModel } from "./claude-article-generator";
import { monitorPoultryCompanies, monitorAllCompanies, monitorCompany, monitorUSPoultryCompanies, monitorCompaniesByCountry, monitorCompaniesByIndustry, enrichCompanies } from "./perplexity-monitor";
import { getProgress } from "./monitor-progress";
import { importCompanies, getUSPoultryCompanies } from "./import-companies";
import { importFeedCompanies } from "./import-feed-companies";
import { importPetfoodCompanies } from "./import-petfood-companies";
import { importBakingMillingCompanies } from "./import-baking-milling-companies";
import { importBakingMillingSignals } from "./import-signals-by-company-name";
import { importIPPEExhibitors } from "./import-ippe";
import { generateRssFeed, generateAllSignalsRssFeed, getAvailableFeeds } from "./rss-feeds";
import { publishToWordPress, testWordPressConnection } from "./wordpress-publisher";
import { selectStockImage, buildMediaSitePayload, buildPayloadFromExistingArticle, publishToMediaSite, generateAIImage } from "./media-site-publisher";
import { verifySignalDates, fixSignalDates, verifySourceUrl, verifySourceUrls } from "./date-verifier";
import { discoverDomainSources, discoverWebSources } from "./source-discovery";
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

  // Get date quality stats - must come before :id route
  app.get("/api/signals/date-stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDateQualityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching date stats:", error);
      res.status(500).json({ error: "Failed to fetch date stats" });
    }
  });

  // Get signals that need date review - must come before :id route
  app.get("/api/signals/needs-date-review", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const signals = await storage.getSignalsNeedingDateReview(limit);
      res.json(signals);
    } catch (error) {
      console.error("Error fetching signals needing date review:", error);
      res.status(500).json({ error: "Failed to fetch signals needing date review" });
    }
  });

  app.get("/api/signals/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid signal ID" });
      }
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

  // Backfill themes on existing signals
  app.post("/api/signals/backfill-themes", async (req: Request, res: Response) => {
    try {
      const { limit = 50, force = false } = req.body;
      
      const allSignals = await storage.getAllSignals();
      const companies = await storage.getAllCompanies();
      const companyMap = new Map(companies.map(c => [c.id, c]));
      
      // Filter signals that need themes
      const signalsNeedingThemes = force 
        ? allSignals.slice(0, limit)
        : allSignals.filter(s => !s.themes || s.themes.length === 0).slice(0, limit);
      
      if (signalsNeedingThemes.length === 0) {
        return res.json({
          success: true,
          processed: 0,
          message: "All signals already have themes"
        });
      }
      
      console.log(`Starting theme extraction for ${signalsNeedingThemes.length} signals...`);
      
      // Prepare signals with company info
      const signalsWithCompanyInfo = signalsNeedingThemes.map(signal => {
        const company = companyMap.get(signal.companyId);
        return {
          id: signal.id,
          title: signal.title,
          content: signal.content,
          summary: signal.summary,
          type: signal.type,
          companyName: company?.name,
          industry: company?.industry || undefined,
        };
      });
      
      // Batch extract themes
      const themeResults = await batchExtractThemes(signalsWithCompanyInfo);
      
      // Update signals with themes
      let updated = 0;
      let failed = 0;
      
      for (const [signalId, result] of Array.from(themeResults.entries())) {
        try {
          await storage.updateSignal(signalId, {
            themes: result.themes,
            themesVersion: 1,
          });
          updated++;
          console.log(`  Updated themes for signal ${signalId}: ${result.themes.join(", ")}`);
        } catch (err) {
          console.error(`  Failed to update signal ${signalId}:`, err);
          failed++;
        }
      }
      
      const remaining = allSignals.filter(s => !s.themes || s.themes.length === 0).length - updated;
      
      res.json({
        success: true,
        processed: updated,
        failed,
        remaining: Math.max(0, remaining),
        message: `Extracted themes for ${updated} signals (${failed} failed, ${remaining} remaining)`
      });
    } catch (error) {
      console.error("Error backfilling themes:", error);
      res.status(500).json({ error: "Failed to backfill themes" });
    }
  });

  // Get theme backfill progress
  app.get("/api/signals/theme-stats", async (req: Request, res: Response) => {
    try {
      const allSignals = await storage.getAllSignals();
      const withThemes = allSignals.filter(s => s.themes && s.themes.length > 0);
      const withoutThemes = allSignals.filter(s => !s.themes || s.themes.length === 0);
      
      // Count theme occurrences
      const themeCounts: Record<string, number> = {};
      for (const signal of withThemes) {
        for (const theme of signal.themes || []) {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        }
      }
      
      res.json({
        total: allSignals.length,
        withThemes: withThemes.length,
        withoutThemes: withoutThemes.length,
        percentComplete: Math.round((withThemes.length / allSignals.length) * 100),
        themeCounts,
        taxonomy: THEME_TAXONOMY,
      });
    } catch (error) {
      console.error("Error getting theme stats:", error);
      res.status(500).json({ error: "Failed to get theme stats" });
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

  // Media Site Publishing - Push to external media site (IDEMPOTENT)
  app.post("/api/signals/:id/publish-to-media", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { style = "news", forceRegenerate = false } = req.body;

      const signal = await storage.getSignal(id);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }

      const company = await storage.getCompany(signal.companyId) || null;
      
      // Check if article already exists for this signal+style
      const existingArticle = await storage.getArticleBySignalAndStyle(id, "media_site", style);
      
      // Use production URL if available, otherwise fall back to current domain
      const productionAppUrl = process.env.PRODUCTION_APP_URL;
      const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers.host || "localhost:5000";
      const baseUrl = productionAppUrl || (replitDomain ? `https://${replitDomain}` : `${protocol}://${host}`);

      let payload;
      let article;
      let imageUrl: string;
      let regenerated = false;
      
      if (existingArticle && !forceRegenerate) {
        // REUSE existing article content - no regeneration
        // If existing article has no image, generate one now
        if (!existingArticle.imageUrl) {
          const aiImage = await generateAIImage(signal, company, baseUrl);
          if (!aiImage) {
            return res.status(500).json({ error: "Failed to generate AI image" });
          }
          imageUrl = aiImage.imageUrl;
        } else {
          imageUrl = existingArticle.imageUrl;
        }
        
        payload = buildPayloadFromExistingArticle(existingArticle, signal, company, style);
        payload.imageUrl = imageUrl; // Ensure payload has valid image
        
        article = {
          headline: existingArticle.headline,
          subheadline: existingArticle.subheadline || "",
          body: existingArticle.body,
          keyTakeaways: (existingArticle.keyTakeaways as string[]) || [],
          seoDescription: existingArticle.seoDescription || "",
          suggestedTags: (existingArticle.tags as string[]) || [],
        };
        console.log(`Reusing existing article for signal ${id} style ${style}`);
      } else {
        // GENERATE new article content
        regenerated = true;
        article = await generateArticleFromSignal(signal, company, style);
        
        // Generate AI image
        const aiImage = await generateAIImage(signal, company, baseUrl);
        if (!aiImage) {
          return res.status(500).json({ error: "Failed to generate AI image" });
        }
        imageUrl = aiImage.imageUrl;
        const imageCredit = aiImage.credit;
        
        payload = buildMediaSitePayload(article, signal, company, imageUrl, style, imageCredit);
        console.log(`Generated new article for signal ${id} style ${style}${forceRegenerate ? " (forced)" : ""}`);
      }

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
        
        // Use sanitized tags from payload (already processed by sanitizeTags)
        const articleData = {
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
          keyTakeaways: article.keyTakeaways || [],
          seoDescription: article.seoDescription || "",
          tags: payload.tags, // Use sanitized tags from payload
        };
        
        if (existingArticle) {
          // UPDATE existing article row
          await storage.updateArticle(existingArticle.id, articleData);
        } else {
          // INSERT new article row
          await storage.createArticle(articleData);
        }
      }

      res.json({
        ...result,
        regenerated,
        reusedExisting: !regenerated,
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
  app.get("/api/articles", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const articles = await storage.getAllArticles(limit);
      res.json(articles);
    } catch (error) {
      console.error("Error getting all articles:", error);
      res.status(500).json({ error: "Failed to get articles" });
    }
  });

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

  // Signal Graph endpoints
  app.get("/api/signals/:id/related", async (req: Request, res: Response) => {
    try {
      const signalId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 10;
      const days = parseInt(req.query.days as string) || 30;
      
      const signal = await storage.getSignal(signalId);
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }
      
      const relatedSignals = await storage.getRelatedSignals(signalId, limit, days);
      res.json(relatedSignals);
    } catch (error) {
      console.error("Error fetching related signals:", error);
      res.status(500).json({ error: "Failed to fetch related signals" });
    }
  });

  app.post("/api/admin/graph/backfill", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers["x-admin-token"];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const startAfterId = parseInt(req.query.startAfterId as string) || 0;
      const limit = parseInt(req.query.limit as string) || 200;
      
      const result = await storage.backfillSignalEntities(startAfterId, limit);
      res.json(result);
    } catch (error) {
      console.error("Error backfilling signal entities:", error);
      res.status(500).json({ error: "Failed to backfill signal entities" });
    }
  });

  // Trends API endpoints
  app.get("/api/trends", async (req: Request, res: Response) => {
    try {
      const scopeType = req.query.scopeType as string | undefined;
      const timeWindow = req.query.timeWindow as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const trends = await storage.getTrends(scopeType, timeWindow, limit);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  app.get("/api/metrics", async (req: Request, res: Response) => {
    try {
      const scopeType = req.query.scopeType as string | undefined;
      const scopeId = req.query.scopeId as string | undefined;
      const period = req.query.period as string | undefined;
      
      const metrics = await storage.getSignalMetrics(scopeType, scopeId, period);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.post("/api/admin/trends/generate", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers["x-admin-token"];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { generateTrends } = await import("./trend-engine");
      const result = await generateTrends();
      res.json(result);
    } catch (error) {
      console.error("Error generating trends:", error);
      res.status(500).json({ error: "Failed to generate trends" });
    }
  });

  app.post("/api/admin/metrics/capture", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers["x-admin-token"];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { captureSignalMetrics } = await import("./trend-engine");
      const result = await captureSignalMetrics();
      res.json(result);
    } catch (error) {
      console.error("Error capturing metrics:", error);
      res.status(500).json({ error: "Failed to capture metrics" });
    }
  });

  // Endpoint to backfill/fix signal dates (accessible from Data Management UI)
  app.post("/api/admin/dates/backfill", async (req: Request, res: Response) => {
    try {
      // Allow access if ADMIN_TOKEN is set and matches, or if no ADMIN_TOKEN is configured
      const adminToken = req.headers["x-admin-token"];
      if (process.env.ADMIN_TOKEN && adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { backfillSignalDates } = await import("./date-verifier");
      const { companyId, limit = 100, onlySuspicious = false } = req.body;
      
      const result = await backfillSignalDates({
        companyId: companyId ? parseInt(companyId) : undefined,
        limit: parseInt(limit),
        onlySuspicious,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error backfilling dates:", error);
      res.status(500).json({ error: "Failed to backfill dates" });
    }
  });

  // ============================================
  // Ingestion Admin Endpoints (PR3)
  // ============================================

  // POST /api/admin/ingest/rss/run - Trigger RSS ingestion
  app.post("/api/admin/ingest/rss/run", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers["x-admin-token"];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { runRSSIngestion } = await import("./rss-ingestion");
      const result = await runRSSIngestion();
      res.json(result);
    } catch (error) {
      console.error("Error running RSS ingestion:", error);
      res.status(500).json({ error: "Failed to run RSS ingestion" });
    }
  });

  // POST /api/admin/ingest/feedly/run - Trigger Feedly ingestion
  app.post("/api/admin/ingest/feedly/run", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers["x-admin-token"];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { runFeedlyIngestion } = await import("./feedly-ingestion");
      const result = await runFeedlyIngestion();
      res.json(result);
    } catch (error) {
      console.error("Error running Feedly ingestion:", error);
      res.status(500).json({ error: "Failed to run Feedly ingestion" });
    }
  });

  // POST /api/admin/signals/migrate-llm - Migrate legacy Perplexity signals
  app.post("/api/admin/signals/migrate-llm", async (req: Request, res: Response) => {
    try {
      const adminToken = req.headers["x-admin-token"];
      if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const allSignals = await storage.getAllSignals();
      let migratedCount = 0;
      let alreadyMigratedCount = 0;
      
      for (const signal of allSignals) {
        if (signal.ingestionSourceType === "llm_discovery" && signal.providerName === "perplexity") {
          alreadyMigratedCount++;
          continue;
        }
        
        if (!signal.ingestionSourceType || signal.ingestionSourceType === "llm_discovery") {
          const isVerified = signal.dateConfidence && signal.dateConfidence >= 70 && signal.publishedAt;
          
          await storage.updateSignal(signal.id, {
            ingestionSourceType: "llm_discovery",
            verificationStatus: isVerified ? "verified" : "unverified",
            providerName: signal.providerName || "perplexity",
          });
          migratedCount++;
        }
      }
      
      res.json({
        message: "Migration complete",
        migratedCount,
        alreadyMigratedCount,
        totalSignals: allSignals.length,
      });
    } catch (error) {
      console.error("Error migrating LLM signals:", error);
      res.status(500).json({ error: "Failed to migrate LLM signals" });
    }
  });

  // POST /api/signals/:id/attempt-verify - Attempt to verify a signal
  app.post("/api/signals/:id/attempt-verify", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const signal = await storage.getSignal(id);
      
      if (!signal) {
        return res.status(404).json({ error: "Signal not found" });
      }
      
      if (signal.verificationStatus === "verified") {
        return res.json({ status: "already_verified", signal });
      }
      
      if (signal.canonicalUrl) {
        const allSignals = await storage.getAllSignals();
        const verifiedMatch = allSignals.find(s => 
          s.id !== signal.id &&
          s.canonicalUrl === signal.canonicalUrl &&
          s.verificationStatus === "verified"
        );
        
        if (verifiedMatch) {
          const updated = await storage.updateSignal(id, {
            verificationStatus: "verified",
            verificationMethod: "url_match",
            publishedAt: verifiedMatch.publishedAt,
            dateSource: verifiedMatch.dateSource,
            dateConfidence: verifiedMatch.dateConfidence,
          });
          return res.json({ status: "verified_by_url_match", signal: updated });
        }
      }
      
      if (signal.sourceUrl) {
        const { extractVerifiedDate } = await import("./date-verifier");
        const dateResult = await extractVerifiedDate(signal.sourceUrl);
        
        if (dateResult && dateResult.confidence >= 70) {
          const updated = await storage.updateSignal(id, {
            verificationStatus: "verified",
            verificationMethod: "metadata",
            publishedAt: dateResult.date,
            dateSource: dateResult.source,
            dateConfidence: dateResult.confidence,
          });
          return res.json({ status: "verified_by_metadata", signal: updated });
        }
      }
      
      res.json({ status: "unable_to_verify", signal });
    } catch (error) {
      console.error("Error attempting signal verification:", error);
      res.status(500).json({ error: "Failed to attempt verification" });
    }
  });

  // GET /api/ingest/runs - List recent ingestion runs
  app.get("/api/ingest/runs", async (req: Request, res: Response) => {
    try {
      const runs = await storage.getIngestionRuns();
      res.json(runs);
    } catch (error) {
      console.error("Error fetching ingestion runs:", error);
      res.status(500).json({ error: "Failed to fetch ingestion runs" });
    }
  });

  // ============================================
  // Sources API Routes (PR1)
  // ============================================

  // GET /api/sources - List all sources with optional filters
  app.get("/api/sources", async (req: Request, res: Response) => {
    try {
      const { market, companyId, type, status } = req.query;
      const filters = {
        market: market as string | undefined,
        companyId: companyId ? parseInt(companyId as string) : undefined,
        type: type as string | undefined,
        status: status as string | undefined,
      };
      const sources = await storage.getAllSources(filters);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  // POST /api/sources - Create a new source
  app.post("/api/sources", async (req: Request, res: Response) => {
    try {
      const { name, sourceType, url, domain, trustScore } = req.body;
      
      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const validSourceTypes = ['rss', 'feedly', 'crawl', 'regulator', 'association', 'llm'];
      if (!sourceType || !validSourceTypes.includes(sourceType)) {
        return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${validSourceTypes.join(', ')}` });
      }
      
      // Validate trustScore if provided
      const validatedTrustScore = trustScore !== undefined 
        ? Math.max(0, Math.min(100, parseInt(trustScore) || 50))
        : 50;
      
      const source = await storage.createSource({
        name: name.trim(),
        sourceType,
        url: url || null,
        domain: domain || null,
        trustScore: validatedTrustScore,
      });
      res.status(201).json(source);
    } catch (error) {
      console.error("Error creating source:", error);
      res.status(500).json({ error: "Failed to create source" });
    }
  });

  // PATCH /api/sources/:id - Update a source
  app.patch("/api/sources/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { name, sourceType, url, domain, trustScore, verificationStatus, isActive } = req.body;
      
      // Validate fields if provided
      const validSourceTypes = ['rss', 'feedly', 'crawl', 'regulator', 'association', 'llm'];
      const validStatuses = ['verified', 'needs_review', 'broken'];
      
      if (sourceType && !validSourceTypes.includes(sourceType)) {
        return res.status(400).json({ error: `Invalid sourceType. Must be one of: ${validSourceTypes.join(', ')}` });
      }
      
      if (verificationStatus && !validStatuses.includes(verificationStatus)) {
        return res.status(400).json({ error: `Invalid verificationStatus. Must be one of: ${validStatuses.join(', ')}` });
      }
      
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.trim();
      if (sourceType !== undefined) updates.sourceType = sourceType;
      if (url !== undefined) updates.url = url;
      if (domain !== undefined) updates.domain = domain;
      if (trustScore !== undefined) updates.trustScore = Math.max(0, Math.min(100, parseInt(trustScore) || 50));
      if (verificationStatus !== undefined) updates.verificationStatus = verificationStatus;
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      
      const source = await storage.updateSource(id, updates);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error) {
      console.error("Error updating source:", error);
      res.status(500).json({ error: "Failed to update source" });
    }
  });

  // POST /api/sources/:id/verify - Mark source as verified
  app.post("/api/sources/:id/verify", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { verificationMethod } = req.body;
      
      // Check if source exists and is active
      const existingSource = await storage.getSource(id);
      if (!existingSource) {
        return res.status(404).json({ error: "Source not found" });
      }
      
      if (!existingSource.isActive) {
        return res.status(400).json({ error: "Cannot verify inactive source" });
      }
      
      const source = await storage.updateSource(id, {
        verificationStatus: "verified",
        lastVerifiedAt: new Date(),
      });
      
      res.json(source);
    } catch (error) {
      console.error("Error verifying source:", error);
      res.status(500).json({ error: "Failed to verify source" });
    }
  });

  // DELETE /api/sources/:id - Delete a source
  app.delete("/api/sources/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSource(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting source:", error);
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  // POST /api/sources/:id/run - Run ingestion for a specific source
  app.post("/api/sources/:id/run", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const source = await storage.getSource(id);
      
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      
      if (!source.isActive) {
        return res.status(400).json({ error: "Cannot run ingestion on inactive source" });
      }
      
      let result: { itemsFound: number; itemsCreated: number };
      
      if (source.sourceType === "rss") {
        const { ingestSingleRSSSource } = await import("./rss-ingestion");
        result = await ingestSingleRSSSource(id);
      } else if (source.sourceType === "feedly") {
        return res.status(400).json({ error: "Feedly sources are ingested through the Feedly API, not individually" });
      } else {
        return res.status(400).json({ error: `Ingestion not supported for source type: ${source.sourceType}` });
      }
      
      // Update last ingested timestamp
      await storage.updateSource(id, { lastIngestedAt: new Date() });
      
      res.json({
        success: true,
        itemsFound: result.itemsFound,
        itemsCreated: result.itemsCreated,
        message: result.itemsCreated > 0 
          ? `Created ${result.itemsCreated} new signals from ${result.itemsFound} items`
          : `Checked ${result.itemsFound} items, all already collected`
      });
    } catch (error) {
      console.error("Error running source ingestion:", error);
      res.status(500).json({ error: "Failed to run ingestion" });
    }
  });

  // POST /api/sources/discover/domain - Discover sources from a domain
  app.post("/api/sources/discover/domain", async (req: Request, res: Response) => {
    try {
      const { domain, companyId, market } = req.body;
      
      let targetDomain = domain;
      let companyName: string | undefined;
      
      if (!targetDomain && companyId) {
        const company = await storage.getCompany(companyId);
        if (company) {
          companyName = company.name;
          if (company.website) {
            targetDomain = company.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
          }
        }
      }
      
      if (!targetDomain) {
        return res.status(400).json({ error: "Please provide a domain or select a company with a website" });
      }
      
      const sources = await discoverDomainSources(targetDomain, companyName);
      
      res.json({ 
        sources, 
        message: sources.length > 0 
          ? `Found ${sources.length} sources from ${targetDomain}` 
          : `No RSS feeds or news pages found on ${targetDomain}`
      });
    } catch (error) {
      console.error("Error discovering domain sources:", error);
      res.status(500).json({ error: "Failed to discover sources" });
    }
  });

  // POST /api/sources/discover/web - Discover sources from web search
  app.post("/api/sources/discover/web", async (req: Request, res: Response) => {
    try {
      const { market, keywords } = req.body;
      
      if (!market || !keywords) {
        return res.status(400).json({ error: "Market and keywords are required" });
      }
      
      const sources = await discoverWebSources(market, keywords);
      
      res.json({ 
        sources, 
        message: sources.length > 0 
          ? `Found ${sources.length} sources for ${market}` 
          : `No sources found for ${market} - try different keywords`
      });
    } catch (error) {
      console.error("Error discovering web sources:", error);
      res.status(500).json({ error: "Failed to discover sources" });
    }
  });

  // GET /api/ingest/runs - List ingestion runs
  app.get("/api/ingest/runs", async (req: Request, res: Response) => {
    try {
      const { limit, sourceId } = req.query;
      const runs = await storage.getIngestionRuns(
        limit ? parseInt(limit as string) : 50,
        sourceId ? parseInt(sourceId as string) : undefined
      );
      res.json(runs);
    } catch (error) {
      console.error("Error fetching ingestion runs:", error);
      res.status(500).json({ error: "Failed to fetch ingestion runs" });
    }
  });

  // ============================================
  // End Sources API Routes
  // ============================================

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

  app.post("/api/companies/import-ippe", async (req: Request, res: Response) => {
    try {
      console.log("Starting IPPE Exhibitors import...");
      const result = await importIPPEExhibitors();
      res.json({ 
        success: true, 
        message: `Import complete. Added ${result.imported} IPPE exhibitor companies, skipped ${result.skipped}.`,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.slice(0, 10)
      });
    } catch (error) {
      console.error("Error importing IPPE exhibitors:", error);
      res.status(500).json({ error: "Failed to import IPPE exhibitors" });
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

  // CORS preflight for import endpoint (to allow dev→prod sync)
  app.options("/api/import/all-data", (req: Request, res: Response) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");
    res.header("Vary", "Origin");
    res.sendStatus(204);
  });

  // Import ALL data from JSON export (for production sync)
  app.post("/api/import/all-data", async (req: Request, res: Response) => {
    // Allow cross-origin requests for dev→prod sync
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");

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
