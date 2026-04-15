import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const storePath = path.join(projectRoot, "data", "store.json");
const outputRoot = path.join(projectRoot, "output", "playwright", `contact-rename-e2e-${Date.now()}`);
const logsDir = path.join(outputRoot, "logs");
const screenshotsDir = path.join(outputRoot, "screenshots");
const tracePath = path.join(outputRoot, "trace.zip");
const backupPath = path.join(outputRoot, "store-backup.json");
const progressPath = path.join(outputRoot, "progress.log");

const fixture = {
  hospitalId: "hospital-e2e-contact-rename",
  departmentId: "department-e2e-contact-rename",
  contactId: "contact-e2e-contact-rename",
  projectId: "project-e2e-contact-rename",
  updateId: "update-e2e-contact-rename",
  taskId: "task-e2e-contact-rename",
  hospitalName: "E2E Contact Graph Hospital",
  city: "Shanghai",
  ownerUserId: "user-li-wei",
  managerAccount: "user-wang-chao",
  managerPassword: "123456",
  oldName: "DrOldAlpha",
  newName: "DrNewAlpha",
  roleTitle: "Chief Doctor",
  summaryText: "Aligned with DrOldAlpha on the rollout plan, and DrOldAlpha will return the internal roster after approval.",
  nextActionText: "Keep following DrOldAlpha and confirm the pilot schedule this week.",
  updateText: "DrOldAlpha confirmed the pilot scope and asked us to wait for the internal roster before training.",
  taskTitle: "Follow up with DrOldAlpha on pilot scheduling",
  taskDescription: "Confirm DrOldAlpha roster feedback and finalize the training slot.",
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fail(message) {
  throw new Error(String(message || "Unknown error."));
}

function logStep(message) {
  ensureDir(path.dirname(progressPath));
  fs.appendFileSync(progressPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
}

function removeFixtureRecords(store) {
  store.hospitals = (store.hospitals || []).filter((item) => item.id !== fixture.hospitalId);
  store.departments = (store.departments || []).filter((item) => item.id !== fixture.departmentId);
  store.contacts = (store.contacts || []).filter((item) => item.id !== fixture.contactId);
  store.projects = (store.projects || []).filter((item) => item.id !== fixture.projectId);
  store.updates = (store.updates || []).filter((item) => item.id !== fixture.updateId);
  store.tasks = (store.tasks || []).filter((item) => item.id !== fixture.taskId);
}

function seedFixtureStore(rawStore) {
  const store = structuredClone(rawStore);
  removeFixtureRecords(store);

  const firstRegion = store.regions?.[0]?.id;
  const firstStage = store.stages?.[0]?.id;
  if (!firstRegion || !firstStage) {
    fail("Missing prerequisite store regions or stages.");
  }

  store.hospitals.push({
    id: fixture.hospitalId,
    regionId: firstRegion,
    name: fixture.hospitalName,
    hospitalLevel: "Tertiary",
    city: fixture.city,
  });
  store.departments.push({
    id: fixture.departmentId,
    hospitalId: fixture.hospitalId,
    name: "Pain Center",
  });
  store.contacts.push({
    id: fixture.contactId,
    hospitalId: fixture.hospitalId,
    departmentId: fixture.departmentId,
    name: fixture.oldName,
    roleTitle: fixture.roleTitle,
    lastContactAt: "2026-04-12T09:00:00.000Z",
  });
  store.projects.push({
    id: fixture.projectId,
    hospitalId: fixture.hospitalId,
    regionId: firstRegion,
    ownerUserId: fixture.ownerUserId,
    currentStageId: firstStage,
    riskLevel: "normal",
    managerAttentionNeeded: false,
    lastFollowUpAt: "2026-04-12T09:30:00.000Z",
    nextAction: fixture.nextActionText,
    nextActionDueAt: "2026-04-16",
    latestSummary: fixture.summaryText,
    currentIssueTagIds: [],
    latestUpdateId: fixture.updateId,
  });
  store.updates.push({
    id: fixture.updateId,
    projectId: fixture.projectId,
    createdByUserId: fixture.ownerUserId,
    sessionId: "",
    visitDate: "2026-04-12",
    departmentId: fixture.departmentId,
    contactEntries: [
      {
        contactId: fixture.contactId,
        name: fixture.oldName,
        role: fixture.roleTitle,
      },
    ],
    feedbackSummary: fixture.updateText,
    blockers: "",
    opportunities: "",
    nextStep: fixture.nextActionText,
    issueTagIds: [],
    stageBeforeId: firstStage,
    stageAfterId: firstStage,
    managerAttentionNeeded: false,
    sourceNote: `Visited ${fixture.hospitalName} and discussed follow-up with ${fixture.oldName}.`,
    createdAt: "2026-04-12T09:30:00.000Z",
  });
  store.tasks.push({
    id: fixture.taskId,
    projectId: fixture.projectId,
    updateId: fixture.updateId,
    title: fixture.taskTitle,
    description: fixture.taskDescription,
    relatedContactIds: [fixture.contactId],
    assigneeUserId: fixture.ownerUserId,
    dueAt: "2026-04-16",
    status: "todo",
    priority: "medium",
    completedAt: null,
    createdAt: "2026-04-12T09:31:00.000Z",
  });

  return store;
}

function collectContactSegmentIds(segments) {
  return (Array.isArray(segments) ? segments : [])
    .filter((segment) => segment && segment.type === "contact")
    .map((segment) => String(segment.contactId || "").trim())
    .filter(Boolean);
}

function assertMigrationApplied(store) {
  const project = (store.projects || []).find((item) => item.id === fixture.projectId);
  const update = (store.updates || []).find((item) => item.id === fixture.updateId);
  const task = (store.tasks || []).find((item) => item.id === fixture.taskId);
  if (!project || !update || !task) {
    fail("Fixture records are missing after migration.");
  }

  const projectSummaryRefs = collectContactSegmentIds(project.latestSummarySegments);
  const projectActionRefs = collectContactSegmentIds(project.nextActionSegments);
  const updateRefs = collectContactSegmentIds(update.feedbackSummarySegments);
  const taskTitleRefs = collectContactSegmentIds(task.titleSegments);
  const taskDescriptionRefs = collectContactSegmentIds(task.descriptionSegments);

  if (!projectSummaryRefs.includes(fixture.contactId)) {
    fail("Project latestSummarySegments did not backfill contact references.");
  }
  if (!projectActionRefs.includes(fixture.contactId)) {
    fail("Project nextActionSegments did not backfill contact references.");
  }
  if (!updateRefs.includes(fixture.contactId)) {
    fail("Update feedbackSummarySegments did not backfill contact references.");
  }
  if (!taskTitleRefs.includes(fixture.contactId)) {
    fail("Task titleSegments did not backfill contact references.");
  }
  if (!taskDescriptionRefs.includes(fixture.contactId)) {
    fail("Task descriptionSegments did not backfill contact references.");
  }
}

function assertLegacyStringsPreserved(store) {
  const project = (store.projects || []).find((item) => item.id === fixture.projectId);
  const update = (store.updates || []).find((item) => item.id === fixture.updateId);
  const task = (store.tasks || []).find((item) => item.id === fixture.taskId);
  const contact = (store.contacts || []).find((item) => item.id === fixture.contactId);
  if (!project || !update || !task || !contact) {
    fail("Fixture records are missing after rename.");
  }

  if (contact.name !== fixture.newName) {
    fail(`Expected contact name to be ${fixture.newName}, got ${contact.name || "(empty)"}.`);
  }
  for (const [label, text] of [
    ["project.latestSummary", project.latestSummary],
    ["project.nextAction", project.nextAction],
    ["update.feedbackSummary", update.feedbackSummary],
    ["task.title", task.title],
    ["task.description", task.description],
  ]) {
    if (!String(text || "").includes(fixture.oldName)) {
      fail(`${label} should keep the original legacy string.`);
    }
    if (String(text || "").includes(fixture.newName)) {
      fail(`${label} should not be batch-rewritten to the new name.`);
    }
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Server is not ready yet.
    }
    await delay(300);
  }
  fail(`Timed out waiting for ${baseUrl}/api/health.`);
}

function startServer(port) {
  ensureDir(logsDir);
  const stdoutPath = path.join(logsDir, "app.out.log");
  const stderrPath = path.join(logsDir, "app.err.log");
  const stdout = fs.createWriteStream(stdoutPath, { flags: "a" });
  const stderr = fs.createWriteStream(stderrPath, { flags: "a" });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  return { child, stdoutPath, stderrPath };
}

async function stopServer(server) {
  if (!server?.child || server.child.exitCode !== null) {
    return;
  }
  server.child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.child.once("exit", resolve)),
    delay(5000),
  ]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await new Promise((resolve) => server.child.once("exit", resolve));
  }
}

async function login(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#authDialog").waitFor({ state: "visible" });
  await page.locator("#authModeLoginButton").click();
  await page.locator("#authLoginAccountInput").fill(fixture.managerAccount);
  await page.locator("#authLoginPasswordInput").fill(fixture.managerPassword);
  await Promise.all([
    page.waitForResponse((response) => {
      try {
        return (
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/auth/login"
        );
      } catch {
        return false;
      }
    }),
    page.locator("#authLoginSubmitButton").click(),
  ]);
  await page.locator("#sessionUserName").waitFor();
}

async function clickMainTab(page, tabId) {
  await page.locator(`#tabBar button[data-tab="${tabId}"]`).click();
}

async function openLedgerProject(page) {
  await clickMainTab(page, "ledger");
  const existingDetail = page.locator(`[data-contact-action][data-project-id="${fixture.projectId}"]`).first();
  const detailVisible = await existingDetail
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (detailVisible) {
    await page.locator(".detail-hero-card h3").filter({ hasText: fixture.hospitalName }).waitFor();
    return;
  }
  const projectCard = page.locator(`#projectList [data-project-id="${fixture.projectId}"]`).first();
  await projectCard.waitFor();
  await projectCard.click();
  await page.locator(".detail-hero-card h3").filter({ hasText: fixture.hospitalName }).waitFor();
}

async function ensureExpandedProjectTasks(page) {
  const toggle = page.locator(`[data-project-task-toggle="true"][data-project-id="${fixture.projectId}"]`);
  const expanded = await toggle.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await toggle.click();
  }
  await page.locator(".detail-task-item").first().waitFor();
}

async function captureLedgerTexts(page) {
  await openLedgerProject(page);
  await ensureExpandedProjectTasks(page);
  return {
    latestSummary: await page.locator(".detail-hero-card .detail-copy").textContent(),
    currentProgress: await page.locator(".detail-action-card strong").textContent(),
    timelineCopy: await page.locator(".timeline-item p").first().textContent(),
    taskTitle: await page.locator(".detail-task-item strong").first().textContent(),
    taskDescription: await page.locator(".detail-task-item-copy").first().textContent(),
    contactCardName: await page.locator(".detail-contact-card strong").first().textContent(),
  };
}

async function captureTaskBoardTexts(page) {
  await clickMainTab(page, "tasks");
  const taskCard = page.locator(".task-card").filter({ hasText: fixture.hospitalName }).first();
  await taskCard.waitFor();
  return {
    boardTitle: await taskCard.locator(".task-card-top strong").textContent(),
    boardDescription: await taskCard.locator("p").first().textContent(),
    boardContact: await taskCard.locator(".task-contact-chip").first().textContent(),
  };
}

async function captureRecentTexts(page) {
  await clickMainTab(page, "insights");
  await page.locator(`[data-insight-subtab="recent"]`).click();
  const note = page.locator(".insight-note").filter({ hasText: fixture.hospitalName }).first();
  await note.waitFor();
  return {
    recentCopy: await note.locator("p").first().textContent(),
  };
}

function assertTextContains(label, text, expected) {
  if (!String(text || "").includes(expected)) {
    fail(`${label} is missing "${expected}". Actual: ${text || "(empty)"}`);
  }
}

function assertTextExcludes(label, text, unexpected) {
  if (String(text || "").includes(unexpected)) {
    fail(`${label} should not include "${unexpected}". Actual: ${text}`);
  }
}

async function renameContactThroughUi(page) {
  await openLedgerProject(page);
  logStep("rename: ledger reopened");
  await page.locator(`[data-contact-action="edit"][data-project-id="${fixture.projectId}"]`).click();
  logStep("rename: editor opened");
  await page.evaluate((nextName) => {
    window.__codexOriginalPrompt = window.prompt;
    window.prompt = () => String(nextName || "");
  }, fixture.newName);
  await page.locator(`[data-contact-token="true"][data-project-id="${fixture.projectId}"][data-contact-field="name"][data-contact-index="0"]`).click();
  logStep("rename: token clicked");
  const responsePromise = page.waitForResponse((response) => {
    try {
      return (
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `/api/projects/${fixture.projectId}/contacts`
      );
    } catch {
      return false;
    }
  });
  await page.locator(`[data-contact-action="save"][data-project-id="${fixture.projectId}"]`).click();
  logStep("rename: save clicked");
  const response = await responsePromise;
  await page.evaluate(() => {
    if (typeof window.__codexOriginalPrompt === "function") {
      window.prompt = window.__codexOriginalPrompt;
    }
    delete window.__codexOriginalPrompt;
  });
  if (!response.ok()) {
    fail(`Rename save failed with HTTP ${response.status()}.`);
  }
  await page.locator(`[data-contact-action="edit"][data-project-id="${fixture.projectId}"]`).waitFor();
}

async function main() {
  ensureDir(outputRoot);
  ensureDir(logsDir);
  ensureDir(screenshotsDir);
  logStep("start");

  const originalStoreText = fs.readFileSync(storePath, "utf8");
  fs.writeFileSync(backupPath, originalStoreText, "utf8");

  let server = null;
  let browser = null;
  let context = null;

  try {
    const seededStore = seedFixtureStore(readJson(storePath));
    writeJson(storePath, seededStore);
    logStep("fixture seeded");

    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = startServer(port);
    await waitForHealth(baseUrl, 40000);
    logStep(`server ready ${baseUrl}`);

    const migratedStore = readJson(storePath);
    assertMigrationApplied(migratedStore);
    logStep("migration verified");

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    logStep("browser ready");

    await login(page, baseUrl);
    logStep("login complete");

    const beforeLedger = await captureLedgerTexts(page);
    logStep("ledger before captured");
    const beforeTasks = await captureTaskBoardTexts(page);
    logStep("tasks before captured");
    const beforeRecent = await captureRecentTexts(page);
    logStep("recent before captured");

    for (const [label, text] of Object.entries({
      ...beforeLedger,
      ...beforeTasks,
      ...beforeRecent,
    })) {
      assertTextContains(`before.${label}`, text, fixture.oldName);
      assertTextExcludes(`before.${label}`, text, fixture.newName);
    }
    await page.screenshot({ path: path.join(screenshotsDir, "before-rename.png"), fullPage: true });
    logStep("before screenshot saved");

    await renameContactThroughUi(page);
    logStep("rename saved");

    const afterLedger = await captureLedgerTexts(page);
    logStep("ledger after captured");
    const afterTasks = await captureTaskBoardTexts(page);
    logStep("tasks after captured");
    const afterRecent = await captureRecentTexts(page);
    logStep("recent after captured");

    for (const [label, text] of Object.entries({
      ...afterLedger,
      ...afterTasks,
      ...afterRecent,
    })) {
      assertTextContains(`after.${label}`, text, fixture.newName);
      assertTextExcludes(`after.${label}`, text, fixture.oldName);
    }
    await page.screenshot({ path: path.join(screenshotsDir, "after-rename.png"), fullPage: true });
    logStep("after screenshot saved");

    const finalStore = readJson(storePath);
    assertLegacyStringsPreserved(finalStore);
    logStep("store preservation verified");

    const summary = {
      ok: true,
      baseUrl,
      fixture,
      ui: {
        beforeLedger,
        beforeTasks,
        beforeRecent,
        afterLedger,
        afterTasks,
        afterRecent,
      },
      storeChecks: {
        migrationBackfilledReferences: true,
        renameDidNotBatchRewriteLegacyStrings: true,
      },
      artifacts: {
        beforeScreenshot: path.join(screenshotsDir, "before-rename.png"),
        afterScreenshot: path.join(screenshotsDir, "after-rename.png"),
        tracePath,
        backupPath,
        serverStdout: server.stdoutPath,
        serverStderr: server.stderrPath,
      },
    };
    writeJson(path.join(outputRoot, "summary.json"), summary);
    logStep("summary written");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (context) {
      await context.tracing.stop({ path: tracePath }).catch(() => {});
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    await stopServer(server).catch(() => {});
    fs.writeFileSync(storePath, originalStoreText, "utf8");
    logStep("store restored");
  }
}

main().catch((error) => {
  try {
    ensureDir(outputRoot);
    fs.writeFileSync(
      path.join(outputRoot, "error.log"),
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`,
      "utf8",
    );
  } catch {
    // Ignore secondary logging errors.
  }
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
