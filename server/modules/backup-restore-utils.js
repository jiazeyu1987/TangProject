import { existsSync, readFileSync } from "node:fs";

export function restoreStoreBackupFromId({
  backupId,
  resolveBackupFilePath,
  normalizeStoreShape,
  nowIso,
  applyNormalizedStore,
}) {
  const backupPath = resolveBackupFilePath(backupId);
  if (!backupPath) {
    throw new Error("backupId is invalid.");
  }
  if (!existsSync(backupPath)) {
    throw new Error("Backup not found.");
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(backupPath, "utf8"));
  } catch {
    throw new Error("Backup JSON is invalid.");
  }

  const normalized = normalizeStoreShape(parsed);
  if (!Array.isArray(normalized.users) || !normalized.users.length) {
    throw new Error("Backup store has no users.");
  }
  const clearedSessionCount = Array.isArray(normalized.authSessions) ? normalized.authSessions.length : 0;
  normalized.authSessions = [];
  applyNormalizedStore(normalized);
  return {
    backupId,
    restoredAt: nowIso(),
    clearedSessionCount,
  };
}

export function restoreStoreBackupByDate({
  backupDate,
  normalizeBackupDateInput,
  listStoreBackups,
  restoreStoreBackup,
}) {
  const normalizedDate = normalizeBackupDateInput(backupDate);
  if (!normalizedDate) {
    throw new Error("backupDate is invalid.");
  }
  const targetBackup = listStoreBackups().find((item) => item.date === normalizedDate);
  if (!targetBackup) {
    throw new Error("Backup date not found.");
  }
  const restored = restoreStoreBackup(targetBackup.id);
  return {
    ...restored,
    backupDate: normalizedDate,
  };
}
