import cron, { ScheduledTask } from "node-cron";
import { monitorAllCompanies, type CompanyMonitorResult } from "./perplexity-monitor";
import { storage } from "./storage";

const RETENTION_DAYS = 365;
let isRunning = false;
let scheduledMonitoringTask: ScheduledTask | null = null;

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
  if (isRunning) {
    console.log("[Scheduler] Monitoring already in progress, skipping scheduled run");
    return;
  }
  
  const activeRun = await storage.getActiveMonitorRun();
  if (activeRun) {
    console.log(`[Scheduler] Monitor run #${activeRun.id} already active, skipping scheduled run`);
    return;
  }
  
  isRunning = true;
  
  const run = await storage.createMonitorRun({
    scope: "all",
    status: "running",
  });
  
  console.log(`[Scheduler] Starting daily monitoring run #${run.id}...`);
  const startTime = Date.now();
  
  try {
    const results = await monitorAllCompanies();
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    const totals = results.reduce((acc, r) => ({
      signalsCreated: acc.signalsCreated + r.signalsCreated,
      signalsFound: acc.signalsFound + (r.signalsFound || 0),
      duplicatesSkipped: acc.duplicatesSkipped + (r.duplicatesSkipped || 0),
      nearDuplicatesSkipped: acc.nearDuplicatesSkipped + (r.nearDuplicatesSkipped || 0),
    }), { signalsCreated: 0, signalsFound: 0, duplicatesSkipped: 0, nearDuplicatesSkipped: 0 });
    
    await storage.updateMonitorRun(run.id, {
      finishedAt: new Date(),
      signalsFound: totals.signalsFound,
      signalsCreated: totals.signalsCreated,
      duplicatesSkipped: totals.duplicatesSkipped,
      nearDuplicatesSkipped: totals.nearDuplicatesSkipped,
      status: "success",
    });
    
    console.log(`[Scheduler] Daily monitoring run #${run.id} complete in ${duration}s.`);
    console.log(`  - Signals found: ${totals.signalsFound}`);
    console.log(`  - Signals created: ${totals.signalsCreated}`);
    console.log(`  - Exact duplicates skipped: ${totals.duplicatesSkipped}`);
    console.log(`  - Near duplicates skipped: ${totals.nearDuplicatesSkipped}`);
    
    await storage.createActivityLog({
      userId: null,
      action: "scheduled_monitoring",
      entityType: "system",
      entityId: run.id,
      details: { 
        runId: run.id,
        companiesProcessed: results.length, 
        ...totals,
        durationSeconds: duration
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await storage.updateMonitorRun(run.id, {
      finishedAt: new Date(),
      status: "error",
      error: errorMessage,
    });
    
    console.error(`[Scheduler] Daily monitoring run #${run.id} failed:`, error);
  } finally {
    isRunning = false;
  }
}

export function initializeScheduler() {
  const enableScheduler = process.env.ENABLE_SCHEDULER === "true";
  const cronExpression = process.env.MONITOR_CRON || "0 6 * * *";
  
  if (!enableScheduler) {
    console.log("[Scheduler] Scheduler is disabled (set ENABLE_SCHEDULER=true to enable)");
    return;
  }
  
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
    return;
  }
  
  console.log(`[Scheduler] Initializing with cron: ${cronExpression}`);
  
  scheduledMonitoringTask = cron.schedule(cronExpression, async () => {
    console.log("[Scheduler] Running scheduled monitoring...");
    await runDailyMonitoring();
  }, {
    timezone: "UTC"
  });
  
  console.log("[Scheduler] Scheduled tasks initialized:");
  console.log(`  - Monitoring: ${cronExpression} (UTC)`);
  console.log("  - Signal retention: Forever (no automatic cleanup)");
}

export function stopScheduler() {
  if (scheduledMonitoringTask) {
    scheduledMonitoringTask.stop();
    scheduledMonitoringTask = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

export function isSchedulerEnabled(): boolean {
  return process.env.ENABLE_SCHEDULER === "true";
}

export function isMonitoringInProgress(): boolean {
  return isRunning;
}

export { runDailyMonitoring, cleanupOldSignals };
