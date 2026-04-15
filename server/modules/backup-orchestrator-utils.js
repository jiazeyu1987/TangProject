export function buildBackupPayload({
  listStoreBackups,
  nowIso,
  policy,
  schedulerState,
  uniqueStrings,
}) {
  const backups = listStoreBackups();
  return {
    ok: true,
    generatedAt: nowIso(),
    policy,
    scheduler: {
      running: schedulerState.running,
      lastRunAt: schedulerState.lastRunAt || null,
      nextRunAt: schedulerState.nextRunAt || null,
    },
    availableDates: uniqueStrings(backups.map((item) => item.date)),
    backups,
  };
}

export function initializeBackupSystem({
  backupDir,
  mkdirSync,
  pruneBackups,
  getBackupMaxCount,
  scheduleNextBackupRun,
  nowDate = () => new Date(),
}) {
  mkdirSync(backupDir, { recursive: true });
  pruneBackups(getBackupMaxCount());
  scheduleNextBackupRun(nowDate());
}

export function scheduleNextBackupRun({
  referenceDate,
  resolveNextBackupRunAt,
  getBackupSchedule,
  schedulerState,
  runScheduledBackup,
  nowMs = () => Date.now(),
  minDelayMs = 1000,
}) {
  const nextRunAt = resolveNextBackupRunAt(referenceDate, getBackupSchedule());
  schedulerState.nextRunAt = nextRunAt.toISOString();
  if (schedulerState.timer) {
    clearTimeout(schedulerState.timer);
  }
  const delayMs = Math.max(minDelayMs, nextRunAt.getTime() - nowMs());
  schedulerState.timer = setTimeout(() => {
    runScheduledBackup();
  }, delayMs);
  return nextRunAt;
}

export function runScheduledBackup({
  schedulerState,
  createStoreBackup,
  pruneBackups,
  getBackupMaxCount,
  nowIso,
  scheduleNextBackupRun,
  nowMs = () => Date.now(),
  logError = null,
}) {
  schedulerState.running = true;
  try {
    createStoreBackup("auto");
    pruneBackups(getBackupMaxCount());
    schedulerState.lastRunAt = nowIso();
  } catch (error) {
    if (typeof logError === "function") {
      logError(error);
    }
  } finally {
    schedulerState.running = false;
    scheduleNextBackupRun(new Date(nowMs() + 1000));
  }
}
