import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export function resolveBackupTrigger(fileName) {
  const match = String(fileName || "").match(/-(auto|manual)\.json$/);
  return match ? match[1] : "manual";
}

export function resolveBackupFilePath({
  backupId,
  backupDir,
  backupFilePrefix,
  backupFileSuffix,
  asString,
}) {
  const normalizeText = typeof asString === "function" ? asString : (value) => String(value ?? "");
  const normalized = normalizeText(backupId);
  if (!normalized || normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    return "";
  }
  if (!normalized.startsWith(backupFilePrefix) || !normalized.endsWith(backupFileSuffix)) {
    return "";
  }
  return path.join(backupDir, normalized);
}

export function buildBackupItem({ fileName, stat }) {
  const createdAt = new Date(stat.mtimeMs).toISOString();
  return {
    id: fileName,
    fileName,
    trigger: resolveBackupTrigger(fileName),
    createdAt,
    date: createdAt.slice(0, 10),
    sizeBytes: Number(stat.size) || 0,
  };
}

export function listBackupFileNames({ backupDir, backupFilePrefix, backupFileSuffix }) {
  if (!existsSync(backupDir)) {
    return [];
  }
  return readdirSync(backupDir).filter(
    (fileName) => fileName.startsWith(backupFilePrefix) && fileName.endsWith(backupFileSuffix),
  );
}

export function listStoreBackups({ backupDir, backupFilePrefix, backupFileSuffix, compareIsoDesc }) {
  mkdirSync(backupDir, { recursive: true });
  return listBackupFileNames({ backupDir, backupFilePrefix, backupFileSuffix })
    .map((fileName) => {
      const fullPath = path.join(backupDir, fileName);
      try {
        const stat = statSync(fullPath);
        return buildBackupItem({ fileName, stat });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
}

export function pruneBackups({
  maxCount,
  getBackupMaxCount,
  backupDir,
  backupFilePrefix,
  backupFileSuffix,
  compareIsoDesc,
}) {
  const limit = Number(maxCount) > 0 ? Number(maxCount) : getBackupMaxCount();
  const backups = listStoreBackups({
    backupDir,
    backupFilePrefix,
    backupFileSuffix,
    compareIsoDesc,
  });
  if (backups.length <= limit) {
    return backups;
  }
  const overflowItems = backups.slice(limit);
  for (const item of overflowItems) {
    unlinkSync(path.join(backupDir, item.fileName));
  }
  return listStoreBackups({
    backupDir,
    backupFilePrefix,
    backupFileSuffix,
    compareIsoDesc,
  });
}

export function createStoreBackup({
  trigger,
  backupDir,
  backupFilePrefix,
  backupFileSuffix,
  storeSnapshot,
  createId,
  nowIso,
  asString,
}) {
  const normalizeText = typeof asString === "function" ? asString : (value) => String(value ?? "");
  const normalizedTrigger = normalizeText(trigger).toLowerCase();
  if (!normalizedTrigger || (normalizedTrigger !== "auto" && normalizedTrigger !== "manual")) {
    throw new Error("backup trigger is invalid.");
  }
  mkdirSync(backupDir, { recursive: true });
  const timestamp = nowIso().replace(/[-:.]/g, "");
  const backupId = `${backupFilePrefix}${timestamp}-${createId("backup")}-${normalizedTrigger}${backupFileSuffix}`;
  const backupPath = path.join(backupDir, backupId);
  writeFileSync(backupPath, JSON.stringify(storeSnapshot, null, 2), "utf8");
  const stat = statSync(backupPath);
  return buildBackupItem({ fileName: backupId, stat });
}
