import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const SUSPICIOUS_RULES = [
  { id: "responses_api", regex: /Responses API/i },
  { id: "ai_note", regex: /\bAI\s*录入纪要/i },
  { id: "auth_incorrect", regex: /account or password is incorrect/i },
  { id: "auth_required", regex: /Authentication required/i },
  { id: "required_suffix", regex: /\bis required\./i },
  { id: "already_exists", regex: /already exists\./i },
  { id: "not_found", regex: /\bnot found\./i },
  { id: "risk_high", regex: /\bhigh\b/i },
  { id: "risk_normal", regex: /\bnormal\b/i },
  { id: "risk_low", regex: /\blow\b/i },
  { id: "role_manager", regex: /\bmanager\b/i },
  { id: "role_supervisor", regex: /\bsupervisor\b/i },
  { id: "role_specialist", regex: /\bspecialist\b/i },
  { id: "contact_edit_tester", regex: /Contact Edit Tester/i },
  { id: "tester", regex: /\bTester\b/i },
  { id: "e2e", regex: /\bE2E\b/i },
  { id: "garbled_question_marks", regex: /\?{2,}/ },
];

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

function parseArgs(argv) {
  const options = {
    baseUrl: "http://127.0.0.1:3000",
    account: "",
    password: "",
    outputDir: path.join(projectRoot, "output", "playwright", `frontend-display-text-${Date.now()}`),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--base-url" && next) {
      options.baseUrl = next;
      index += 1;
      continue;
    }
    if (token === "--account" && next) {
      options.account = next;
      index += 1;
      continue;
    }
    if (token === "--password" && next) {
      options.password = next;
      index += 1;
      continue;
    }
    if (token === "--output-dir" && next) {
      options.outputDir = path.isAbsolute(next) ? next : path.resolve(projectRoot, next);
      index += 1;
      continue;
    }
    fail(`Unsupported argument: ${token}`);
  }

  if (!options.account || !options.password) {
    fail("Usage: node scripts/verify-frontend-display-text.mjs --account <account> --password <password> [--base-url <url>] [--output-dir <dir>]");
  }

  return options;
}

async function assertHealth(baseUrl) {
  const response = await fetch(`${baseUrl}/api/health`);
  if (!response.ok) {
    fail(`Health check failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function normalizeLines(text) {
  return String(text || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectSuspiciousMatches(text) {
  const lines = normalizeLines(text);
  const matches = [];
  for (const line of lines) {
    for (const rule of SUSPICIOUS_RULES) {
      if (rule.regex.test(line)) {
        matches.push({
          ruleId: rule.id,
          text: line,
        });
      }
    }
  }
  return matches;
}

async function login(page, { baseUrl, account, password }) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#authDialog").waitFor({ state: "visible" });
  await page.locator("#authModeLoginButton").click();

  await page.locator("#authLoginAccountInput").fill(account);
  await page.locator("#authLoginPasswordInput").fill("invalid-password");
  await Promise.all([
    page.waitForResponse((response) => {
      try {
        return response.request().method() === "POST" && new URL(response.url()).pathname === "/api/auth/login";
      } catch {
        return false;
      }
    }),
    page.locator("#authLoginSubmitButton").click(),
  ]);
  await page.locator("#authFeedback").waitFor({ state: "visible" });
  const failedFeedback = await page.locator("#authFeedback").textContent();

  await page.locator("#authLoginPasswordInput").fill(password);
  await Promise.all([
    page.waitForResponse((response) => {
      try {
        return response.request().method() === "POST" && new URL(response.url()).pathname === "/api/auth/login";
      } catch {
        return false;
      }
    }),
    page.locator("#authLoginSubmitButton").click(),
  ]);

  await page.locator("#sessionUserName").waitFor({ state: "visible" });
  await page.locator("#authDialog").waitFor({ state: "hidden" });
  const sessionName = await page.locator("#sessionUserName").textContent();
  const sessionRole = await page.locator("#sessionUserRole").textContent();
  const toastLocator = page.locator("#toast");
  const toastVisible = await toastLocator
    .waitFor({ state: "visible", timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  const toastText = toastVisible ? await toastLocator.textContent() : "";

  return {
    failedFeedback: String(failedFeedback || "").trim(),
    sessionName: String(sessionName || "").trim(),
    sessionRole: String(sessionRole || "").trim(),
    toastText: String(toastText || "").trim(),
  };
}

async function clickMainTab(page, tabId) {
  await page.locator(`#tabBar button[data-tab="${tabId}"]`).click();
}

async function openLedger(page) {
  await clickMainTab(page, "ledger");
  await page.locator("#projectList").waitFor();
  const firstProject = page.locator('#projectList button[data-project-id]').first();
  if ((await firstProject.count()) > 0) {
    await firstProject.click();
  }
  await page.locator("#projectDetail").waitFor();
}

async function openTasks(page) {
  await clickMainTab(page, "tasks");
  await page.locator("#taskBoard").waitFor();
}

async function openInsightSubTab(page, subTabId) {
  await clickMainTab(page, "insights");
  await page.locator(`#insightPanel [data-insight-subtab="${subTabId}"]`).waitFor();
  await page.locator(`#insightPanel [data-insight-subtab="${subTabId}"]`).click();
  await page.waitForTimeout(250);
}

async function captureSection(page, outputDir, fileBaseName, selectors, prepare) {
  await prepare();
  const texts = {};
  for (const [key, selector] of Object.entries(selectors)) {
    const locator = page.locator(selector).first();
    const visible = await locator
      .waitFor({ state: "visible", timeout: 2500 })
      .then(() => true)
      .catch(() => false);
    texts[key] = visible ? String((await locator.innerText()) || "").trim() : "";
  }

  const combinedText = Object.values(texts).filter(Boolean).join("\n");
  const matches = collectSuspiciousMatches(combinedText);
  const screenshotPath = path.join(outputDir, `${fileBaseName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return {
    ok: matches.length === 0,
    screenshotPath,
    texts,
    matches,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  ensureDir(options.outputDir);

  const health = await assertHealth(options.baseUrl);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });

  try {
    const page = await context.newPage();
    const authAudit = await login(page, options);

    const entrySection = await captureSection(
      page,
      options.outputDir,
      "entry",
      {
        sessionBar: ".session-bar",
        entryCard: "#entryCard",
        intakeResult: "#intakeResult",
      },
      async () => {
        await clickMainTab(page, "entry");
        await page.locator("#entryCard").waitFor();
      },
    );

    const ledgerSection = await captureSection(
      page,
      options.outputDir,
      "ledger",
      {
        signalPanel: "#signalPanel",
        projectList: "#projectList",
        projectDetail: "#projectDetail",
      },
      async () => {
        await openLedger(page);
      },
    );

    const tasksSection = await captureSection(
      page,
      options.outputDir,
      "tasks",
      {
        taskBoard: "#taskBoard",
      },
      async () => {
        await openTasks(page);
      },
    );

    const recentSection = await captureSection(
      page,
      options.outputDir,
      "insights-recent",
      {
        insightPanel: "#insightPanel",
      },
      async () => {
        await openInsightSubTab(page, "recent");
      },
    );

    const managementSection = await captureSection(
      page,
      options.outputDir,
      "insights-management",
      {
        insightPanel: "#insightPanel",
      },
      async () => {
        await openInsightSubTab(page, "management");
      },
    );

    const entryAudit = {
      ok: entrySection.ok && collectSuspiciousMatches(Object.values(authAudit).join("\n")).length === 0,
      health,
      authAudit: {
        ...authAudit,
        matches: collectSuspiciousMatches(Object.values(authAudit).join("\n")),
      },
      sections: {
        entry: entrySection,
      },
    };

    const dashboardAudit = {
      ok: ledgerSection.ok && tasksSection.ok && recentSection.ok && managementSection.ok,
      sections: {
        ledger: ledgerSection,
        tasks: tasksSection,
        recent: recentSection,
        management: managementSection,
      },
    };

    writeJson(path.join(options.outputDir, "entry-audit.json"), entryAudit);
    writeJson(path.join(options.outputDir, "dashboard-audit.json"), dashboardAudit);

    const summary = {
      ok: entryAudit.ok && dashboardAudit.ok,
      baseUrl: options.baseUrl,
      outputDir: options.outputDir,
      health,
      audits: {
        entry: path.join(options.outputDir, "entry-audit.json"),
        dashboard: path.join(options.outputDir, "dashboard-audit.json"),
      },
      screenshots: {
        entry: entrySection.screenshotPath,
        ledger: ledgerSection.screenshotPath,
        tasks: tasksSection.screenshotPath,
        recent: recentSection.screenshotPath,
        management: managementSection.screenshotPath,
      },
    };

    writeJson(path.join(options.outputDir, "summary.json"), summary);
    console.log(JSON.stringify(summary, null, 2));

    if (!summary.ok) {
      fail("Frontend display text audit found remaining suspicious text.");
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
