import cron from "node-cron";
import { monitorAllCompanies } from "./perplexity-monitor";
import { storage } from "./storage";

const RETENTION_DAYS = 365;

async function cleanupOldSignals() {
  console.log("[Scheduler] Starting signal cleanup...");
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  try {
    const allSignals = await storage.getAllSignals();
    const oldSignals = allSignals.filter(s => {
      const signalDate = s.publishedAt || s.createdAt;
      return new Date(signalDate) < cutoffDate;
    });
    
    let deleted = 0;
    for (const signal of oldSignals) {
      await storage.deleteSignal(signal.id);
      deleted++;
    }
    
    console.log(`[Scheduler] Cleaned up ${deleted} signals older than ${RETENTION_DAYS} days`);
  } catch (error) {
    console.error("[Scheduler] Error cleaning up signals:", error);
  }
}

async function runDailyMonitoring() {
  console.log("[Scheduler] Starting daily monitoring run...");
  const startTime = Date.now();
  
  try {
    const results = await monitorAllCompanies();
    const duration = Math.round((Date.now() - startTime) / 1000);
    const signalsFound = results.reduce((sum, r) => sum + r.signalsCreated, 0);
    
    console.log(`[Scheduler] Daily monitoring complete in ${duration}s. Found ${signalsFound} new signals.`);
    
    await storage.createActivityLog({
      userId: null,
      action: "scheduled_monitoring",
      entityType: "system",
      entityId: null,
      details: { 
        companiesProcessed: results.length, 
        signalsFound,
        durationSeconds: duration
      }
    });
  } catch (error) {
    console.error("[Scheduler] Error in daily monitoring:", error);
  }
}

export function initializeScheduler() {
  console.log("[Scheduler] Initializing scheduled tasks...");
  
  cron.schedule("0 6 * * *", async () => {
    console.log("[Scheduler] Running daily monitoring at 6 AM UTC...");
    await runDailyMonitoring();
  });
  
  cron.schedule("0 3 * * 0", async () => {
    console.log("[Scheduler] Running weekly signal cleanup...");
    await cleanupOldSignals();
  });
  
  console.log("[Scheduler] Scheduled tasks initialized:");
  console.log("  - Daily monitoring: 6:00 AM UTC");
  console.log("  - Weekly cleanup: Sundays at 3:00 AM UTC");
  console.log(`  - Signal retention: ${RETENTION_DAYS} days`);
}

export { runDailyMonitoring, cleanupOldSignals };
