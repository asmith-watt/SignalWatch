import cron, { ScheduledTask } from "node-cron";
import { monitorAllCompanies, type CompanyMonitorResult } from "./perplexity-monitor";
import { storage } from "./storage";

const RETENTION_DAYS = 365;
let isRunning = false;
let isSyncing = false;
let scheduledMonitoringTask: ScheduledTask | null = null;
let scheduledSyncTask: ScheduledTask | null = null;

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

async function syncToProduction() {
  const productionUrl = process.env.PRODUCTION_APP_URL;
  
  if (!productionUrl) {
    console.log("[Scheduler] No PRODUCTION_APP_URL set, skipping sync");
    return;
  }
  
  if (isSyncing) {
    console.log("[Scheduler] Sync already in progress, skipping");
    return;
  }
  
  isSyncing = true;
  console.log(`[Scheduler] Starting scheduled sync to ${productionUrl}...`);
  const startTime = Date.now();
  
  try {
    // Fetch all local data
    const companies = await storage.getAllCompanies();
    const signals = await storage.getAllSignals();
    
    console.log(`[Scheduler] Syncing ${companies.length} companies and ${signals.length} signals...`);
    
    // Push to production
    const response = await fetch(`${productionUrl}/api/import/all-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companies, signals }),
      mode: "cors",
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Production sync failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[Scheduler] Sync complete in ${duration}s:`);
    console.log(`  - Companies: ${result.companiesImported || 0} new, ${result.companiesUpdated || 0} updated`);
    console.log(`  - Signals: ${result.signalsImported || 0} new, ${result.signalsUpdated || 0} updated`);
    
    // Log the sync activity
    await storage.createActivityLog({
      userId: null,
      action: "scheduled_sync",
      entityType: "system",
      entityId: null,
      details: {
        productionUrl,
        companiesImported: result.companiesImported || 0,
        companiesUpdated: result.companiesUpdated || 0,
        signalsImported: result.signalsImported || 0,
        signalsUpdated: result.signalsUpdated || 0,
        durationSeconds: duration,
      }
    });
    
  } catch (error) {
    console.error("[Scheduler] Sync to production failed:", error);
    
    await storage.createActivityLog({
      userId: null,
      action: "scheduled_sync_failed",
      entityType: "system",
      entityId: null,
      details: {
        productionUrl,
        error: error instanceof Error ? error.message : String(error),
      }
    });
  } finally {
    isSyncing = false;
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
  const enableSyncScheduler = process.env.ENABLE_SYNC_SCHEDULER === "true";
  const monitorCron = process.env.MONITOR_CRON || "0 6 * * *";
  const syncCron = process.env.SYNC_CRON || "0 7 * * *"; // Default: 1 hour after monitoring
  
  if (!enableScheduler && !enableSyncScheduler) {
    console.log("[Scheduler] All schedulers disabled (set ENABLE_SCHEDULER=true or ENABLE_SYNC_SCHEDULER=true)");
    return;
  }
  
  console.log("[Scheduler] Initializing scheduled tasks...");
  
  // Monitoring scheduler
  if (enableScheduler) {
    if (!cron.validate(monitorCron)) {
      console.error(`[Scheduler] Invalid monitoring cron expression: ${monitorCron}`);
    } else {
      scheduledMonitoringTask = cron.schedule(monitorCron, async () => {
        console.log("[Scheduler] Running scheduled monitoring...");
        await runDailyMonitoring();
      }, {
        timezone: "UTC"
      });
      console.log(`  - Monitoring: ${monitorCron} (UTC)`);
    }
  }
  
  // Sync scheduler (dev → production)
  if (enableSyncScheduler) {
    if (!cron.validate(syncCron)) {
      console.error(`[Scheduler] Invalid sync cron expression: ${syncCron}`);
    } else {
      const productionUrl = process.env.PRODUCTION_APP_URL;
      if (!productionUrl) {
        console.log("  - Sync: DISABLED (no PRODUCTION_APP_URL set)");
      } else {
        scheduledSyncTask = cron.schedule(syncCron, async () => {
          console.log("[Scheduler] Running scheduled production sync...");
          await syncToProduction();
        }, {
          timezone: "UTC"
        });
        console.log(`  - Sync to production: ${syncCron} (UTC) → ${productionUrl}`);
      }
    }
  }
  
  console.log("  - Signal retention: Forever (no automatic cleanup)");
}

export function stopScheduler() {
  if (scheduledMonitoringTask) {
    scheduledMonitoringTask.stop();
    scheduledMonitoringTask = null;
  }
  if (scheduledSyncTask) {
    scheduledSyncTask.stop();
    scheduledSyncTask = null;
  }
  console.log("[Scheduler] All scheduled tasks stopped");
}

export function isSchedulerEnabled(): boolean {
  return process.env.ENABLE_SCHEDULER === "true";
}

export function isSyncSchedulerEnabled(): boolean {
  return process.env.ENABLE_SYNC_SCHEDULER === "true";
}

export function isMonitoringInProgress(): boolean {
  return isRunning;
}

export function isSyncInProgress(): boolean {
  return isSyncing;
}

export { runDailyMonitoring, cleanupOldSignals, syncToProduction };
