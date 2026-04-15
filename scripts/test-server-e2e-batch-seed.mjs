import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const DEFAULT_TASK_ID = "200-10-2-1-e2e-20-20260412T002803";
const DEFAULT_BASE_URL = "http://39.106.23.28:3000";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_INTAKE_TIMEOUT_MS = 180000;
const REGION_CITY_POOLS = {
  "region-east": ["上海", "苏州", "杭州", "南京", "宁波", "无锡", "常州", "南通", "绍兴", "金华"],
  "region-central": ["武汉", "长沙", "郑州", "南昌", "襄阳", "洛阳", "株洲", "九江", "岳阳", "信阳"],
};
const DEPARTMENTS = ["疼痛科", "麻醉科", "康复科", "医务处", "护理部", "信息科", "门诊部", "设备科"];
const SCENARIOS = ["术后疼痛管理", "围术期随访", "康复协同管理", "门诊首诊建档", "科室台账管理"];
const BLOCKERS = ["价格方案还未完全确认", "联系人归口还不够统一", "试点排期还没有最终锁定", "培训名单还在等院办签字"];
const SUPPORT_ARTIFACTS = ["价格说明单页", "联系人整理模板", "护士培训SOP", "试点启动邮件模板"];
const NEXT_ACTIONS = ["补发报价说明", "回传联系人名单", "锁定培训排班", "确认试点时间表"];
const NEXT_STAGES = ["进入试点评估", "进入培训排期", "转入常规使用"];
const PRIMARY_CONTACTS = ["张主任", "李主任", "王主任", "赵主任", "陈主任", "周主任", "吴主任", "孙主任"];
const SECONDARY_CONTACTS = ["刘护士长", "黄护士长", "许老师", "马老师", "胡工程师", "朱秘书", "高老师", "林主任"];
const VISIT_PRESETS = ["today", "yesterday", "day_before_yesterday"];
const VISIT_LABELS = {
  today: "今天",
  yesterday: "昨天",
  day_before_yesterday: "前天",
};

function fail(message) {
  throw new Error(String(message || "Unknown error."));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing prerequisite file: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function clampInt(value, min, max, name) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    fail(`${name} must be a number.`);
  }
  const int = Math.trunc(num);
  if (int < min || int > max) {
    fail(`${name} must be between ${min} and ${max}. Got ${int}.`);
  }
  return int;
}

function parseArgs(argv) {
  const out = {
    mode: "",
    baseUrl: DEFAULT_BASE_URL,
    taskId: DEFAULT_TASK_ID,
    artifactsRoot: "",
    headful: false,
    slowMoMs: 0,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    intakeTimeoutMs: DEFAULT_INTAKE_TIMEOUT_MS,
    managerAccount: "",
    managerPassword: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = String(argv[i] || "");
    if (!token.startsWith("--")) {
      fail(`Unknown argument (expected --key): ${token}`);
    }
    const key = token.slice(2);
    const hasValue = i + 1 < argv.length && !String(argv[i + 1]).startsWith("--");
    const value = hasValue ? String(argv[i + 1]) : "";

    const bump = () => {
      if (!hasValue) {
        fail(`Missing value for --${key}`);
      }
      i += 1;
    };

    if (key === "mode") {
      bump();
      out.mode = value;
      continue;
    }
    if (key === "base-url") {
      bump();
      out.baseUrl = value;
      continue;
    }
    if (key === "task-id") {
      bump();
      out.taskId = value;
      continue;
    }
    if (key === "artifacts-root") {
      bump();
      out.artifactsRoot = value;
      continue;
    }
    if (key === "headful") {
      out.headful = true;
      continue;
    }
    if (key === "slow-mo-ms") {
      bump();
      out.slowMoMs = clampInt(value, 0, 3000, "slowMoMs");
      continue;
    }
    if (key === "timeout-ms") {
      bump();
      out.timeoutMs = clampInt(value, 1000, 180000, "timeoutMs");
      continue;
    }
    if (key === "intake-timeout-ms") {
      bump();
      out.intakeTimeoutMs = clampInt(value, 5000, 600000, "intakeTimeoutMs");
      continue;
    }
    if (key === "manager-account") {
      bump();
      out.managerAccount = value;
      continue;
    }
    if (key === "manager-password") {
      bump();
      out.managerPassword = value;
      continue;
    }
    fail(`Unknown argument: --${key}`);
  }

  out.mode = String(out.mode || "").trim().toLowerCase();
  if (!out.mode) {
    fail("Missing required argument: --mode (plan|execute|verify)");
  }
  if (!["plan", "execute", "verify"].includes(out.mode)) {
    fail(`Invalid --mode: ${out.mode}. Expected plan|execute|verify.`);
  }
  if (!String(out.baseUrl || "").trim()) {
    fail("baseUrl is required.");
  }
  if (!String(out.taskId || "").trim()) {
    fail("taskId is required.");
  }

  return out;
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    fail(`baseUrl must start with http:// or https://. Got: ${baseUrl}`);
  }
  return trimmed;
}

function buildRunSlug(taskId) {
  const match = String(taskId || "").match(/(\d{8})T(\d{6})/);
  if (match) {
    return `e2e${match[1]}${match[2]}`.toLowerCase();
  }
  const hash = crypto.createHash("sha1").update(String(taskId || "")).digest("hex").slice(0, 12);
  return `e2e${hash}`.toLowerCase();
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function buildAccountSpec(role, index, runSlug, regionId) {
  const roleLabel = role === "manager" ? "经理" : role === "supervisor" ? "主管" : "专员";
  const roleCode = role === "manager" ? "mgr" : role === "supervisor" ? "sup" : "sp";
  return {
    role,
    index,
    regionId,
    account: `${runSlug}-${roleCode}${pad2(index)}`,
    displayName: `E2E${roleLabel}${pad2(index)}-${runSlug}`,
  };
}

function buildHospitalName(hospitalPrefix, sequence, city, department) {
  return `${hospitalPrefix}${pad3(sequence)} ${city}${department}推进样本院`;
}

function buildNoteText({ sequence, hospitalName, city, department, visitPreset }) {
  const scenario = SCENARIOS[(sequence - 1) % SCENARIOS.length];
  const blocker = BLOCKERS[(sequence - 1) % BLOCKERS.length];
  const supportArtifact = SUPPORT_ARTIFACTS[(sequence - 1) % SUPPORT_ARTIFACTS.length];
  const nextAction = NEXT_ACTIONS[(sequence - 1) % NEXT_ACTIONS.length];
  const nextStage = NEXT_STAGES[(sequence - 1) % NEXT_STAGES.length];
  const primaryContact = PRIMARY_CONTACTS[(sequence - 1) % PRIMARY_CONTACTS.length];
  const secondaryContact = SECONDARY_CONTACTS[(sequence - 1) % SECONDARY_CONTACTS.length];
  const visitLabel = VISIT_LABELS[visitPreset] || "今天";
  const trialCount = (sequence % 3) + 1;
  const needsSupervisor = sequence % 4 === 0;
  const supervisorLine = needsSupervisor
    ? "院方希望下次由主管一同沟通院办口径。"
    : "本轮暂不需要上级出面，先由我继续跟进。";

  return [
    `${visitLabel}在${city}拜访${hospitalName}${department}，与${primaryContact}、${secondaryContact}确认试点诉求。`,
    `对方认可系统在${scenario}场景的价值，愿意先安排${trialCount}例试录并指定专人跟进。`,
    `当前卡点是${blocker}，院方要求我们补充${supportArtifact}后再走内部确认。`,
    `${supervisorLine}`,
    `我已约定下周前完成${nextAction}，若沟通顺利，项目预计可${nextStage}。`,
  ].join("");
}

function buildDeterministicPlan({ taskId, baseUrl }) {
  const runSlug = buildRunSlug(taskId);
  const password = `E2ESeed!${runSlug}`;
  if (password.length < 6) {
    fail("Internal error: planned password is too short.");
  }

  const accounts = [
    buildAccountSpec("manager", 1, runSlug, "region-east"),
    buildAccountSpec("supervisor", 1, runSlug, "region-east"),
    buildAccountSpec("supervisor", 2, runSlug, "region-central"),
  ];
  for (let i = 1; i <= 10; i += 1) {
    accounts.push(buildAccountSpec("specialist", i, runSlug, i <= 5 ? "region-east" : "region-central"));
  }

  const hospitalPrefix = `E2E-${runSlug}-H`;
  const specialists = accounts.filter((account) => account.role === "specialist");
  const workItems = [];
  let sequence = 1;
  for (const specialist of specialists) {
    const cityPool = REGION_CITY_POOLS[specialist.regionId];
    for (let localIndex = 0; localIndex < 20; localIndex += 1) {
      const city = cityPool[localIndex % cityPool.length];
      const department = DEPARTMENTS[(sequence - 1) % DEPARTMENTS.length];
      const visitDatePreset = VISIT_PRESETS[(sequence - 1) % VISIT_PRESETS.length];
      const hospitalName = buildHospitalName(hospitalPrefix, sequence, city, department);
      workItems.push({
        workItemId: `wi-${pad3(sequence)}`,
        specialistAccount: specialist.account,
        specialistDisplayName: specialist.displayName,
        specialistRegionId: specialist.regionId,
        hospitalIndex: sequence,
        hospitalPrefix,
        hospitalCode: `${hospitalPrefix}${pad3(sequence)}`,
        hospitalName,
        city,
        department,
        visitDatePreset,
        noteText: buildNoteText({ sequence, hospitalName, city, department, visitPreset: visitDatePreset }),
      });
      sequence += 1;
    }
  }

  const regionStrategy = {
    requiredRegions: ["region-east", "region-central"],
    manager: "region-east",
    supervisors: ["region-east", "region-central"],
    specialists: [
      { range: [1, 5], regionId: "region-east" },
      { range: [6, 10], regionId: "region-central" },
    ],
  };

  return {
    schemaVersion: 1,
    taskId,
    baseUrl,
    runSlug,
    password,
    hospitalPrefix,
    accounts,
    regionStrategy,
    workItems,
    counts: {
      managers: 1,
      supervisors: 2,
      specialists: 10,
      hospitals: 200,
      intakeNotes: 200,
      workItems: 200,
      perSpecialist: 20,
    },
    createdAt: new Date().toISOString(),
  };
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(
        `Expected JSON from ${url} but received invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!res.ok) {
      throw new Error(payload?.error || `HTTP ${res.status} from ${url}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, body, timeoutMs, allowedStatuses = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      fail(`Expected JSON from ${url} but received invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!res.ok && !allowedStatuses.includes(res.status)) {
      throw new Error(payload?.error || `HTTP ${res.status} from ${url}`);
    }
    return {
      ok: res.ok,
      status: res.status,
      payload,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkChromiumAvailable() {
  const browser = await chromium.launch({ headless: true });
  await browser.close();
}

function resolveProjectRoot() {
  const filename = fileURLToPath(import.meta.url);
  const dir = path.dirname(filename);
  return path.resolve(dir, "..");
}

function resolveArtifactsRoot({ projectRoot, taskId, artifactsRootOverride }) {
  if (artifactsRootOverride) {
    return path.resolve(artifactsRootOverride);
  }
  return path.join(projectRoot, "output", "playwright", taskId);
}

function assertPlannedCounts(plan) {
  const accounts = Array.isArray(plan?.accounts) ? plan.accounts : [];
  const workItems = Array.isArray(plan?.workItems) ? plan.workItems : [];
  const byRole = new Map();
  for (const account of accounts) {
    byRole.set(account.role, (byRole.get(account.role) || 0) + 1);
  }
  if ((byRole.get("manager") || 0) !== 1) {
    fail(`Plan must contain exactly 1 manager. Got ${byRole.get("manager") || 0}.`);
  }
  if ((byRole.get("supervisor") || 0) !== 2) {
    fail(`Plan must contain exactly 2 supervisors. Got ${byRole.get("supervisor") || 0}.`);
  }
  if ((byRole.get("specialist") || 0) !== 10) {
    fail(`Plan must contain exactly 10 specialists. Got ${byRole.get("specialist") || 0}.`);
  }
  if (workItems.length !== 200) {
    fail(`Plan must contain exactly 200 work items. Got ${workItems.length}.`);
  }
  const perSpecialist = new Map();
  const hospitalNames = new Set();
  for (const item of workItems) {
    const key = String(item.specialistAccount || "");
    perSpecialist.set(key, (perSpecialist.get(key) || 0) + 1);
    const hospitalName = String(item.hospitalName || "").trim();
    if (!hospitalName) {
      fail(`Work item ${item.workItemId || "(unknown)"} is missing hospitalName.`);
    }
    if (hospitalNames.has(hospitalName)) {
      fail(`Plan hospitalName must be unique. Duplicate: ${hospitalName}`);
    }
    hospitalNames.add(hospitalName);
    if (!VISIT_PRESETS.includes(item.visitDatePreset)) {
      fail(`Invalid visitDatePreset for ${item.workItemId || hospitalName}: ${item.visitDatePreset}`);
    }
    const noteText = String(item.noteText || "").trim();
    if (!noteText) {
      fail(`Work item ${item.workItemId || hospitalName} is missing noteText.`);
    }
    if (noteText.length > 300) {
      fail(`Work item ${item.workItemId || hospitalName} noteText must be <= 300 characters. Got ${noteText.length}.`);
    }
  }
  for (const [account, count] of perSpecialist.entries()) {
    if (count !== 20) {
      fail(`Plan must assign 20 work items per specialist. ${account} has ${count}.`);
    }
  }
  if (perSpecialist.size !== 10) {
    fail(`Plan must assign work items to 10 specialists. Got ${perSpecialist.size}.`);
  }
}

function resolveDesiredRegionId(plan, accountSpec) {
  const required = plan?.regionStrategy?.requiredRegions || [];
  if (!Array.isArray(required) || required.length < 2) {
    fail("Plan regionStrategy.requiredRegions must list required regions.");
  }
  if (accountSpec.role === "manager") {
    return plan.regionStrategy.manager;
  }
  if (accountSpec.role === "supervisor") {
    return plan.regionStrategy.supervisors[accountSpec.index - 1] || plan.regionStrategy.supervisors[0];
  }
  if (accountSpec.role === "specialist") {
    for (const rule of plan.regionStrategy.specialists) {
      const [from, to] = rule.range || [];
      if (accountSpec.index >= from && accountSpec.index <= to) {
        return rule.regionId;
      }
    }
  }
  fail(`Cannot resolve desired region for role=${accountSpec.role}, index=${accountSpec.index}`);
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
  if (!response.ok) {
    fail(payload?.error || `HTTP ${response.status} from ${pathname}`);
  }
  return payload;
}

async function ensureAuthDialogVisible(page, timeoutMs) {
  await page.locator("#authDialog").waitFor({ state: "visible", timeout: timeoutMs });
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

async function loginByUI({ page, baseUrl, account, password, timeoutMs }) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await ensureAuthDialogVisible(page, timeoutMs);
  await page.locator("#authModeLoginButton").click({ timeout: timeoutMs });
  await page.locator("#authLoginAccountInput").fill(String(account || ""), { timeout: timeoutMs });
  await page.locator("#authLoginPasswordInput").fill(String(password || ""), { timeout: timeoutMs });
  return waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/auth/login",
    timeoutMs,
    trigger: () => page.locator("#authLoginSubmitButton").click({ timeout: timeoutMs }),
  });
}

async function registerByUI({ page, baseUrl, accountSpec, password, regionId, timeoutMs }) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await ensureAuthDialogVisible(page, timeoutMs);
  await page.locator("#authModeRegisterButton").click({ timeout: timeoutMs });
  await page.locator("#authRegisterNameInput").fill(String(accountSpec.displayName || ""), { timeout: timeoutMs });
  await page.locator("#authRegisterAccountInput").fill(String(accountSpec.account || ""), { timeout: timeoutMs });
  await page.locator("#authRegisterPasswordInput").fill(String(password || ""), { timeout: timeoutMs });
  await page.locator("#authRegisterRoleSelect").selectOption(String(accountSpec.role || ""), { timeout: timeoutMs });
  await page.locator("#authRegisterRegionSelect").selectOption(regionId, { timeout: timeoutMs });
  return waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/auth/register",
    timeoutMs,
    trigger: () => page.locator("#authRegisterSubmitButton").click({ timeout: timeoutMs }),
  });
}

async function assertSessionUserName(page, expectedDisplayName, timeoutMs) {
  await waitForSessionName(page, expectedDisplayName, timeoutMs);
}

async function clickMainTab(page, tabId, timeoutMs) {
  await page.locator(`#tabBar button[data-tab="${tabId}"]`).click({ timeout: timeoutMs });
}

async function createHospitalProject({ page, hospitalName, city, timeoutMs }) {
  await clickMainTab(page, "entry", timeoutMs);
  await page.locator("#projectAddButton").waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator("#projectAddButton").click({ timeout: timeoutMs });
  await page.locator("#projectModal").waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator("#newHospitalNameInput").fill(String(hospitalName || ""), { timeout: timeoutMs });
  await page.locator("#newHospitalCityInput").fill(String(city || ""), { timeout: timeoutMs });
  const payload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/projects",
    timeoutMs,
    trigger: () => page.locator("#newProjectSubmitButton").click({ timeout: timeoutMs }),
  });
  await page.locator("#projectModal").waitFor({ state: "hidden", timeout: timeoutMs });
  if (String(payload?.project?.hospital?.name || "") !== String(hospitalName || "")) {
    fail(`Created hospital mismatch. Expected ${hospitalName}, got ${payload?.project?.hospital?.name || "(empty)"}.`);
  }
  return payload;
}

async function selectProjectById({ page, projectId, expectedHospitalName, timeoutMs }) {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    fail("projectId is required for selection.");
  }
  await page.waitForFunction(
    ({ projectId }) => {
      const select = document.querySelector("#projectSelect");
      return Boolean(select) && [...select.options].some((opt) => String(opt.value || "").trim() === projectId);
    },
    { projectId: normalizedProjectId },
    { timeout: timeoutMs },
  );
  await page.selectOption("#projectSelect", normalizedProjectId, { timeout: timeoutMs });
  if (expectedHospitalName) {
    await page.waitForFunction(
      ({ projectId, hospitalName }) => {
        const select = document.querySelector("#projectSelect");
        if (!select) {
          return false;
        }
        const option = [...select.options].find((opt) => String(opt.value || "").trim() === projectId);
        return Boolean(option) && String(option.textContent || "").includes(hospitalName);
      },
      { projectId: normalizedProjectId, hospitalName: String(expectedHospitalName || "").trim() },
      { timeout: timeoutMs },
    );
  }
}

async function selectVisitDatePreset({ page, visitDatePreset, timeoutMs }) {
  const preset = String(visitDatePreset || "").trim();
  if (!VISIT_PRESETS.includes(preset)) {
    fail(`Invalid visitDatePreset: ${visitDatePreset}`);
  }
  await page.locator("#visitDatePreset").selectOption(preset, { timeout: timeoutMs });
}

async function submitIntakeNote({
  page,
  noteText,
  specialistDisplayName,
  expectedHospitalName,
  visitDatePreset,
  timeoutMs,
  intakeTimeoutMs,
}) {
  await selectVisitDatePreset({ page, visitDatePreset, timeoutMs });
  await page.locator("#noteInput").fill(String(noteText || ""), { timeout: timeoutMs });
  const previewPayload = await waitForJsonResponse(page, {
    method: "POST",
    pathname: "/api/intake/preview",
    timeoutMs: intakeTimeoutMs,
    trigger: () => page.locator("#submitButton").click({ timeout: timeoutMs }),
  });
  if (!previewPayload?.extraction) {
    fail(`Intake preview missing extraction for ${expectedHospitalName}.`);
  }

  const commitButton = page.locator("#intakeResult [data-intake-action='submit']").first();
  await commitButton.waitFor({ state: "visible", timeout: timeoutMs });
  try {
    await page.waitForFunction(
      () => {
        const button = document.querySelector("#intakeResult [data-intake-action='submit']");
        return Boolean(button) && !button.disabled;
      },
      undefined,
      { timeout: timeoutMs },
    );
  } catch (error) {
    const resultText = await page.locator("#intakeResult").innerText({ timeout: timeoutMs }).catch(() => "");
    fail(
      `Intake submit stayed disabled for ${expectedHospitalName}. ${resultText ? `Review output: ${resultText.slice(0, 300)}` : error instanceof Error ? error.message : String(error)}`,
    );
  }
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
  if (String(commitPayload?.project?.hospital?.name || "") !== expectedHospitalName) {
    fail(`Committed project mismatch for ${expectedHospitalName}.`);
  }
  const matchingUpdateCount = Array.isArray(commitPayload?.project?.updates)
    ? commitPayload.project.updates.filter((update) => String(update?.createdByName || "") === specialistDisplayName).length
    : 0;
  if (matchingUpdateCount < 1) {
    fail(`Committed intake did not create a visible update for ${expectedHospitalName}.`);
  }
  return { previewPayload, commitPayload };
}

async function fetchBootstrapFromPage({ page }) {
  const result = await page.evaluate(async ({ tokenKey }) => {
    const token = localStorage.getItem(tokenKey) || "";
    if (!token) {
      return { ok: false, error: "Missing auth token in localStorage." };
    }
    const response = await fetch("/api/bootstrap", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();
    return { ok: response.ok, status: response.status, payload };
  }, { tokenKey: "clinical-rollout-auth-token" });
  if (!result?.ok) {
    fail(result?.payload?.error || result?.error || `Failed to load bootstrap. status=${result?.status || "unknown"}`);
  }
  return result.payload;
}

function summarizeBootstrap(plan, bootstrap) {
  const expectedAccounts = new Map(plan.accounts.map((account) => [account.account, account]));
  const expectedHospitals = new Map(plan.workItems.map((item) => [item.hospitalName, item]));
  const visibleUsers = Array.isArray(bootstrap?.management?.visibleUsers) ? bootstrap.management.visibleUsers : [];
  const projects = Array.isArray(bootstrap?.projects) ? bootstrap.projects : [];
  const matchedUsers = visibleUsers.filter((user) => expectedAccounts.has(String(user?.account || "")));
  const missingUsers = [...expectedAccounts.keys()].filter(
    (account) => !matchedUsers.some((user) => String(user?.account || "") === account),
  );
  const matchedProjects = projects.filter((project) => expectedHospitals.has(String(project?.hospital?.name || "")));
  const projectByHospitalName = new Map(matchedProjects.map((project) => [String(project?.hospital?.name || ""), project]));
  const missingHospitals = [...expectedHospitals.keys()].filter((name) => !projectByHospitalName.has(name));
  const roleCounts = matchedUsers.reduce((acc, user) => {
    const role = String(user?.role || "");
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  const perSpecialist = plan.accounts
    .filter((account) => account.role === "specialist")
    .map((specialist) => {
      const expectedNames = plan.workItems
        .filter((item) => item.specialistAccount === specialist.account)
        .map((item) => item.hospitalName);
      const ownedProjects = expectedNames.map((name) => projectByHospitalName.get(name)).filter(Boolean);
      const ownershipMismatches = ownedProjects
        .filter((project) => String(project?.owner?.account || "") !== specialist.account)
        .map((project) => String(project?.hospital?.name || ""));
      const updateCount = ownedProjects.reduce((sum, project) => {
        const updates = Array.isArray(project?.updates) ? project.updates : [];
        return sum + updates.filter((update) => String(update?.createdByName || "") === specialist.displayName).length;
      }, 0);
      const projectsMissingUpdates = ownedProjects
        .filter((project) => !Array.isArray(project?.updates) || project.updates.length < 1)
        .map((project) => String(project?.hospital?.name || ""));
      return {
        account: specialist.account,
        displayName: specialist.displayName,
        regionId: specialist.regionId,
        ownedProjectCount: ownedProjects.length,
        updateCount,
        ownershipMismatches,
        projectsMissingUpdates,
      };
    });
  return {
    userCount: matchedUsers.length,
    missingUsers,
    roleCounts,
    projectCount: matchedProjects.length,
    missingHospitals,
    perSpecialist,
    totalSpecialistUpdateCount: perSpecialist.reduce((sum, item) => sum + item.updateCount, 0),
  };
}

function collectLiveRunState(plan, bootstrap) {
  const expectedAccounts = new Map(plan.accounts.map((account) => [account.account, account]));
  const expectedHospitals = new Map(plan.workItems.map((item) => [item.hospitalName, item]));
  const visibleUsers = Array.isArray(bootstrap?.management?.visibleUsers) ? bootstrap.management.visibleUsers : [];
  const projects = Array.isArray(bootstrap?.projects) ? bootstrap.projects : [];
  const existingAccounts = new Set(
    visibleUsers
      .map((user) => String(user?.account || "").trim())
      .filter((account) => expectedAccounts.has(account)),
  );
  const runProjects = projects.filter((project) => expectedHospitals.has(String(project?.hospital?.name || "")));
  const projectByHospitalName = new Map(runProjects.map((project) => [String(project?.hospital?.name || ""), project]));
  const completedWorkItemIds = new Set();
  for (const item of plan.workItems) {
    const project = projectByHospitalName.get(item.hospitalName);
    if (!project) {
      continue;
    }
    const ownerAccount = String(project?.owner?.account || "").trim();
    if (ownerAccount && ownerAccount !== item.specialistAccount) {
      fail(`Existing project owner mismatch for ${item.hospitalName}. Expected ${item.specialistAccount}, got ${ownerAccount}.`);
    }
    const matchingUpdateCount = Array.isArray(project?.updates)
      ? project.updates.filter((update) => String(update?.createdByName || "").trim() === item.specialistDisplayName).length
      : 0;
    if (matchingUpdateCount >= 1) {
      completedWorkItemIds.add(item.workItemId);
    }
  }
  return {
    existingAccounts,
    projectByHospitalName,
    completedWorkItemIds,
  };
}

function assertVerificationSummary(summary) {
  if (summary.userCount !== 13) {
    fail(`Expected 13 created users in live data. Got ${summary.userCount}. Missing: ${summary.missingUsers.join(", ")}`);
  }
  if ((summary.roleCounts.manager || 0) !== 1) {
    fail(`Expected 1 manager in live data. Got ${summary.roleCounts.manager || 0}.`);
  }
  if ((summary.roleCounts.supervisor || 0) !== 2) {
    fail(`Expected 2 supervisors in live data. Got ${summary.roleCounts.supervisor || 0}.`);
  }
  if ((summary.roleCounts.specialist || 0) !== 10) {
    fail(`Expected 10 specialists in live data. Got ${summary.roleCounts.specialist || 0}.`);
  }
  if (summary.projectCount !== 200) {
    fail(`Expected 200 created hospitals in live data. Got ${summary.projectCount}.`);
  }
  for (const specialist of summary.perSpecialist) {
    if (specialist.ownedProjectCount !== 20) {
      fail(`Expected 20 projects for ${specialist.account}. Got ${specialist.ownedProjectCount}.`);
    }
    if (specialist.updateCount !== 20) {
      fail(`Expected 20 committed notes for ${specialist.account}. Got ${specialist.updateCount}.`);
    }
    if (specialist.ownershipMismatches.length) {
      fail(`Ownership mismatch for ${specialist.account}: ${specialist.ownershipMismatches.join(", ")}`);
    }
    if (specialist.projectsMissingUpdates.length) {
      fail(`Projects without updates for ${specialist.account}: ${specialist.projectsMissingUpdates.join(", ")}`);
    }
  }
  if (summary.totalSpecialistUpdateCount !== 200) {
    fail(`Expected 200 total committed notes in live data. Got ${summary.totalSpecialistUpdateCount}.`);
  }
}

async function withTracedSession({ baseUrl, headful, slowMoMs, timeoutMs, tracePath, screenshotDir }) {
  ensureDir(path.dirname(tracePath));
  ensureDir(screenshotDir);

  const browser = await chromium.launch({ headless: !headful, slowMo: slowMoMs || 0 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

  const stop = async () => {
    try {
      await context.tracing.stop({ path: tracePath });
    } finally {
      await context.close();
      await browser.close();
    }
  };

  const screenshot = async (fileName) => {
    const target = path.join(screenshotDir, fileName);
    await page.screenshot({ path: target, fullPage: true });
    return target;
  };

  return { browser, context, page, stop, screenshot };
}

async function runPlanMode(args) {
  const projectRoot = resolveProjectRoot();
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const artifactsRoot = resolveArtifactsRoot({
    projectRoot,
    taskId: args.taskId,
    artifactsRootOverride: args.artifactsRoot,
  });
  ensureDir(artifactsRoot);

  const health = await fetchJson(`${baseUrl}/api/health`, args.timeoutMs);
  if (health?.ok !== true) {
    fail(`Health check failed: expected ok=true. Payload: ${JSON.stringify(health)}`);
  }
  if (health?.configured !== true) {
    fail(`Server is not configured (configured=false). authStatus=${health?.authStatus || "(empty)"}`);
  }

  const options = await fetchJson(`${baseUrl}/api/auth/options`, args.timeoutMs);
  const roleCodes = new Set((options?.roles || []).map((r) => r.code));
  for (const requiredRole of ["manager", "supervisor", "specialist"]) {
    if (!roleCodes.has(requiredRole)) {
      fail(`Missing required role in /api/auth/options: ${requiredRole}`);
    }
  }
  const regionIds = new Set((options?.regions || []).map((r) => r.id));
  for (const requiredRegion of ["region-east", "region-central"]) {
    if (!regionIds.has(requiredRegion)) {
      fail(`Missing required region in /api/auth/options: ${requiredRegion}`);
    }
  }

  try {
    await checkChromiumAvailable();
  } catch (error) {
    fail(
      `Failed to launch Chromium. Install browser binaries with "npx playwright install chromium". ${error instanceof Error ? error.message : String(error)}`.trim(),
    );
  }

  const plan = buildDeterministicPlan({ taskId: args.taskId, baseUrl });
  assertPlannedCounts(plan);

  const preflight = {
    taskId: args.taskId,
    baseUrl,
    node: process.version,
    playwright: {
      chromium: true,
    },
    serverHealth: health,
    authOptions: {
      roles: options?.roles || [],
      regions: options?.regions || [],
    },
    generatedAt: new Date().toISOString(),
  };

  writeJson(path.join(artifactsRoot, "preflight.json"), preflight);
  writeJson(path.join(artifactsRoot, "plan.json"), plan);

  return {
    artifactsRoot,
    planPath: path.join(artifactsRoot, "plan.json"),
    preflightPath: path.join(artifactsRoot, "preflight.json"),
    runSlug: plan.runSlug,
    hospitalPrefix: plan.hospitalPrefix,
    managerAccount: plan.accounts.find((a) => a.role === "manager")?.account || "",
    password: plan.password,
  };
}

async function runExecuteMode(args) {
  const projectRoot = resolveProjectRoot();
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const artifactsRoot = resolveArtifactsRoot({
    projectRoot,
    taskId: args.taskId,
    artifactsRootOverride: args.artifactsRoot,
  });

  const planPath = path.join(artifactsRoot, "plan.json");
  const plan = readJson(planPath);
  assertPlannedCounts(plan);
  if (normalizeBaseUrl(plan.baseUrl) !== baseUrl) {
    fail(`Plan baseUrl mismatch. Plan=${plan.baseUrl} args=${baseUrl}`);
  }
  const managerSpec = plan.accounts.find((account) => account.role === "manager");
  if (!managerSpec) {
    fail("Plan is missing manager account.");
  }

  const healthBefore = await fetchJson(`${baseUrl}/api/health`, args.timeoutMs);
  let liveRunState = {
    existingAccounts: new Set(),
    projectByHospitalName: new Map(),
    completedWorkItemIds: new Set(),
  };
  const existingManagerLogin = await postJson(
    `${baseUrl}/api/auth/login`,
    {
      account: managerSpec.account,
      password: plan.password,
    },
    args.timeoutMs,
    [401],
  );
  if (existingManagerLogin.ok) {
    liveRunState = collectLiveRunState(plan, existingManagerLogin.payload?.bootstrap);
    // eslint-disable-next-line no-console
    console.log(
      `[resume] existing accounts=${liveRunState.existingAccounts.size} existing projects=${liveRunState.projectByHospitalName.size} completed work items=${liveRunState.completedWorkItemIds.size}`,
    );
  }

  const screenshotsRoot = path.join(artifactsRoot, "screenshots");
  const tracesRoot = path.join(artifactsRoot, "traces");
  ensureDir(screenshotsRoot);
  ensureDir(tracesRoot);

  const startedAt = new Date().toISOString();
  const accountResults = [];
  const workItemResults = [];

  for (const accountSpec of plan.accounts) {
    if (liveRunState.existingAccounts.has(accountSpec.account)) {
      accountResults.push({
        role: accountSpec.role,
        account: accountSpec.account,
        displayName: accountSpec.displayName,
        regionId: resolveDesiredRegionId(plan, accountSpec),
        status: "already_exists",
      });
      // eslint-disable-next-line no-console
      console.log(`[register:skip] ${accountSpec.account}`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`[register] ${accountSpec.account} (${accountSpec.role})`);
    const regionId = resolveDesiredRegionId(plan, accountSpec);
    const screenshotDir = path.join(screenshotsRoot, accountSpec.account, "register");
    const tracePath = path.join(tracesRoot, accountSpec.account, "register-trace.zip");
    const session = await withTracedSession({
      baseUrl,
      headful: args.headful,
      slowMoMs: args.slowMoMs,
      timeoutMs: args.timeoutMs,
      tracePath,
      screenshotDir,
      });
      try {
        const payload = await registerByUI({
          page: session.page,
          baseUrl,
          accountSpec,
          password: plan.password,
          regionId,
          timeoutMs: args.timeoutMs,
        });
        await assertSessionUserName(session.page, accountSpec.displayName, args.timeoutMs);
        const screenshot = await session.screenshot("register-success.png");
        accountResults.push({
          role: accountSpec.role,
          account: accountSpec.account,
          displayName: accountSpec.displayName,
          regionId,
          status: "created",
          trace: tracePath,
          screenshot,
          userId: payload?.user?.id || "",
        });
        // eslint-disable-next-line no-console
        console.log(`[register:ok] ${accountSpec.account}`);
      } catch (error) {
        const shot = await session.screenshot("register-error.png").catch(() => "");
        accountResults.push({
          role: accountSpec.role,
        account: accountSpec.account,
        displayName: accountSpec.displayName,
        regionId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        trace: tracePath,
        screenshot: shot,
      });
      throw error;
    } finally {
      await session.stop();
    }
  }

  const managerBootstrapLogin = await postJson(
    `${baseUrl}/api/auth/login`,
    {
      account: managerSpec.account,
      password: plan.password,
    },
    args.timeoutMs,
  );
  liveRunState = collectLiveRunState(plan, managerBootstrapLogin.payload?.bootstrap);

  const workItemsBySpecialist = new Map();
  for (const item of plan.workItems) {
    const key = String(item.specialistAccount || "");
    if (!workItemsBySpecialist.has(key)) {
      workItemsBySpecialist.set(key, []);
    }
    workItemsBySpecialist.get(key).push(item);
  }

  for (const specialistAccount of [...workItemsBySpecialist.keys()].sort()) {
    const specialistItems = workItemsBySpecialist.get(specialistAccount);
    if (!specialistItems || specialistItems.length !== 20) {
      fail(`Internal error: specialist ${specialistAccount} should have 20 work items.`);
    }
    const accountSpec = plan.accounts.find((a) => a.account === specialistAccount);
    if (!accountSpec) {
      fail(`Internal error: specialist account missing from plan.accounts: ${specialistAccount}`);
    }
    const specialistPendingItems = specialistItems.filter((item) => !liveRunState.completedWorkItemIds.has(item.workItemId));
    if (specialistPendingItems.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[specialist:skip] ${specialistAccount} already complete`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`[specialist:start] ${specialistAccount} (${specialistPendingItems.length} pending of ${specialistItems.length})`);

    const screenshotDir = path.join(screenshotsRoot, specialistAccount, "work");
    const tracePath = path.join(tracesRoot, specialistAccount, "work-trace.zip");
    const session = await withTracedSession({
      baseUrl,
      headful: args.headful,
      slowMoMs: args.slowMoMs,
      timeoutMs: args.timeoutMs,
      tracePath,
      screenshotDir,
    });

    try {
      await loginByUI({
        page: session.page,
        baseUrl,
        account: specialistAccount,
        password: plan.password,
        timeoutMs: args.timeoutMs,
      });
      await assertSessionUserName(session.page, accountSpec.displayName, args.timeoutMs);
      await session.screenshot("login-success.png");

      for (const item of specialistPendingItems) {
        const stepStartedAt = new Date().toISOString();
        // eslint-disable-next-line no-console
        console.log(`[work:start] ${specialistAccount} ${item.workItemId} ${item.hospitalName}`);
        try {
          const existingProject = liveRunState.projectByHospitalName.get(item.hospitalName) || null;
          let projectId = String(existingProject?.id || "").trim();
          if (existingProject) {
            // eslint-disable-next-line no-console
            console.log(`[project:reuse] ${specialistAccount} ${item.workItemId} ${item.hospitalName}`);
          } else {
            const createPayload = await createHospitalProject({
              page: session.page,
              hospitalName: item.hospitalName,
              city: item.city,
              timeoutMs: args.timeoutMs,
            });
            projectId = String(createPayload?.project?.id || "").trim();
          }
          await selectProjectById({
            page: session.page,
            projectId,
            expectedHospitalName: item.hospitalName,
            timeoutMs: args.timeoutMs,
          });
          const intakeResult = await submitIntakeNote({
            page: session.page,
            noteText: item.noteText,
            specialistDisplayName: accountSpec.displayName,
            expectedHospitalName: item.hospitalName,
            visitDatePreset: item.visitDatePreset,
            timeoutMs: args.timeoutMs,
            intakeTimeoutMs: args.intakeTimeoutMs,
          });
          const shot = await session.screenshot(`${item.workItemId}-done.png`);
          workItemResults.push({
            workItemId: item.workItemId,
            specialistAccount,
            hospitalName: item.hospitalName,
            status: "ok",
            startedAt: stepStartedAt,
            finishedAt: new Date().toISOString(),
            reusedExistingProject: Boolean(existingProject),
            screenshot: shot,
          });
          if (intakeResult?.commitPayload?.project) {
            liveRunState.projectByHospitalName.set(item.hospitalName, intakeResult.commitPayload.project);
          }
          liveRunState.completedWorkItemIds.add(item.workItemId);
          // eslint-disable-next-line no-console
          console.log(`[work:ok] ${specialistAccount} ${item.workItemId}`);
        } catch (error) {
          const shot = await session.screenshot(`${item.workItemId}-error.png`).catch(() => "");
          workItemResults.push({
            workItemId: item.workItemId,
            specialistAccount,
            hospitalName: item.hospitalName,
            status: "failed",
            startedAt: stepStartedAt,
            finishedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            screenshot: shot,
          });
          throw error;
        }
      }
    } finally {
      await session.stop();
    }
  }

  const managerSession = await withTracedSession({
    baseUrl,
    headful: args.headful,
    slowMoMs: args.slowMoMs,
    timeoutMs: args.timeoutMs,
    tracePath: path.join(tracesRoot, managerSpec.account, "execute-manager-verify-trace.zip"),
    screenshotDir: path.join(screenshotsRoot, managerSpec.account, "execute-manager-verify"),
  });
  let verificationSummary = null;
  try {
    // eslint-disable-next-line no-console
    console.log(`[verify:start] ${managerSpec.account}`);
    await loginByUI({
      page: managerSession.page,
      baseUrl,
      account: managerSpec.account,
      password: plan.password,
      timeoutMs: args.timeoutMs,
    });
    await assertSessionUserName(managerSession.page, managerSpec.displayName, args.timeoutMs);
    await managerSession.screenshot("login.png");
    const bootstrap = await fetchBootstrapFromPage({ page: managerSession.page });
    verificationSummary = summarizeBootstrap(plan, bootstrap);
    assertVerificationSummary(verificationSummary);
    await managerSession.screenshot("verified.png");
    // eslint-disable-next-line no-console
    console.log(`[verify:ok] ${managerSpec.account}`);
  } finally {
    await managerSession.stop();
  }

  const healthAfter = await fetchJson(`${baseUrl}/api/health`, args.timeoutMs);
  const projectCountDelta =
    Number(healthAfter?.dataStore?.projectCount || 0) -
    Number(healthBefore?.dataStore?.projectCount || 0);

  const summary = {
    taskId: args.taskId,
    baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    counts: {
      accountsPlanned: plan.accounts.length,
      accountsCreated: accountResults.filter((r) => r.status === "created").length,
      accountsReady: accountResults.filter((r) => r.status === "created" || r.status === "already_exists").length,
      workItemsPlanned: plan.workItems.length,
      workItemsOk: workItemResults.filter((r) => r.status === "ok").length,
      workItemsReady: plan.workItems.length,
      workItemsFailed: workItemResults.filter((r) => r.status === "failed").length,
      projectCountDelta,
    },
    verificationSummary,
    healthBefore,
    healthAfter,
    accountResults,
    workItemResults,
    artifacts: {
      screenshotsRoot,
      tracesRoot,
    },
  };
  writeJson(path.join(artifactsRoot, "execute-summary.json"), summary);
  return summary;
}

async function runVerifyMode(args) {
  const projectRoot = resolveProjectRoot();
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const artifactsRoot = resolveArtifactsRoot({
    projectRoot,
    taskId: args.taskId,
    artifactsRootOverride: args.artifactsRoot,
  });

  const planPath = path.join(artifactsRoot, "plan.json");
  const plan = readJson(planPath);
  assertPlannedCounts(plan);

  const managerSpec = plan.accounts.find((a) => a.role === "manager");
  if (!managerSpec) {
    fail("Plan is missing manager account.");
  }
  const managerAccount = String(args.managerAccount || managerSpec.account || "").trim();
  const managerPassword = String(args.managerPassword || plan.password || "").trim();
  if (!managerAccount) {
    fail("Missing manager account. Provide --manager-account or ensure plan.json contains it.");
  }
  if (!managerPassword) {
    fail("Missing manager password. Provide --manager-password or ensure plan.json contains it.");
  }

  const verifyShots = path.join(artifactsRoot, "verify-screenshots");
  const verifyTraces = path.join(artifactsRoot, "verify-traces");
  ensureDir(verifyShots);
  ensureDir(verifyTraces);

  const startedAt = new Date().toISOString();
  const managerSession = await withTracedSession({
    baseUrl,
    headful: args.headful,
    slowMoMs: args.slowMoMs,
    timeoutMs: args.timeoutMs,
    tracePath: path.join(verifyTraces, `${managerAccount}-manager-verify-trace.zip`),
    screenshotDir: path.join(verifyShots, managerAccount),
  });

  let verificationSummary = null;
  try {
    await loginByUI({
      page: managerSession.page,
      baseUrl,
      account: managerAccount,
      password: managerPassword,
      timeoutMs: args.timeoutMs,
    });
    await assertSessionUserName(managerSession.page, managerSpec.displayName, args.timeoutMs);
    await managerSession.screenshot("login.png");
    const bootstrap = await fetchBootstrapFromPage({ page: managerSession.page });
    verificationSummary = summarizeBootstrap(plan, bootstrap);
    assertVerificationSummary(verificationSummary);
    await managerSession.screenshot("verified.png");
  } finally {
    await managerSession.stop();
  }

  const summary = {
    taskId: args.taskId,
    baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    manager: {
      account: managerAccount,
    },
    verificationSummary,
    artifacts: {
      verifyShots,
      verifyTraces,
    },
  };
  writeJson(path.join(artifactsRoot, "verify-summary.json"), summary);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.mode === "plan") {
    const result = await runPlanMode(args);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, mode: "plan", ...result }, null, 2));
    return;
  }
  if (args.mode === "execute") {
    const result = await runExecuteMode(args);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, mode: "execute", counts: result.counts }, null, 2));
    return;
  }
  if (args.mode === "verify") {
    const result = await runVerifyMode(args);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, mode: "verify", manager: result.manager }, null, 2));
    return;
  }
  fail(`Unhandled mode: ${args.mode}`);
}

main().catch((error) => {
  // Fail fast, no silent downgrade.
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

