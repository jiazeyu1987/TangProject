import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_INTAKE_TIMEOUT_MS = 180000;
const AUTH_TOKEN_KEY = "clinical-rollout-auth-token";
const SIMULATION_CLOCK_RELATIVE_PATH = path.join("data", "runtime", "sim-clock.json");

const REGION_LABELS = {
  "region-east": "华东",
  "region-central": "华中",
};

const ROLE_LABELS = {
  manager: "经理",
  supervisor: "主管",
  specialist: "专员",
};

const FIXED_ACCOUNT_SPECS = [
  { role: "manager", regionId: "region-east", name: "周明远", account: "zhou.mingyuan" },
  { role: "supervisor", regionId: "region-east", name: "顾晨曦", account: "gu.chenxi" },
  { role: "supervisor", regionId: "region-central", name: "魏子康", account: "wei.zikang" },
  { role: "specialist", regionId: "region-east", name: "陈嘉宁", account: "chen.jianing" },
  { role: "specialist", regionId: "region-east", name: "林书远", account: "lin.shuyuan" },
  { role: "specialist", regionId: "region-east", name: "宋雨桐", account: "song.yutong" },
  { role: "specialist", regionId: "region-east", name: "高致远", account: "gao.zhiyuan" },
  { role: "specialist", regionId: "region-east", name: "许若溪", account: "xu.ruoxi" },
  { role: "specialist", regionId: "region-central", name: "何嘉树", account: "he.jiashu" },
  { role: "specialist", regionId: "region-central", name: "郑可心", account: "zheng.kexin" },
  { role: "specialist", regionId: "region-central", name: "罗景澄", account: "luo.jingcheng" },
  { role: "specialist", regionId: "region-central", name: "周语彤", account: "zhou.yutong" },
  { role: "specialist", regionId: "region-central", name: "彭书航", account: "peng.shuhang" },
];

const MANAGER_CANDIDATES = [
  { name: "周明远", account: "zhou.mingyuan" },
  { name: "邵宏伟", account: "shao.hongwei" },
  { name: "任志诚", account: "ren.zhicheng" },
  { name: "唐嘉树", account: "tang.jiashu" },
  { name: "陆景山", account: "lu.jingshan" },
];

const SUPERVISOR_CANDIDATES = {
  "region-east": [
    { name: "顾晨曦", account: "gu.chenxi" },
    { name: "程启航", account: "cheng.qihang" },
    { name: "沈亦航", account: "shen.yihang" },
    { name: "韩书庭", account: "han.shuting" },
    { name: "许正阳", account: "xu.zhengyang" },
  ],
  "region-central": [
    { name: "魏子康", account: "wei.zikang" },
    { name: "彭思远", account: "peng.siyuan" },
    { name: "朱明赫", account: "zhu.minghe" },
    { name: "杨修远", account: "yang.xiuyuan" },
    { name: "孔彦霖", account: "kong.yanlin" },
  ],
};

const SPECIALIST_CANDIDATES = {
  "region-east": [
    { name: "陈嘉宁", account: "chen.jianing" },
    { name: "林书远", account: "lin.shuyuan" },
    { name: "宋雨桐", account: "song.yutong" },
    { name: "高致远", account: "gao.zhiyuan" },
    { name: "许若溪", account: "xu.ruoxi" },
    { name: "蒋文博", account: "jiang.wenbo" },
    { name: "顾知行", account: "gu.zhixing" },
    { name: "沈清妍", account: "shen.qingyan" },
    { name: "陆星河", account: "lu.xinghe" },
    { name: "唐安宁", account: "tang.anning" },
  ],
  "region-central": [
    { name: "何嘉树", account: "he.jiashu" },
    { name: "郑可心", account: "zheng.kexin" },
    { name: "罗景澄", account: "luo.jingcheng" },
    { name: "周语彤", account: "zhou.yutong" },
    { name: "彭书航", account: "peng.shuhang" },
    { name: "曹子衿", account: "cao.zijin" },
    { name: "袁致远", account: "yuan.zhiyuan" },
    { name: "魏安和", account: "wei.anhe" },
    { name: "郝嘉禾", account: "hao.jiahe" },
    { name: "段清妍", account: "duan.qingyan" },
  ],
};

const HOSPITAL_CANDIDATES = {
  "region-east": [
    { hospitalName: "上海同泽医院", city: "上海", department: "疼痛科", primaryContact: "陈国良主任", secondaryContact: "李慧护士长" },
    { hospitalName: "苏州景和医院", city: "苏州", department: "麻醉科", primaryContact: "周明博主任", secondaryContact: "吴晓岚护士长" },
    { hospitalName: "杭州博安医院", city: "杭州", department: "康复科", primaryContact: "沈亦凡主任", secondaryContact: "赵晴护士长" },
    { hospitalName: "宁波安和医院", city: "宁波", department: "护理部", primaryContact: "顾文凯主任", secondaryContact: "钱静护士长" },
    { hospitalName: "南京弘济医院", city: "南京", department: "医务处", primaryContact: "邵嘉木主任", secondaryContact: "孙悦老师" },
    { hospitalName: "无锡瑞康医院", city: "无锡", department: "门诊部", primaryContact: "蒋泽成主任", secondaryContact: "范琳护士长" },
    { hospitalName: "绍兴和信医院", city: "绍兴", department: "信息科", primaryContact: "卢景岳主任", secondaryContact: "方静老师" },
    { hospitalName: "南通博仁医院", city: "南通", department: "疼痛科", primaryContact: "韩启明主任", secondaryContact: "袁洁护士长" },
  ],
  "region-central": [
    { hospitalName: "武汉和康医院", city: "武汉", department: "疼痛科", primaryContact: "唐宇成主任", secondaryContact: "刘敏护士长" },
    { hospitalName: "长沙安济医院", city: "长沙", department: "康复科", primaryContact: "彭文昊主任", secondaryContact: "徐宁护士长" },
    { hospitalName: "郑州博济医院", city: "郑州", department: "麻醉科", primaryContact: "罗建新主任", secondaryContact: "曹悦护士长" },
    { hospitalName: "南昌同安医院", city: "南昌", department: "医务处", primaryContact: "魏明哲主任", secondaryContact: "谢蓉老师" },
    { hospitalName: "襄阳康民医院", city: "襄阳", department: "护理部", primaryContact: "孔德川主任", secondaryContact: "杨岚护士长" },
    { hospitalName: "洛阳景润医院", city: "洛阳", department: "信息科", primaryContact: "郝远航主任", secondaryContact: "高洁老师" },
    { hospitalName: "株洲安澜医院", city: "株洲", department: "门诊部", primaryContact: "段启程主任", secondaryContact: "曾晴护士长" },
    { hospitalName: "九江和顺医院", city: "九江", department: "疼痛科", primaryContact: "谢文山主任", secondaryContact: "何静护士长" },
  ],
};

const SCENARIO_TOPICS = [
  "术后疼痛管理",
  "围术期随访",
  "康复协同管理",
  "门诊首诊建档",
  "日间手术随访",
  "病区镇痛路径",
  "护理随访协同",
  "门诊慢病教育",
];

const ISSUE_THEMES = [
  "采购流程还没走完",
  "价格方案需要补充书面说明",
  "培训排期还没有完全锁定",
  "院办口径还没有统一",
  "科室牵头人还没最终拍板",
  "试用病例数量还没有确认",
];

const SUPPORT_ITEMS = [
  "报价说明",
  "培训安排表",
  "试用流程单页",
  "护理操作SOP",
  "项目排期表",
  "采购节点说明",
];

const FOLLOWUP_QUESTIONS = [
  "采购负责人和预计审批时间还不够清楚，请补齐。",
  "下次沟通请把试用病例数量和培训负责人一起确认。",
  "请把院办和科室的最终决策链再梳理一遍。",
  "请确认正式试用前还缺哪一份内部材料。",
  "请补充本轮会议后谁来内部推进采购节点。",
];

const PROJECT_TIMELINE_MATRIX = [
  { recordDayIndexes: [0, 3], remarkActions: [{ updateIndex: 0, markRead: true }, { updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [0, 4], remarkActions: [{ updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [1, 4], remarkActions: [{ updateIndex: 0, markRead: true }, { updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [1, 5], remarkActions: [{ updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [2, 5], remarkActions: [{ updateIndex: 0, markRead: true }, { updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [2, 6], remarkActions: [{ updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [3, 6], remarkActions: [{ updateIndex: 0, markRead: true }, { updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [0, 6], remarkActions: [{ updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [1, 3], remarkActions: [{ updateIndex: 0, markRead: true }, { updateIndex: 1, markRead: false }] },
  { recordDayIndexes: [2, 4], remarkActions: [{ updateIndex: 1, markRead: false }] },
];

function fail(message) {
  throw new Error(String(message || "Unknown error."));
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value || ""), "utf8");
}

function setRootOnlyFileMode(filePath) {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best effort on non-POSIX environments.
  }
}

function clipText(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeAccount(value) {
  return String(value || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    repoRoot: DEFAULT_REPO_ROOT,
    artifactsDir: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    intakeTimeoutMs: DEFAULT_INTAKE_TIMEOUT_MS,
    headful: false,
    slowMoMs: 0,
    dayCount: 7,
    rollbackOnSuccess: false,
    noRollbackOnFailure: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = String(argv[index] || "");
    const next = String(argv[index + 1] || "");
    const takeValue = () => {
      if (!next || next.startsWith("--")) {
        fail(`Missing value for ${token}`);
      }
      index += 1;
      return next;
    };

    if (token === "--base-url") {
      options.baseUrl = takeValue();
      continue;
    }
    if (token === "--repo-root") {
      options.repoRoot = path.resolve(takeValue());
      continue;
    }
    if (token === "--artifacts-dir") {
      options.artifactsDir = path.resolve(takeValue());
      continue;
    }
    if (token === "--timeout-ms") {
      options.timeoutMs = Number.parseInt(takeValue(), 10);
      continue;
    }
    if (token === "--intake-timeout-ms") {
      options.intakeTimeoutMs = Number.parseInt(takeValue(), 10);
      continue;
    }
    if (token === "--headful") {
      options.headful = true;
      continue;
    }
    if (token === "--slow-mo-ms") {
      options.slowMoMs = Number.parseInt(takeValue(), 10);
      continue;
    }
    if (token === "--day-count") {
      options.dayCount = Number.parseInt(takeValue(), 10);
      continue;
    }
    if (token === "--rollback-on-success") {
      options.rollbackOnSuccess = true;
      continue;
    }
    if (token === "--no-rollback-on-failure") {
      options.noRollbackOnFailure = true;
      continue;
    }
    fail(`Unsupported argument: ${token}`);
  }

  if (!/^https?:\/\//i.test(String(options.baseUrl || "").trim())) {
    fail(`baseUrl must start with http:// or https://. Got: ${options.baseUrl}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000) {
    fail(`timeoutMs is invalid: ${options.timeoutMs}`);
  }
  if (!Number.isInteger(options.intakeTimeoutMs) || options.intakeTimeoutMs < 5000) {
    fail(`intakeTimeoutMs is invalid: ${options.intakeTimeoutMs}`);
  }
  if (!Number.isInteger(options.slowMoMs) || options.slowMoMs < 0) {
    fail(`slowMoMs is invalid: ${options.slowMoMs}`);
  }
  if (!Number.isInteger(options.dayCount) || options.dayCount < 1 || options.dayCount > 7) {
    fail(`dayCount is invalid: ${options.dayCount}`);
  }

  return options;
}

function resolveArtifactsDir(options) {
  if (options.artifactsDir) {
    return options.artifactsDir;
  }
  const runId = `seed-${nowIso().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  return path.join(options.repoRoot, "output", "seed-runs", runId);
}

function createRunContext(options) {
  const artifactsDir = resolveArtifactsDir(options);
  const backupsDir = path.join(artifactsDir, "backups");
  const browserDir = path.join(artifactsDir, "browser");
  const tracesDir = path.join(browserDir, "traces");
  const screenshotsDir = path.join(browserDir, "screenshots");
  const seedRunPath = path.join(artifactsDir, "seed-run.json");
  const seedReportPath = path.join(artifactsDir, "seed-report.md");
  const errorReportPath = path.join(artifactsDir, "error.md");
  const progressPath = path.join(artifactsDir, "progress.log");
  const preflightPath = path.join(artifactsDir, "preflight.json");

  for (const target of [artifactsDir, backupsDir, browserDir, tracesDir, screenshotsDir]) {
    ensureDir(target);
  }

  const context = {
    options,
    artifactsDir,
    backupsDir,
    tracesDir,
    screenshotsDir,
    seedRunPath,
    seedReportPath,
    errorReportPath,
    progressPath,
    preflightPath,
    repoRoot: options.repoRoot,
    baseUrl: String(options.baseUrl).trim().replace(/\/+$/, ""),
    startedAt: nowIso(),
    status: "starting",
    events: [],
    phase: "init",
    currentDate: "",
    currentActor: "",
    currentProject: "",
    rollback: {
      simulationEnabled: false,
      envRestored: false,
      runtimeRestored: false,
      storeRestored: false,
      healthRestored: false,
    },
    backups: {
      envExample: path.join(backupsDir, "env.example.backup"),
      store: path.join(backupsDir, "store.json.backup"),
      runtime: path.join(backupsDir, "runtime-backup"),
      envExampleExisted: false,
      storeExisted: false,
      runtimeExisted: false,
    },
    metadata: {
      currentHealth: null,
      plannedDates: [],
      accounts: [],
      projects: [],
    },
    executionPlan: null,
  };

  writeText(progressPath, "");
  writeRunState(context);
  console.log(`SEED_ARTIFACTS=${artifactsDir}`);
  return context;
}

function writeRunState(context) {
  const payload = {
    status: context.status,
    startedAt: context.startedAt,
    finishedAt: context.finishedAt || null,
    phase: context.phase,
    currentDate: context.currentDate || "",
    currentActor: context.currentActor || "",
    currentProject: context.currentProject || "",
    rollback: context.rollback,
    metadata: context.metadata,
    events: context.events,
  };
  writeJson(context.seedRunPath, payload);
  setRootOnlyFileMode(context.seedRunPath);
}

function recordProgress(context, message, details = null) {
  const line = `[${nowIso()}] ${message}`;
  fs.appendFileSync(context.progressPath, `${line}\n`, "utf8");
  context.events.push({
    at: nowIso(),
    message,
    details: details || undefined,
  });
  writeRunState(context);
}

function setPhase(context, phase, extra = {}) {
  context.phase = phase;
  context.currentDate = extra.currentDate ?? context.currentDate;
  context.currentActor = extra.currentActor ?? context.currentActor;
  context.currentProject = extra.currentProject ?? context.currentProject;
  writeRunState(context);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateText, deltaDays) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return formatDateOnly(date);
}

function buildSevenDayWindow(endDate) {
  return Array.from({ length: 7 }, (_, index) => addDays(endDate, index - 6));
}

function selectExecutedDates(fullDateRange, dayCount) {
  return fullDateRange.slice(0, dayCount);
}

function buildClockPayload(dateText, dayIndex) {
  return {
    currentDate: dateText,
    currentDateTime: `${dateText}T09:00:00.000Z`,
    dayIndex,
    turnIndex: 0,
    updatedAt: nowIso(),
  };
}

function backupFileIfExists(sourcePath, backupPath) {
  ensureDir(path.dirname(backupPath));
  if (!fs.existsSync(sourcePath)) {
    return false;
  }
  fs.copyFileSync(sourcePath, backupPath);
  return true;
}

function backupDirectoryIfExists(sourcePath, backupPath) {
  ensureDir(path.dirname(backupPath));
  if (!fs.existsSync(sourcePath)) {
    return false;
  }
  fs.rmSync(backupPath, { recursive: true, force: true });
  fs.cpSync(sourcePath, backupPath, { recursive: true });
  return true;
}

function restoreFileFromBackup(backupPath, destinationPath) {
  if (!fs.existsSync(backupPath)) {
    return;
  }
  ensureDir(path.dirname(destinationPath));
  fs.copyFileSync(backupPath, destinationPath);
}

function restoreDirectoryFromBackup(backupPath, destinationPath, existedBeforeBackup) {
  if (!fs.existsSync(backupPath)) {
    if (!existedBeforeBackup) {
      fs.rmSync(destinationPath, { recursive: true, force: true });
    }
    return;
  }
  fs.rmSync(destinationPath, { recursive: true, force: true });
  fs.cpSync(backupPath, destinationPath, { recursive: true });
}

async function runCommand(command, args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const label = options.label || `${command} ${args.join(" ")}`;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
    }

    child.once("error", (error) => {
      reject(new Error(`${label} failed to start: ${error instanceof Error ? error.message : String(error)}`));
    });
    child.once("exit", (code) => {
      if (code !== 0) {
        const detail = clipText((stderr || stdout || "").replace(/\s+/g, " "), 400);
        reject(new Error(`${label} failed with exit code ${code}.${detail ? ` ${detail}` : ""}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function restartContainerWithSyncedCode(context, label) {
  await runCommand("docker", ["compose", "up", "-d", "--force-recreate", "--no-build", "tang-project"], {
    cwd: context.repoRoot,
    label: `${label} 容器重建`,
  });
  await runCommand("docker", ["exec", "tang-project", "sh", "-lc", "rm -rf /app/server /app/public && mkdir -p /app/server /app/public"], {
    cwd: context.repoRoot,
    label: `${label} 清理容器代码目录`,
  });
  await runCommand("docker", ["cp", path.join(context.repoRoot, "server.js"), "tang-project:/app/server.js"], {
    cwd: context.repoRoot,
    label: `${label} 同步 server.js`,
  });
  await runCommand("docker", ["cp", `${path.join(context.repoRoot, "server")}${path.sep}.`, "tang-project:/app/server/"], {
    cwd: context.repoRoot,
    label: `${label} 同步 server 模块`,
  });
  await runCommand("docker", ["cp", `${path.join(context.repoRoot, "public")}${path.sep}.`, "tang-project:/app/public/"], {
    cwd: context.repoRoot,
    label: `${label} 同步 public 资源`,
  });
  await runCommand("docker", ["restart", "tang-project"], {
    cwd: context.repoRoot,
    label: `${label} 重启容器`,
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      fail(`Expected JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function requestJson({ baseUrl, pathname, method = "GET", token = "", body }) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const result = await fetchJson(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!result.ok) {
    fail(result.payload?.error || `HTTP ${result.status} from ${method} ${pathname}`);
  }
  return result.payload;
}

async function waitForHealth(baseUrl, timeoutMs, expectedSimulationEnabled) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fetchJson(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(Math.min(5000, timeoutMs)),
      });
      if (result.ok && typeof result.payload?.simulation?.enabled === "boolean") {
        if (
          expectedSimulationEnabled === undefined ||
          Boolean(result.payload.simulation.enabled) === Boolean(expectedSimulationEnabled)
        ) {
          return result.payload;
        }
      }
    } catch {
      // Keep polling.
    }
    await delay(1000);
  }
  fail(`Timed out waiting for health at ${baseUrl}/api/health`);
}

async function waitForAuthOptionsReady(baseUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fetchJson(`${baseUrl}/api/auth/options`, {
        signal: AbortSignal.timeout(Math.min(5000, timeoutMs)),
      });
      if (result.ok && Array.isArray(result.payload?.roles) && Array.isArray(result.payload?.regions)) {
        return result.payload;
      }
    } catch {
      // Retry until auth options become ready.
    }
    await delay(1000);
  }
  fail(`Timed out waiting for auth options at ${baseUrl}/api/auth/options`);
}

function selectCandidates(pool, count, existingNames, existingAccounts, usedNames, usedAccounts, label) {
  const selected = [];
  for (const candidate of pool) {
    const normalizedName = clipText(candidate.name, 40);
    const normalizedAccount = normalizeAccount(candidate.account);
    if (!normalizedName || !normalizedAccount) {
      continue;
    }
    if (existingNames.has(normalizedName) || usedNames.has(normalizedName)) {
      continue;
    }
    if (existingAccounts.has(normalizedAccount) || usedAccounts.has(normalizedAccount)) {
      continue;
    }
    usedNames.add(normalizedName);
    usedAccounts.add(normalizedAccount);
    selected.push({
      ...candidate,
      name: normalizedName,
      account: normalizedAccount,
    });
    if (selected.length === count) {
      return selected;
    }
  }
  fail(`${label} 候选池不足，无法满足无冲突要求。`);
}

function selectHospitals(pool, count, existingHospitals, usedHospitals, label) {
  const selected = [];
  for (const candidate of pool) {
    const hospitalName = clipText(candidate.hospitalName, 120);
    if (!hospitalName || existingHospitals.has(hospitalName) || usedHospitals.has(hospitalName)) {
      continue;
    }
    usedHospitals.add(hospitalName);
    selected.push({
      ...candidate,
      hospitalName,
      city: clipText(candidate.city, 40),
      department: clipText(candidate.department, 40),
      primaryContact: clipText(candidate.primaryContact, 40),
      secondaryContact: clipText(candidate.secondaryContact, 40),
    });
    if (selected.length === count) {
      return selected;
    }
  }
  fail(`${label} 医院候选池不足，无法满足无冲突要求。`);
}

function generateStrongPassword(account) {
  const normalizedAccount = normalizeAccount(account);
  const hash = crypto.createHash("sha256").update(`TangProjectSeed:${normalizedAccount}`).digest("hex");
  return `Tp!${hash.slice(0, 4)}${hash.slice(4, 8).toUpperCase()}${hash.slice(8, 12)}@`;
}

function buildScenarioText(index) {
  return SCENARIO_TOPICS[index % SCENARIO_TOPICS.length];
}

function buildIssueText(index) {
  return ISSUE_THEMES[index % ISSUE_THEMES.length];
}

function buildSupportItem(index) {
  return SUPPORT_ITEMS[index % SUPPORT_ITEMS.length];
}

function buildRecordNote(projectPlan, updateIndex) {
  const supportItem = buildSupportItem(projectPlan.sequence + updateIndex);
  const issueText = buildIssueText(projectPlan.sequence + updateIndex);
  if (updateIndex === 0) {
    return [
      `今天到${projectPlan.hospitalName}${projectPlan.department}拜访${projectPlan.primaryContact}和${projectPlan.secondaryContact}，继续沟通${projectPlan.topic}的落地安排。`,
      `院方认可系统在${projectPlan.topic}场景中的价值，愿意先安排小范围试用，但明确表示${issueText}，暂时还不能直接进入正式执行。`,
      `对方要求我们先补充${supportItem}，同时把下周内部评审的时间和牵头人一起对齐。`,
      `我已约定在本周内回传材料，并在下次沟通时确认试用床位、培训负责人和采购节点，项目有机会进入试用评估。`,
    ].join("");
  }
  return [
    `今天再次到${projectPlan.hospitalName}${projectPlan.department}回访${projectPlan.primaryContact}，同时补充和${projectPlan.secondaryContact}核对了培训安排。`,
    `院方已经看过我们上次发出的${supportItem}，对${projectPlan.topic}试用方案没有原则性异议，但仍强调${issueText}需要在正式启动前收口。`,
    `这次已经把试用病例数量、培训时间和内部审批顺序基本对齐，院方希望我们下周把最终执行清单发过去。`,
    `如果采购节点按目前节奏推进，项目可以从试用评估转入培训排期，我会继续盯住牵头人和院办反馈。`,
  ].join("");
}

function buildRemarkText(projectPlan, remarkIndex) {
  return FOLLOWUP_QUESTIONS[(projectPlan.sequence + remarkIndex) % FOLLOWUP_QUESTIONS.length];
}

function buildExecutionPlan(store, dateRange) {
  const existingNames = new Set((store.users || []).map((user) => clipText(user?.name, 40)).filter(Boolean));
  const existingAccounts = new Set((store.users || []).map((user) => normalizeAccount(user?.account)).filter(Boolean));
  const existingHospitals = new Set((store.hospitals || []).map((hospital) => clipText(hospital?.name, 120)).filter(Boolean));
  const usedNames = new Set();
  const usedAccounts = new Set();
  const usedHospitals = new Set();

  const [managerCandidate] = selectCandidates(
    MANAGER_CANDIDATES,
    1,
    existingNames,
    existingAccounts,
    usedNames,
    usedAccounts,
    "经理",
  );
  const [eastSupervisor] = selectCandidates(
    SUPERVISOR_CANDIDATES["region-east"],
    1,
    existingNames,
    existingAccounts,
    usedNames,
    usedAccounts,
    "华东主管",
  );
  const [centralSupervisor] = selectCandidates(
    SUPERVISOR_CANDIDATES["region-central"],
    1,
    existingNames,
    existingAccounts,
    usedNames,
    usedAccounts,
    "华中主管",
  );
  const eastSpecialists = selectCandidates(
    SPECIALIST_CANDIDATES["region-east"],
    5,
    existingNames,
    existingAccounts,
    usedNames,
    usedAccounts,
    "华东专员",
  );
  const centralSpecialists = selectCandidates(
    SPECIALIST_CANDIDATES["region-central"],
    5,
    existingNames,
    existingAccounts,
    usedNames,
    usedAccounts,
    "华中专员",
  );

  const eastHospitals = selectHospitals(
    HOSPITAL_CANDIDATES["region-east"],
    5,
    existingHospitals,
    usedHospitals,
    "华东",
  );
  const centralHospitals = selectHospitals(
    HOSPITAL_CANDIDATES["region-central"],
    5,
    existingHospitals,
    usedHospitals,
    "华中",
  );

  const accounts = [];
  accounts.push({
    role: "manager",
    regionId: "region-east",
    password: generateStrongPassword(),
    ...managerCandidate,
  });
  accounts.push({
    role: "supervisor",
    regionId: "region-east",
    password: generateStrongPassword(),
    ...eastSupervisor,
  });
  accounts.push({
    role: "supervisor",
    regionId: "region-central",
    password: generateStrongPassword(),
    ...centralSupervisor,
  });

  const specialistPlans = [];
  const mergedSpecialists = [
    ...eastSpecialists.map((candidate, index) => ({
      candidate,
      hospital: eastHospitals[index],
      regionId: "region-east",
      supervisorAccount: eastSupervisor.account,
    })),
    ...centralSpecialists.map((candidate, index) => ({
      candidate,
      hospital: centralHospitals[index],
      regionId: "region-central",
      supervisorAccount: centralSupervisor.account,
    })),
  ];

  mergedSpecialists.forEach((item, index) => {
    const timeline = PROJECT_TIMELINE_MATRIX[index];
    const accountPlan = {
      role: "specialist",
      regionId: item.regionId,
      password: generateStrongPassword(),
      ...item.candidate,
    };
    accounts.push(accountPlan);
    specialistPlans.push({
      sequence: index + 1,
      role: "specialist",
      regionId: item.regionId,
      name: accountPlan.name,
      account: accountPlan.account,
      password: accountPlan.password,
      supervisorAccount: item.supervisorAccount,
      hospitalName: item.hospital.hospitalName,
      city: item.hospital.city,
      department: item.hospital.department,
      primaryContact: item.hospital.primaryContact,
      secondaryContact: item.hospital.secondaryContact,
      topic: buildScenarioText(index),
      recordDayIndexes: [...timeline.recordDayIndexes],
      remarkActions: timeline.remarkActions.map((remark, remarkIndex) => ({
        ...remark,
        content: buildRemarkText({ sequence: index + 1 }, remarkIndex),
      })),
      updatePlans: timeline.recordDayIndexes.map((dayIndex, updateIndex) => ({
        updateIndex,
        dayIndex,
        visitDate: dateRange[dayIndex],
        note: buildRecordNote({
          sequence: index + 1,
          hospitalName: item.hospital.hospitalName,
          department: item.hospital.department,
          primaryContact: item.hospital.primaryContact,
          secondaryContact: item.hospital.secondaryContact,
          topic: buildScenarioText(index),
        }, updateIndex),
      })),
    });
  });

  return {
    accounts,
    specialistPlans,
    supervisors: {
      "region-east": eastSupervisor.account,
      "region-central": centralSupervisor.account,
    },
    hospitals: specialistPlans.map((item) => item.hospitalName),
    dateRange,
  };
}

function buildFixedExecutionPlan(store, dateRange) {
  const existingUsersByAccount = new Map(
    (store.users || [])
      .filter((user) => normalizeAccount(user?.account))
      .map((user) => [normalizeAccount(user.account), user]),
  );
  const existingHospitals = new Set((store.hospitals || []).map((hospital) => clipText(hospital?.name, 120)).filter(Boolean));
  const usedHospitals = new Set();

  const eastHospitals = selectHospitals(
    HOSPITAL_CANDIDATES["region-east"],
    5,
    existingHospitals,
    usedHospitals,
    "华东",
  );
  const centralHospitals = selectHospitals(
    HOSPITAL_CANDIDATES["region-central"],
    5,
    existingHospitals,
    usedHospitals,
    "华中",
  );

  const accounts = FIXED_ACCOUNT_SPECS.map((item) => {
    const normalizedAccount = normalizeAccount(item.account);
    const existingUser = existingUsersByAccount.get(normalizedAccount) || null;
    if (existingUser) {
      if (clipText(existingUser?.name, 40) !== item.name) {
        fail(`现有账号 ${item.account} 的姓名不是 ${item.name}，无法复用。`);
      }
      if (clipText(existingUser?.role, 40) !== item.role) {
        fail(`现有账号 ${item.account} 的角色不是 ${item.role}，无法复用。`);
      }
      if (clipText(existingUser?.regionId, 40) !== item.regionId) {
        fail(`现有账号 ${item.account} 的区域不是 ${item.regionId}，无法复用。`);
      }
    }
    return {
      ...item,
      account: normalizedAccount,
      password: generateStrongPassword(normalizedAccount),
      existingUserId: existingUser?.id || "",
    };
  });

  const eastSupervisor = accounts.find((item) => item.role === "supervisor" && item.regionId === "region-east");
  const centralSupervisor = accounts.find((item) => item.role === "supervisor" && item.regionId === "region-central");
  assert(eastSupervisor && centralSupervisor, "主管账号配置不完整。");

  const eastSpecialists = accounts.filter((item) => item.role === "specialist" && item.regionId === "region-east");
  const centralSpecialists = accounts.filter((item) => item.role === "specialist" && item.regionId === "region-central");
  const specialistPlans = [];
  const mergedSpecialists = [
    ...eastSpecialists.map((accountPlan, index) => ({
      accountPlan,
      hospital: eastHospitals[index],
      regionId: "region-east",
      supervisorAccount: eastSupervisor.account,
    })),
    ...centralSpecialists.map((accountPlan, index) => ({
      accountPlan,
      hospital: centralHospitals[index],
      regionId: "region-central",
      supervisorAccount: centralSupervisor.account,
    })),
  ];

  mergedSpecialists.forEach((item, index) => {
    const timeline = PROJECT_TIMELINE_MATRIX[index];
    const accountPlan = item.accountPlan;
    specialistPlans.push({
      sequence: index + 1,
      role: "specialist",
      regionId: item.regionId,
      name: accountPlan.name,
      account: accountPlan.account,
      password: accountPlan.password,
      existingUserId: accountPlan.existingUserId,
      supervisorAccount: item.supervisorAccount,
      hospitalName: item.hospital.hospitalName,
      city: item.hospital.city,
      department: item.hospital.department,
      primaryContact: item.hospital.primaryContact,
      secondaryContact: item.hospital.secondaryContact,
      topic: buildScenarioText(index),
      recordDayIndexes: [...timeline.recordDayIndexes],
      remarkActions: timeline.remarkActions.map((remark, remarkIndex) => ({
        ...remark,
        content: buildRemarkText({ sequence: index + 1 }, remarkIndex),
      })),
      updatePlans: timeline.recordDayIndexes.map((dayIndex, updateIndex) => ({
        updateIndex,
        dayIndex,
        visitDate: dateRange[dayIndex],
        note: buildRecordNote({
          sequence: index + 1,
          hospitalName: item.hospital.hospitalName,
          department: item.hospital.department,
          primaryContact: item.hospital.primaryContact,
          secondaryContact: item.hospital.secondaryContact,
          topic: buildScenarioText(index),
        }, updateIndex),
      })),
    });
  });

  return {
    accounts,
    specialistPlans,
    supervisors: {
      "region-east": eastSupervisor.account,
      "region-central": centralSupervisor.account,
    },
    hospitals: specialistPlans.map((item) => item.hospitalName),
    dateRange,
  };
}

function mutateEnvForSimulation(originalContent) {
  const lines = String(originalContent || "")
    .split(/\r?\n/)
    .filter((line) => !/^SIMULATION_MODE=/.test(line) && !/^SIMULATION_CLOCK_FILE=/.test(line));
  lines.push("SIMULATION_MODE=true");
  lines.push("SIMULATION_CLOCK_FILE=/app/data/runtime/sim-clock.json");
  return `${lines.join("\n").trim()}\n`;
}

async function switchServerMode(context, { enableSimulation, restoreStore }) {
  const envExamplePath = path.join(context.repoRoot, ".env.example");
  const storePath = path.join(context.repoRoot, "data", "store.json");
  const runtimeDir = path.join(context.repoRoot, "data", "runtime");
  const clockPath = path.join(context.repoRoot, SIMULATION_CLOCK_RELATIVE_PATH);

  if (enableSimulation) {
    recordProgress(context, "切换测试服到模拟时钟模式");
    context.backups.envExampleExisted = backupFileIfExists(envExamplePath, context.backups.envExample);
    context.backups.storeExisted = backupFileIfExists(storePath, context.backups.store);
    context.backups.runtimeExisted = backupDirectoryIfExists(runtimeDir, context.backups.runtime);
    const originalEnv = fs.existsSync(context.backups.envExample) ? fs.readFileSync(context.backups.envExample, "utf8") : "";
    writeText(envExamplePath, mutateEnvForSimulation(originalEnv));
    ensureDir(path.dirname(clockPath));
    writeJson(clockPath, buildClockPayload(context.metadata.plannedDates[0], 0));
    await restartContainerWithSyncedCode(context, "切换模拟时钟");
    const health = await waitForHealth(context.baseUrl, context.options.timeoutMs * 4, true);
    assert(health?.simulation?.enabled === true, "测试服未成功进入模拟时钟模式。");
    context.rollback.simulationEnabled = true;
    context.metadata.currentHealth = health;
    writeJson(context.preflightPath, {
      ...readJsonSafe(context.preflightPath),
      healthAfterSimulationEnable: health,
    });
    return;
  }

  recordProgress(context, restoreStore ? "恢复测试服环境并回滚数据" : "恢复测试服正常时钟模式");
  if (context.backups.envExampleExisted) {
    restoreFileFromBackup(context.backups.envExample, envExamplePath);
    context.rollback.envRestored = true;
  }
  restoreDirectoryFromBackup(context.backups.runtime, runtimeDir, context.backups.runtimeExisted);
  context.rollback.runtimeRestored = true;
  if (restoreStore) {
    if (context.backups.storeExisted) {
      restoreFileFromBackup(context.backups.store, storePath);
      context.rollback.storeRestored = true;
    }
  }
  await restartContainerWithSyncedCode(context, restoreStore ? "回滚恢复" : "恢复正常时钟");
  const health = await waitForHealth(context.baseUrl, context.options.timeoutMs * 4, false);
  assert(health?.simulation?.enabled === false, "测试服恢复后仍处于模拟时钟模式。");
  context.rollback.healthRestored = true;
  context.metadata.currentHealth = health;
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function setSimulationClock(context, dateText, dayIndex) {
  const clockPath = path.join(context.repoRoot, SIMULATION_CLOCK_RELATIVE_PATH);
  writeJson(clockPath, buildClockPayload(dateText, dayIndex));
  recordProgress(context, "更新模拟时钟", { date: dateText, dayIndex });
}

function responseMatches(response, method, pathname) {
  try {
    return (
      response.request().method().toUpperCase() === String(method || "GET").toUpperCase() &&
      new URL(response.url()).pathname === pathname
    );
  } catch {
    return false;
  }
}

async function waitForJsonResponse(page, { method, pathname, timeoutMs, trigger }) {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => responseMatches(candidate, method, pathname), { timeout: timeoutMs }),
    trigger(),
  ]);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    fail(`Expected JSON from ${pathname}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok()) {
    fail(payload?.error || `HTTP ${response.status()} from ${pathname}`);
  }
  return payload;
}

async function ensureAuthDialogVisible(page, timeoutMs) {
  await page.locator("#authDialog").waitFor({ state: "visible", timeout: timeoutMs });
}

async function ensureAuthDialogReady(page, mode, authOptions, timeoutMs) {
  try {
    await ensureAuthDialogVisible(page, timeoutMs);
    return;
  } catch {
    await page.evaluate(({ targetMode, regions }) => {
      const dialog = document.querySelector("#authDialog");
      const appShell = document.querySelector("#appShell");
      const loginForm = document.querySelector("#authLoginForm");
      const registerForm = document.querySelector("#authRegisterForm");
      const loginButton = document.querySelector("#authModeLoginButton");
      const registerButton = document.querySelector("#authModeRegisterButton");
      const feedback = document.querySelector("#authFeedback");
      const regionSelect = document.querySelector("#authRegisterRegionSelect");

      if (dialog) {
        dialog.hidden = false;
      }
      if (appShell) {
        appShell.classList.add("is-auth-locked");
      }
      if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
      }
      if (loginForm) {
        loginForm.hidden = targetMode !== "login";
      }
      if (registerForm) {
        registerForm.hidden = targetMode === "login";
      }
      if (loginButton) {
        loginButton.classList.toggle("is-active", targetMode === "login");
      }
      if (registerButton) {
        registerButton.classList.toggle("is-active", targetMode === "register");
      }
      if (regionSelect && Array.isArray(regions) && !regionSelect.options.length) {
        regionSelect.innerHTML = regions
          .map(
            (region) =>
              `<option value="${String(region?.id || "").replace(/"/g, "&quot;")}">${String(region?.name || region?.id || "")}</option>`,
          )
          .join("");
      }
    }, {
      targetMode: mode,
      regions: Array.isArray(authOptions?.regions) ? authOptions.regions : [],
    });
    await ensureAuthDialogVisible(page, timeoutMs);
  }
}

async function waitForSessionName(page, expectedDisplayName, timeoutMs) {
  await page.waitForFunction(
    ({ selector, expected }) => {
      const node = document.querySelector(selector);
      return Boolean(node) && String(node.textContent || "").trim() === expected;
    },
    { selector: "#sessionUserName", expected: String(expectedDisplayName || "").trim() },
    { timeout: timeoutMs },
  );
}

async function withTracedSession(context, sessionKey) {
  const tracePath = path.join(context.tracesDir, `${sessionKey}.zip`);
  const screenshotDir = path.join(context.screenshotsDir, sessionKey);
  ensureDir(path.dirname(tracePath));
  ensureDir(screenshotDir);

  const browser = await chromium.launch({
    headless: !context.options.headful,
    slowMo: context.options.slowMoMs || 0,
  });
  const pageContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await pageContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await pageContext.newPage();
  page.setDefaultTimeout(context.options.timeoutMs);

  return {
    browser,
    pageContext,
    page,
    async screenshot(fileName) {
      const target = path.join(screenshotDir, fileName);
      await page.screenshot({ path: target, fullPage: true });
      return target;
    },
    async close() {
      try {
        await pageContext.tracing.stop({ path: tracePath });
      } catch {
        // Ignore trace close failures.
      } finally {
        await pageContext.close().catch(() => {});
        await browser.close().catch(() => {});
      }
      return tracePath;
    },
  };
}

async function loginByUI({ page, baseUrl, account, password, displayName, timeoutMs }) {
  const authOptions = await waitForAuthOptionsReady(baseUrl, timeoutMs);
  await page.goto(baseUrl, { waitUntil: "commit", timeout: timeoutMs });
  await ensureAuthDialogReady(page, "login", authOptions, timeoutMs);
  await page.locator("#authModeLoginButton").click({ timeout: timeoutMs });
  await page.locator("#authLoginAccountInput").fill(String(account || ""), { timeout: timeoutMs });
  await page.locator("#authLoginPasswordInput").fill(String(password || ""), { timeout: timeoutMs });
  const payload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/auth/login",
    timeoutMs,
    trigger: () => page.locator("#authLoginSubmitButton").click({ timeout: timeoutMs }),
  });
  if (displayName) {
    await waitForSessionName(page, displayName, timeoutMs);
  }
  return payload;
}

async function registerByUI({ page, baseUrl, spec, timeoutMs }) {
  const authOptions = await waitForAuthOptionsReady(baseUrl, timeoutMs);
  await page.goto(baseUrl, { waitUntil: "commit", timeout: timeoutMs });
  await ensureAuthDialogReady(page, "register", authOptions, timeoutMs);
  await page.locator("#authModeRegisterButton").click({ timeout: timeoutMs });
  await page.locator("#authRegisterNameInput").fill(spec.name, { timeout: timeoutMs });
  await page.locator("#authRegisterAccountInput").fill(spec.account, { timeout: timeoutMs });
  await page.locator("#authRegisterPasswordInput").fill(spec.password, { timeout: timeoutMs });
  await page.locator("#authRegisterRoleSelect").selectOption(spec.role, { timeout: timeoutMs });
  await page.locator("#authRegisterRegionSelect").selectOption(spec.regionId, { timeout: timeoutMs });
  const payload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/auth/register",
    timeoutMs,
    trigger: () => page.locator("#authRegisterSubmitButton").click({ timeout: timeoutMs }),
  });
  await waitForSessionName(page, spec.name, timeoutMs);
  return payload;
}

async function clickMainTab(page, tabId, timeoutMs) {
  await page.locator(`#tabBar button[data-tab="${tabId}"]`).click({ timeout: timeoutMs });
}

async function createHospitalProject({ page, hospitalName, city, departmentName, timeoutMs }) {
  await clickMainTab(page, "entry", timeoutMs);
  await page.locator("#projectAddButton").waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator("#projectAddButton").click({ timeout: timeoutMs });
  await page.locator("#projectModal").waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator("#newHospitalNameInput").fill(hospitalName, { timeout: timeoutMs });
  await page.locator("#newProjectDepartmentInput").fill(departmentName, { timeout: timeoutMs });
  await page.locator("#newHospitalCityInput").fill(city, { timeout: timeoutMs });
  const payload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/projects",
    timeoutMs,
    trigger: () => page.locator("#newProjectSubmitButton").click({ timeout: timeoutMs }),
  });
  await page.locator("#projectModal").waitFor({ state: "hidden", timeout: timeoutMs });
  return payload;
}

async function selectProjectById({ page, projectId, expectedHospitalName, timeoutMs }) {
  await page.waitForFunction(
    ({ projectId }) => {
      const select = document.querySelector("#projectSelect");
      return Boolean(select) && [...select.options].some((option) => String(option.value || "") === projectId);
    },
    { projectId },
    { timeout: timeoutMs },
  );
  await page.selectOption("#projectSelect", projectId, { timeout: timeoutMs });
  if (expectedHospitalName) {
    await page.waitForFunction(
      ({ projectId, hospitalName }) => {
        const select = document.querySelector("#projectSelect");
        if (!select) {
          return false;
        }
        const option = [...select.options].find((item) => String(item.value || "") === projectId);
        return Boolean(option) && String(option.textContent || "").includes(hospitalName);
      },
      { projectId, hospitalName: expectedHospitalName },
      { timeout: timeoutMs },
    );
  }
}

async function submitIntakeNote({ page, projectId, hospitalName, noteText, timeoutMs, intakeTimeoutMs }) {
  await clickMainTab(page, "entry", timeoutMs);
  await selectProjectById({ page, projectId, expectedHospitalName: hospitalName, timeoutMs });
  await page.locator("#visitDatePreset").selectOption("today", { timeout: timeoutMs });
  await page.locator("#noteInput").fill(noteText, { timeout: timeoutMs });
  const previewPayload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/intake/preview",
    timeoutMs: intakeTimeoutMs,
    trigger: () => page.locator("#submitButton").click({ timeout: timeoutMs }),
  });
  const commitButton = page.locator("#intakeResult [data-intake-action='submit']").first();
  await commitButton.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    () => {
      const button = document.querySelector("#intakeResult [data-intake-action='submit']");
      return Boolean(button) && !button.disabled;
    },
    undefined,
    { timeout: timeoutMs },
  );
  const commitPayload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/intake",
    timeoutMs: intakeTimeoutMs,
    trigger: () => commitButton.click({ timeout: timeoutMs }),
  });
  await page.waitForFunction(
    () => {
      const input = document.querySelector("#noteInput");
      return Boolean(input) && String(input.value || "").trim() === "";
    },
    undefined,
    { timeout: timeoutMs },
  );
  return { previewPayload, commitPayload };
}

async function openLedgerProject(page, projectId, hospitalName, timeoutMs) {
  await clickMainTab(page, "ledger", timeoutMs);
  const projectCard = page.locator(`#projectList [data-project-id="${projectId}"]`).first();
  await projectCard.waitFor({ state: "visible", timeout: timeoutMs });
  await projectCard.click({ timeout: timeoutMs });
  await page.locator(".detail-hero-card h3").filter({ hasText: hospitalName }).waitFor({ timeout: timeoutMs });
}

async function createRemarkByUI({ page, projectId, hospitalName, updateId, content, timeoutMs }) {
  await openLedgerProject(page, projectId, hospitalName, timeoutMs);
  await page.evaluate((remarkText) => {
    window.__codexOriginalPrompt = window.prompt;
    window.prompt = () => String(remarkText || "");
  }, content);
  try {
    const payload = await waitForJsonResponse(page, {
      method: "POST",
      pathname: `/api/projects/${projectId}/remarks`,
      timeoutMs,
      trigger: () =>
        page
          .locator(`button[data-create-project-remark="${projectId}"][data-update-id="${updateId}"]`)
          .click({ timeout: timeoutMs }),
    });
    return payload;
  } finally {
    await page.evaluate(() => {
      if (typeof window.__codexOriginalPrompt === "function") {
        window.prompt = window.__codexOriginalPrompt;
      }
      delete window.__codexOriginalPrompt;
    });
  }
}

async function markRemarkAsReadByUI({ page, projectId, hospitalName, remarkId, timeoutMs }) {
  await openLedgerProject(page, projectId, hospitalName, timeoutMs);
  const payload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: `/api/project-remarks/${remarkId}/read`,
    timeoutMs,
    trigger: () => page.locator(`button[data-remark-action="read"][data-remark-id="${remarkId}"]`).click({ timeout: timeoutMs }),
  });
  return payload;
}

async function fetchBootstrapFromPage(page) {
  const result = await page.evaluate(async ({ tokenKey }) => {
    const token = localStorage.getItem(tokenKey) || "";
    if (!token) {
      return { ok: false, error: "Missing auth token." };
    }
    const response = await fetch("/api/bootstrap", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();
    return { ok: response.ok, status: response.status, payload };
  }, { tokenKey: AUTH_TOKEN_KEY });
  if (!result?.ok) {
    fail(result?.payload?.error || result?.error || `Failed to fetch bootstrap. status=${result?.status || "unknown"}`);
  }
  return result.payload;
}

function summarizeManagerBootstrap(plan, bootstrap) {
  const expectedAccounts = new Set(plan.accounts.map((item) => item.account));
  const expectedHospitals = new Set(plan.specialistPlans.map((item) => item.hospitalName));
  const visibleUsers = Array.isArray(bootstrap?.management?.visibleUsers) ? bootstrap.management.visibleUsers : [];
  const visibleProjects = Array.isArray(bootstrap?.projects) ? bootstrap.projects : [];
  const matchedUsers = visibleUsers.filter((item) => expectedAccounts.has(normalizeAccount(item?.account)));
  const matchedProjects = visibleProjects.filter((item) => expectedHospitals.has(clipText(item?.hospital?.name, 120)));
  return {
    matchedUserCount: matchedUsers.length,
    matchedProjectCount: matchedProjects.length,
  };
}

function verifyRunStore(context, plan, store, executedDayCount) {
  const createdUsers = plan.accounts.map((item) => {
    const matched = (store.users || []).find((user) => normalizeAccount(user?.account) === item.account);
    if (!matched) {
      fail(`最终校验失败：未找到账号 ${item.account}`);
    }
    return matched;
  });
  const roleCounts = createdUsers.reduce((acc, user) => {
    const role = clipText(user?.role, 40);
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  if ((roleCounts.manager || 0) !== 1 || (roleCounts.supervisor || 0) !== 2 || (roleCounts.specialist || 0) !== 10) {
    fail(`最终校验失败：角色分布不正确 ${JSON.stringify(roleCounts)}`);
  }

  const userIdByAccount = new Map(createdUsers.map((user) => [normalizeAccount(user.account), user.id]));
  const rawProjects = store.projects || [];
  const rawUpdates = store.updates || [];
  const rawRemarks = store.remarks || [];
  const rawHospitals = store.hospitals || [];
  let createdProjectCount = 0;
  let createdUpdateCount = 0;
  let createdRemarkCount = 0;

  for (const specialistPlan of plan.specialistPlans) {
    const executedUpdates = specialistPlan.updatePlans.filter((item) => item.dayIndex < executedDayCount);
    const executedRemarks = specialistPlan.remarkActions.filter(
      (item) => specialistPlan.updatePlans[item.updateIndex]?.dayIndex < executedDayCount,
    );
    if (!executedUpdates.length) {
      continue;
    }
    const hospital = rawHospitals.find((item) => clipText(item?.name, 120) === specialistPlan.hospitalName);
    if (!hospital) {
      fail(`最终校验失败：未找到医院 ${specialistPlan.hospitalName}`);
    }
    const project = rawProjects.find(
      (item) =>
        item.hospitalId === hospital.id &&
        item.ownerUserId === userIdByAccount.get(specialistPlan.account),
    );
    if (!project) {
      fail(`最终校验失败：未找到项目 ${specialistPlan.hospitalName}`);
    }
    createdProjectCount += 1;
    const updates = rawUpdates.filter(
      (item) =>
        item.projectId === project.id &&
        item.createdByUserId === userIdByAccount.get(specialistPlan.account) &&
        executedUpdates.map((updateItem) => updateItem.visitDate).includes(clipText(item.visitDate, 10)),
    );
    if (updates.length !== executedUpdates.length) {
      fail(`最终校验失败：${specialistPlan.account} 的项目更新数不是 ${executedUpdates.length}，而是 ${updates.length}`);
    }
    createdUpdateCount += updates.length;
    const remarks = rawRemarks.filter(
      (item) =>
        item.projectId === project.id &&
        item.toUserId === userIdByAccount.get(specialistPlan.account),
    );
    if (remarks.length !== executedRemarks.length) {
      fail(`最终校验失败：${specialistPlan.account} 的主管留言数不是 ${executedRemarks.length}，而是 ${remarks.length}`);
    }
    createdRemarkCount += remarks.length;
  }

  return {
    createdUserCount: createdUsers.length,
    createdProjectCount,
    createdUpdateCount,
    createdRemarkCount,
    executedDayCount,
    dateRange: plan.dateRange.slice(0, executedDayCount),
  };
}

function renderSeedReport(context, plan, verificationSummary) {
  const accountRows = plan.accounts.map((item) => {
    const linkedProject = plan.specialistPlans.find((project) => project.account === item.account);
    const projectLabel = linkedProject ? linkedProject.hospitalName : "--";
    return `| ${ROLE_LABELS[item.role]} | ${REGION_LABELS[item.regionId] || item.regionId} | ${item.name} | ${item.account} | ${item.password} | ${projectLabel} |`;
  }).join("\n");
  return [
    `# 测试服真实风格造数报告`,
    ``,
    `- 执行时间：${nowIso()}`,
    `- 目标地址：${context.baseUrl}`,
    `- 业务日期范围：${verificationSummary.dateRange[0]} 至 ${verificationSummary.dateRange[verificationSummary.dateRange.length - 1]}`,
    `- 推进天数：${verificationSummary.executedDayCount}`,
    `- 新增用户：${verificationSummary.createdUserCount}`,
    `- 新增项目：${verificationSummary.createdProjectCount}`,
    `- 新增纪要：${verificationSummary.createdUpdateCount}`,
    `- 新增主管留言：${verificationSummary.createdRemarkCount}`,
    `- 成功后回滚：${context.options.rollbackOnSuccess ? "是" : "否"}`,
    ``,
    `## 账号与密码`,
    ``,
    `| 角色 | 区域 | 姓名 | 账号 | 密码 | 项目 |`,
    `| --- | --- | --- | --- | --- | --- |`,
    accountRows,
    ``,
    `## 日期分布`,
    ``,
    plan.specialistPlans
      .map((item) => {
        const executedUpdates = item.updatePlans
          .filter((planItem) => verificationSummary.dateRange.includes(planItem.visitDate))
          .map((planItem) => planItem.visitDate);
        if (!executedUpdates.length) {
          return "";
        }
        return `- ${item.name} / ${item.hospitalName}：${executedUpdates.join("、")}`;
      })
      .filter(Boolean)
      .join("\n"),
    ``,
  ].join("\n");
}

function renderErrorReport(context, error, rollbackError = null) {
  return [
    `# 测试服真实风格造数失败报告`,
    ``,
    `- 失败时间：${nowIso()}`,
    `- 当前阶段：${context.phase}`,
    `- 当前日期：${context.currentDate || "--"}`,
    `- 当前账号：${context.currentActor || "--"}`,
    `- 当前项目：${context.currentProject || "--"}`,
    `- 原始错误：${error instanceof Error ? error.stack || error.message : String(error)}`,
    `- 回滚结果：${JSON.stringify(context.rollback)}`,
    `- 回滚错误：${rollbackError ? rollbackError.stack || rollbackError.message : "无"}`,
    ``,
  ].join("\n");
}

async function registerAccounts(context, plan) {
  const registered = [];
  for (const accountPlan of plan.accounts) {
    setPhase(context, "register", { currentActor: accountPlan.account, currentProject: "" });
    const session = await withTracedSession(context, `register-${accountPlan.account}`);
    try {
      const payload = await registerByUI({
        page: session.page,
        baseUrl: context.baseUrl,
        spec: accountPlan,
        timeoutMs: context.options.timeoutMs,
      });
      accountPlan.userId = payload?.user?.id || "";
      accountPlan.token = payload?.token || "";
      registered.push(accountPlan);
      await session.screenshot("success.png");
      recordProgress(context, "注册账号成功", {
        account: accountPlan.account,
        role: accountPlan.role,
      });
    } finally {
      await session.close();
    }
  }
  return registered;
}

async function registerOrReuseAccounts(context, plan) {
  const registered = [];
  for (const accountPlan of plan.accounts) {
    setPhase(context, "register", { currentActor: accountPlan.account, currentProject: "" });
    const accountState = context.metadata.accounts.find((item) => item.account === accountPlan.account);
    if (accountPlan.existingUserId) {
      accountPlan.userId = accountPlan.existingUserId;
      const reuseSession = await withTracedSession(context, `login-existing-${accountPlan.account}`);
      try {
        const payload = await loginByUI({
          page: reuseSession.page,
          baseUrl: context.baseUrl,
          account: accountPlan.account,
          password: accountPlan.password,
          displayName: accountPlan.name,
          timeoutMs: context.options.timeoutMs,
        });
        accountPlan.token = payload?.token || "";
        registered.push(accountPlan);
        if (accountState) {
          accountState.status = "existing_reused";
          accountState.userId = accountPlan.userId;
        }
        recordProgress(context, "复用现有账号成功", {
          account: accountPlan.account,
          role: accountPlan.role,
        });
      } finally {
        await reuseSession.close();
      }
      continue;
    }

    const session = await withTracedSession(context, `register-${accountPlan.account}`);
    try {
      const payload = await registerByUI({
        page: session.page,
        baseUrl: context.baseUrl,
        spec: accountPlan,
        timeoutMs: context.options.timeoutMs,
      });
      accountPlan.userId = payload?.user?.id || "";
      accountPlan.token = payload?.token || "";
      registered.push(accountPlan);
      if (accountState) {
        accountState.status = "registered";
        accountState.userId = accountPlan.userId;
      }
      await session.screenshot("success.png");
      recordProgress(context, "注册账号成功", {
        account: accountPlan.account,
        role: accountPlan.role,
      });
    } finally {
      await session.close();
    }
  }
  return registered;
}

async function registerOrReuseAccountsViaApi(context, plan) {
  const registered = [];
  for (const accountPlan of plan.accounts) {
    setPhase(context, "register", { currentActor: accountPlan.account, currentProject: "" });
    const accountState = context.metadata.accounts.find((item) => item.account === accountPlan.account);
    if (accountPlan.existingUserId) {
      accountPlan.userId = accountPlan.existingUserId;
      const payload = await requestJson({
        baseUrl: context.baseUrl,
        pathname: "/api/auth/login",
        method: "POST",
        body: {
          account: accountPlan.account,
          password: accountPlan.password,
        },
      });
      accountPlan.token = payload?.token || "";
      registered.push(accountPlan);
      if (accountState) {
        accountState.status = "existing_reused";
        accountState.userId = accountPlan.userId;
      }
      recordProgress(context, "复用现有账号成功", {
        account: accountPlan.account,
        role: accountPlan.role,
      });
      continue;
    }

    const payload = await requestJson({
      baseUrl: context.baseUrl,
      pathname: "/api/auth/register",
      method: "POST",
      body: {
        name: accountPlan.name,
        account: accountPlan.account,
        password: accountPlan.password,
        role: accountPlan.role,
        regionId: accountPlan.regionId,
      },
    });
    accountPlan.userId = payload?.user?.id || "";
    accountPlan.token = payload?.token || "";
    registered.push(accountPlan);
    if (accountState) {
      accountState.status = "registered";
      accountState.userId = accountPlan.userId;
    }
    recordProgress(context, "接口注册账号成功", {
      account: accountPlan.account,
      role: accountPlan.role,
    });
  }
  return registered;
}

async function assignSpecialistsToSupervisors(context, plan) {
  const manager = plan.accounts.find((item) => item.role === "manager");
  const eastSupervisor = plan.accounts.find((item) => item.role === "supervisor" && item.regionId === "region-east");
  const centralSupervisor = plan.accounts.find((item) => item.role === "supervisor" && item.regionId === "region-central");
  assert(manager?.token, "缺少经理 token，无法配置主管归属。");
  assert(eastSupervisor?.userId && centralSupervisor?.userId, "缺少主管用户 ID，无法配置主管归属。");

  for (const specialistPlan of plan.specialistPlans) {
    setPhase(context, "assign-supervisor", { currentActor: specialistPlan.account });
    const specialist = plan.accounts.find((item) => item.account === specialistPlan.account);
    assert(specialist?.userId, `缺少专员用户 ID：${specialistPlan.account}`);
    const supervisorUserId = specialistPlan.regionId === "region-east" ? eastSupervisor.userId : centralSupervisor.userId;
    await requestJson({
      baseUrl: context.baseUrl,
      pathname: `/api/users/${encodeURIComponent(specialist.userId)}`,
      method: "PATCH",
      token: manager.token,
      body: {
        regionId: specialistPlan.regionId,
        supervisorUserId,
      },
    });
    specialistPlan.supervisorUserId = supervisorUserId;
    recordProgress(context, "专员主管归属已配置", {
      specialistAccount: specialistPlan.account,
      supervisorUserId,
    });
  }
}

async function createProjectAndSubmitUpdate(context, specialistPlan, updatePlan) {
  setPhase(context, "specialist-update", {
    currentActor: specialistPlan.account,
    currentProject: specialistPlan.hospitalName,
  });
  const session = await withTracedSession(
    context,
    `${updatePlan.visitDate}-${specialistPlan.account}-update-${updatePlan.updateIndex + 1}`,
  );
  try {
    await loginByUI({
      page: session.page,
      baseUrl: context.baseUrl,
      account: specialistPlan.account,
      password: specialistPlan.password,
      displayName: specialistPlan.name,
      timeoutMs: context.options.timeoutMs,
    });
    if (!specialistPlan.projectId) {
      const creation = await createHospitalProject({
        page: session.page,
        hospitalName: specialistPlan.hospitalName,
        city: specialistPlan.city,
        departmentName: specialistPlan.department,
        timeoutMs: context.options.timeoutMs,
      });
      specialistPlan.projectId = creation?.project?.id || "";
      recordProgress(context, "专员创建项目成功", {
        account: specialistPlan.account,
        hospitalName: specialistPlan.hospitalName,
        projectId: specialistPlan.projectId,
      });
    }
    const result = await submitIntakeNote({
      page: session.page,
      projectId: specialistPlan.projectId,
      hospitalName: specialistPlan.hospitalName,
      noteText: updatePlan.note,
      timeoutMs: context.options.timeoutMs,
      intakeTimeoutMs: context.options.intakeTimeoutMs,
    });
    updatePlan.updateId = result?.commitPayload?.update?.id || "";
    await session.screenshot(`update-${updatePlan.updateIndex + 1}.png`);
    recordProgress(context, "专员提交纪要成功", {
      account: specialistPlan.account,
      hospitalName: specialistPlan.hospitalName,
      updateId: updatePlan.updateId,
      visitDate: updatePlan.visitDate,
    });
  } finally {
    await session.close();
  }
}

async function createSupervisorRemark(context, specialistPlan, updatePlan, remarkAction, remarkIndex) {
  const supervisor = planSupervisorForSpecialist(context, specialistPlan);
  setPhase(context, "supervisor-remark", {
    currentActor: supervisor.account,
    currentProject: specialistPlan.hospitalName,
  });
  const session = await withTracedSession(
    context,
    `${updatePlan.visitDate}-${supervisor.account}-remark-${specialistPlan.account}-${remarkIndex + 1}`,
  );
  try {
    await loginByUI({
      page: session.page,
      baseUrl: context.baseUrl,
      account: supervisor.account,
      password: supervisor.password,
      displayName: supervisor.name,
      timeoutMs: context.options.timeoutMs,
    });
    const payload = await createRemarkByUI({
      page: session.page,
      projectId: specialistPlan.projectId,
      hospitalName: specialistPlan.hospitalName,
      updateId: updatePlan.updateId,
      content: remarkAction.content,
      timeoutMs: context.options.timeoutMs,
    });
    remarkAction.remarkId = payload?.remark?.id || "";
    await session.screenshot(`remark-${remarkIndex + 1}.png`);
    recordProgress(context, "主管留言成功", {
      supervisorAccount: supervisor.account,
      specialistAccount: specialistPlan.account,
      remarkId: remarkAction.remarkId,
      updateId: updatePlan.updateId,
    });
  } finally {
    await session.close();
  }
}

function planSupervisorForSpecialist(context, specialistPlan) {
  const supervisor = context.executionPlan.accounts.find(
    (item) => item.role === "supervisor" && item.account === specialistPlan.supervisorAccount,
  );
  assert(supervisor, `未找到专员 ${specialistPlan.account} 对应的主管账号。`);
  return supervisor;
}

async function markRemarkRead(context, specialistPlan, remarkAction, remarkIndex) {
  setPhase(context, "specialist-read-remark", {
    currentActor: specialistPlan.account,
    currentProject: specialistPlan.hospitalName,
  });
  const session = await withTracedSession(
    context,
    `${specialistPlan.account}-read-${remarkIndex + 1}-${remarkAction.remarkId}`,
  );
  try {
    await loginByUI({
      page: session.page,
      baseUrl: context.baseUrl,
      account: specialistPlan.account,
      password: specialistPlan.password,
      displayName: specialistPlan.name,
      timeoutMs: context.options.timeoutMs,
    });
    await markRemarkAsReadByUI({
      page: session.page,
      projectId: specialistPlan.projectId,
      hospitalName: specialistPlan.hospitalName,
      remarkId: remarkAction.remarkId,
      timeoutMs: context.options.timeoutMs,
    });
    await session.screenshot(`read-${remarkIndex + 1}.png`);
    recordProgress(context, "专员标记留言已读成功", {
      specialistAccount: specialistPlan.account,
      remarkId: remarkAction.remarkId,
    });
  } finally {
    await session.close();
  }
}

async function managerDailyValidation(context, plan, dateText) {
  const manager = plan.accounts.find((item) => item.role === "manager");
  setPhase(context, "manager-validate", { currentDate: dateText, currentActor: manager.account, currentProject: "" });
  const session = await withTracedSession(context, `${dateText}-manager-validate`);
  try {
    await loginByUI({
      page: session.page,
      baseUrl: context.baseUrl,
      account: manager.account,
      password: manager.password,
      displayName: manager.name,
      timeoutMs: context.options.timeoutMs,
    });
    const bootstrap = await fetchBootstrapFromPage(session.page);
    const summary = summarizeManagerBootstrap(plan, bootstrap);
    if (summary.matchedUserCount < plan.accounts.length) {
      fail(`经理视角校验失败：可见新增账号数 ${summary.matchedUserCount}，预期至少 ${plan.accounts.length}`);
    }
    await session.screenshot("manager.png");
    recordProgress(context, "经理视角日检通过", {
      date: dateText,
      matchedUserCount: summary.matchedUserCount,
      matchedProjectCount: summary.matchedProjectCount,
    });
  } finally {
    await session.close();
  }
}

async function executeDay(context, plan, dateText, dayIndex) {
  setPhase(context, "day-start", { currentDate: dateText, currentActor: "", currentProject: "" });
  setSimulationClock(context, dateText, dayIndex);
  recordProgress(context, "开始执行当日造数", { date: dateText });

  for (const specialistPlan of plan.specialistPlans) {
    const updatePlan = specialistPlan.updatePlans.find((item) => item.dayIndex === dayIndex);
    if (updatePlan) {
      await createProjectAndSubmitUpdate(context, specialistPlan, updatePlan);
    }
  }

  for (const specialistPlan of plan.specialistPlans) {
    const dueRemarkActions = specialistPlan.remarkActions
      .map((item, index) => ({ ...item, remarkIndex: index }))
      .filter((item) => {
        const updatePlan = specialistPlan.updatePlans[item.updateIndex];
        return updatePlan && updatePlan.dayIndex === dayIndex;
      });
    for (const remarkAction of dueRemarkActions) {
      await createSupervisorRemark(
        context,
        specialistPlan,
        specialistPlan.updatePlans[remarkAction.updateIndex],
        remarkAction,
        remarkAction.remarkIndex,
      );
      if (remarkAction.markRead) {
        await markRemarkRead(context, specialistPlan, remarkAction, remarkAction.remarkIndex);
      }
    }
  }

  await managerDailyValidation(context, plan, dateText);
}

async function runWorkflow(context) {
  setPhase(context, "preflight");
  const currentHealth = await waitForHealth(context.baseUrl, context.options.timeoutMs * 2, false);
  assert(currentHealth?.ok === true, "健康检查失败。");
  assert(currentHealth?.configured === true, "Responses API 未配置。");
  assert(currentHealth?.simulation?.enabled === false, "测试服当前已处于模拟时钟模式，不能直接执行。");
  context.metadata.currentHealth = currentHealth;

  const endDate = clipText(currentHealth?.simulation?.currentDate, 10);
  assert(endDate, "健康检查未返回当前业务日期。");
  const fullDateRange = buildSevenDayWindow(endDate);
  const executedDateRange = selectExecutedDates(fullDateRange, context.options.dayCount);
  context.metadata.plannedDates = fullDateRange;
  context.metadata.executedDates = executedDateRange;

  const storePath = path.join(context.repoRoot, "data", "store.json");
  const store = readJsonSafe(storePath);
  const plan = buildFixedExecutionPlan(store, fullDateRange);
  context.executionPlan = plan;
  context.metadata.accounts = plan.accounts.map((item) => ({
    role: item.role,
    regionId: item.regionId,
    name: item.name,
    account: item.account,
    password: item.password,
    existingUserId: item.existingUserId || "",
    status: item.existingUserId ? "existing" : "pending_register",
  }));
  context.metadata.plan = {
    accounts: plan.accounts.map((item) => ({
      role: item.role,
      regionId: item.regionId,
      name: item.name,
      account: item.account,
    })),
    projects: plan.specialistPlans.map((item) => ({
      account: item.account,
      hospitalName: item.hospitalName,
      dates: item.updatePlans.map((updatePlan) => updatePlan.visitDate),
    })),
  };
  writeJson(context.preflightPath, {
    healthBefore: currentHealth,
    fullDateRange,
    executedDateRange,
    plannedAccounts: context.metadata.plan.accounts,
    plannedProjects: context.metadata.plan.projects,
    rollbackOnSuccess: context.options.rollbackOnSuccess,
  });
  setRootOnlyFileMode(context.preflightPath);
  recordProgress(context, "前置检查通过", {
    currentDate: endDate,
    startDate: executedDateRange[0],
    endDate: executedDateRange[executedDateRange.length - 1],
    dayCount: context.options.dayCount,
  });

  await switchServerMode(context, { enableSimulation: true, restoreStore: false });
  await registerOrReuseAccountsViaApi(context, plan);
  await assignSpecialistsToSupervisors(context, plan);

  for (let dayIndex = 0; dayIndex < executedDateRange.length; dayIndex += 1) {
    await executeDay(context, plan, executedDateRange[dayIndex], dayIndex);
  }

  const finalStore = readJsonSafe(storePath);
  const verificationSummary = verifyRunStore(context, plan, finalStore, executedDateRange.length);
  await switchServerMode(context, {
    enableSimulation: false,
    restoreStore: context.options.rollbackOnSuccess,
  });

  const report = renderSeedReport(context, plan, verificationSummary);
  writeText(context.seedReportPath, report);
  setRootOnlyFileMode(context.seedReportPath);

  context.status = "completed";
  context.finishedAt = nowIso();
  context.metadata.summary = verificationSummary;
  writeRunState(context);

  const summary = {
    ok: true,
    artifactsDir: context.artifactsDir,
    reportPath: context.seedReportPath,
    verificationSummary,
    dateRange: executedDateRange,
    rollbackOnSuccess: context.options.rollbackOnSuccess,
  };
  console.log("REALISTIC_SEED_OK");
  console.log(JSON.stringify(summary, null, 2));
}

async function handleFailure(context, error) {
  let rollbackError = null;
  const shouldRollback =
    context.rollback.simulationEnabled ||
    context.backups.envExampleExisted ||
    context.backups.storeExisted ||
    context.backups.runtimeExisted;
  if (shouldRollback) {
    try {
      await switchServerMode(context, {
        enableSimulation: false,
        restoreStore: !context.options.noRollbackOnFailure,
      });
    } catch (innerError) {
      rollbackError = innerError;
    }
  }
  context.status = "failed";
  context.finishedAt = nowIso();
  context.metadata.error = {
    message: error instanceof Error ? error.message : String(error),
    rollbackError: rollbackError ? rollbackError.message : "",
  };
  writeRunState(context);
  const report = renderErrorReport(context, error, rollbackError);
  writeText(context.errorReportPath, report);
  setRootOnlyFileMode(context.errorReportPath);
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  if (rollbackError) {
    console.error(rollbackError instanceof Error ? rollbackError.stack || rollbackError.message : String(rollbackError));
  }
  process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv);
  const context = createRunContext(options);
  try {
    await runWorkflow(context);
  } catch (error) {
    await handleFailure(context, error);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
