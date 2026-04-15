import path from "node:path";

import { BrowserDriver } from "./browser-driver.js";
import { CodexSessionDecisionClient } from "./codex-session-client.js";
import { computeFileHash, readJsonFile, writeJsonFile } from "./helpers.js";

const ROLE_GOAL_CARD = {
  manager:
    "Inspect overall progress, watch management signals, and supervise the supervisor with project remarks when risk or delays appear. Do not execute frontline specialist work.",
  supervisor:
    "Drive regional progress, monitor overdue tasks, and delegate work to specialists by leaving project remarks. Follow up quickly on pending replies.",
  specialist:
    "Complete assigned tasks, reply to supervisor/manager remarks, and submit useful intake updates to move projects forward.",
};

export async function createRoleAgents({ runtime, scenario }) {
  const modelClient = createDecisionClient(scenario);
  const roster = expandRoster({
    scenario,
    runId: runtime.runId,
  });

  const turnOrder = [];
  const roleCatalog = {
    byRole: {
      manager: [],
      supervisor: [],
      specialist: [],
    },
    all: [],
  };
  const initialClock = readJsonFile(runtime.paths.clockFile);

  try {
    for (const roleSpec of roster) {
      const roleScreenshotDir = path.join(runtime.paths.screenshotsDir, roleSpec.account);
      const roleTraceDir = path.join(runtime.paths.tracesDir, roleSpec.account);
      const driver = new BrowserDriver({
        baseUrl: runtime.baseUrl,
        roleLabel: roleSpec.account,
        artifactsDir: roleScreenshotDir,
        tracesDir: roleTraceDir,
        enableTrace: scenario.artifactPolicy.recordTrace,
      });
      await driver.start(initialClock.currentDateTime);
      await driver.setSimulatedNow(initialClock.currentDateTime);
      await registerAccountByUI({
        driver,
        roleSpec,
        initialPassword: process.env.DEFAULT_INITIAL_PASSWORD || "123456",
      });

      const matchedUser = findUserByAccount(runtime.paths.storeFile, roleSpec.account);
      if (!matchedUser) {
        throw new Error(`Registered account was not persisted: ${roleSpec.account}`);
      }

      const agent = new RoleAgent({
        runtime,
        scenario,
        roleSpec: {
          ...roleSpec,
          userId: matchedUser.id,
          regionId: matchedUser.regionId,
        },
        driver,
        modelClient,
        initialStoreHash: computeFileHash(runtime.paths.storeFile),
      });
      turnOrder.push(agent);
      roleCatalog.byRole[roleSpec.role].push({
        role: roleSpec.role,
        account: roleSpec.account,
        displayName: roleSpec.displayName,
        userId: matchedUser.id,
        regionId: matchedUser.regionId,
      });
      roleCatalog.all.push({
        role: roleSpec.role,
        account: roleSpec.account,
        displayName: roleSpec.displayName,
        userId: matchedUser.id,
        regionId: matchedUser.regionId,
      });
    }
  } catch (error) {
    for (const created of turnOrder) {
      await created.dispose().catch(() => {
        // Ignore disposal failures while bubbling startup error.
      });
    }
    throw error;
  }

  runtime.roleCatalog = roleCatalog;
  const manifest = readJsonFile(runtime.paths.runManifestFile);
  await writeJsonFile(runtime.paths.runManifestFile, {
    ...manifest,
    accounts: roleCatalog.all,
  });

  return {
    turnOrder: sortTurnOrder(turnOrder),
    roleCatalog,
    modelClient,
  };
}

export async function disposeRoleAgents(bundle) {
  if (!bundle?.turnOrder?.length) {
    return;
  }
  for (const agent of bundle.turnOrder) {
    await agent.dispose();
  }
}

class RoleAgent {
  constructor({
    runtime,
    scenario,
    roleSpec,
    driver,
    modelClient,
    initialStoreHash,
  }) {
    this.runtime = runtime;
    this.scenario = scenario;
    this.roleSpec = roleSpec;
    this.driver = driver;
    this.modelClient = modelClient;
    this.goalCard = ROLE_GOAL_CARD[roleSpec.role];
    this.lastSummary = "No previous summary.";
    this.lastStoreHash = initialStoreHash;
  }

  async runTurn({
    simDate,
    dayIndex,
    roundIndex,
    turnOrdinal,
    maxActions,
    simulatedDateTime,
  }) {
    await this.driver.setSimulatedNow(simulatedDateTime);
    const turnEvents = [];
    let stateChanged = false;
    let terminatedByIdle = false;

    for (let actionIndex = 0; actionIndex < maxActions; actionIndex += 1) {
      const snapshot = await this.driver.captureSnapshot();
      const decision = await this.modelClient.decideTurnAction({
        role: this.roleSpec.role,
        account: this.roleSpec.account,
        password: process.env.DEFAULT_INITIAL_PASSWORD || "123456",
        goalCard: this.goalCard,
        previousSummary: this.lastSummary,
        simDate,
        actionBudget: maxActions,
        currentActionIndex: actionIndex + 1,
        snapshot,
      });

      if (decision.decision === "idle") {
        const idleEvent = this.buildTurnEvent({
          simDate,
          dayIndex,
          roundIndex,
          turnOrdinal,
          actionIndex,
          actionType: "idle",
          actionArgs: {},
          pageSummary: summarizeSnapshot(snapshot),
          stateChanged: false,
          scoreDelta: {},
          artifactRefs: [],
          error: "",
        });
        turnEvents.push(idleEvent);
        terminatedByIdle = true;
        this.lastSummary = `Idle: ${decision.reasoning}`;
        break;
      }

      let actionResult;
      try {
        actionResult = await this.executeWithSingleStaleRetry(decision.action);
      } catch (error) {
        throw new Error(
          `Role ${this.roleSpec.account} failed action ${decision.action.type}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const latestSnapshot = await this.driver.captureSnapshot();
      const nextHash = computeFileHash(this.runtime.paths.storeFile);
      const didChange = nextHash !== this.lastStoreHash;
      if (didChange) {
        this.lastStoreHash = nextHash;
        stateChanged = true;
      }

      const event = this.buildTurnEvent({
        simDate,
        dayIndex,
        roundIndex,
        turnOrdinal,
        actionIndex,
        actionType: String(decision.action.type || ""),
        actionArgs: decision.action,
        pageSummary: summarizeSnapshot(latestSnapshot),
        stateChanged: didChange,
        scoreDelta: {},
        artifactRefs: normalizeArtifactRefs(actionResult),
        error: "",
      });
      turnEvents.push(event);
      this.lastSummary = `${decision.reasoning} | action=${decision.action.type} | changed=${didChange}`;
      if (didChange) {
        break;
      }
    }

    const screenshotPath = await this.captureTurnScreenshot(simDate, dayIndex, turnOrdinal);
    if (turnEvents.length) {
      turnEvents[turnEvents.length - 1].artifactRefs.push(screenshotPath);
    }

    if (!turnEvents.length) {
      const snapshot = this.driver.getLastSnapshot() || (await this.driver.captureSnapshot());
      turnEvents.push(
        this.buildTurnEvent({
          simDate,
          dayIndex,
          roundIndex,
          turnOrdinal,
          actionIndex: 0,
          actionType: "idle",
          actionArgs: {},
          pageSummary: summarizeSnapshot(snapshot),
          stateChanged: false,
          scoreDelta: {},
          artifactRefs: screenshotPath ? [screenshotPath] : [],
          error: "",
        }),
      );
      terminatedByIdle = true;
    }

    return {
      events: turnEvents,
      stateChanged,
      idle: terminatedByIdle,
    };
  }

  async executeWithSingleStaleRetry(action) {
    try {
      return await this.driver.executeAction(action);
    } catch (error) {
      if (!isRetryableStaleError(action, error)) {
        throw error;
      }
      await this.driver.captureSnapshot();
      return this.driver.executeAction(action);
    }
  }

  async captureTurnScreenshot(simDate, dayIndex, turnOrdinal) {
    const fileName = `day${String(dayIndex + 1).padStart(2, "0")}-turn${String(turnOrdinal).padStart(2, "0")}-${simDate}.png`;
    const result = await this.driver.executeAction(
      { type: "screenshot" },
      { screenshotFileName: fileName },
    );
    return result.detail.file;
  }

  buildTurnEvent({
    simDate,
    dayIndex,
    roundIndex,
    turnOrdinal,
    actionIndex,
    actionType,
    actionArgs,
    pageSummary,
    stateChanged,
    scoreDelta,
    artifactRefs,
    error,
  }) {
    return {
      simDate,
      role: this.roleSpec.role,
      account: this.roleSpec.account,
      turnIndex: turnOrdinal,
      dayIndex,
      roundIndex,
      actionIndex: actionIndex + 1,
      actionType,
      actionArgs,
      pageSummary,
      stateChanged: Boolean(stateChanged),
      scoreDelta,
      artifactRefs: artifactRefs || [],
      error: String(error || ""),
      recordedAt: new Date().toISOString(),
    };
  }

  async dispose() {
    await this.driver.stop();
  }
}

async function registerAccountByUI({ driver, roleSpec, initialPassword }) {
  const page = driver.page;
  await page.goto(driver.baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator("#authDialog").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#authModeRegisterButton").click({ timeout: 10000 });
  await page.locator("#authRegisterNameInput").fill(roleSpec.displayName, { timeout: 10000 });
  await page.locator("#authRegisterAccountInput").fill(roleSpec.account, { timeout: 10000 });
  await page.locator("#authRegisterPasswordInput").fill(initialPassword, { timeout: 10000 });
  await page.locator("#authRegisterRoleSelect").selectOption(roleSpec.role);
  const regionSelect = page.locator("#authRegisterRegionSelect");
  await regionSelect.waitFor({ state: "visible", timeout: 10000 });
  const hasRegion = await regionSelect.locator("option").count();
  if (hasRegion <= 0) {
    throw new Error("No region options are available for registration.");
  }
  const firstRegion = await regionSelect.locator("option").first().getAttribute("value");
  if (!firstRegion) {
    throw new Error("Registration region option is empty.");
  }
  await regionSelect.selectOption(firstRegion);
  await page.locator("#authRegisterSubmitButton").click({ timeout: 10000 });
  await page.locator("#authDialog").waitFor({ state: "hidden", timeout: 15000 });

  const sessionName = await page.locator("#sessionUserName").innerText();
  if (String(sessionName || "").trim() !== roleSpec.displayName) {
    throw new Error(
      `Registration/login verification failed for ${roleSpec.account}. Session user is ${sessionName}.`,
    );
  }
}

function expandRoster({ scenario, runId }) {
  const cleanRunId = String(runId || "").replace(/^sim-/, "");
  const output = [];
  for (const entry of scenario.roster) {
    for (let index = 1; index <= entry.count; index += 1) {
      const indexText = String(index).padStart(2, "0");
      output.push({
        role: entry.role,
        account: `sim-${cleanRunId}-${entry.role}-${indexText}`,
        displayName: `Sim ${entry.role} ${indexText}`,
      });
    }
  }
  return output;
}

function sortTurnOrder(agents) {
  const rankMap = {
    manager: 1,
    supervisor: 2,
    specialist: 3,
  };
  return [...agents].sort((left, right) => {
    const rankDelta = rankMap[left.roleSpec.role] - rankMap[right.roleSpec.role];
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return left.roleSpec.account.localeCompare(right.roleSpec.account);
  });
}

function findUserByAccount(storePath, account) {
  const store = readJsonFile(storePath);
  const users = Array.isArray(store.users) ? store.users : [];
  const normalizedAccount = normalizeAccount(account);
  return users.find((user) => normalizeAccount(user.account) === normalizedAccount) || null;
}

function normalizeAccount(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function summarizeSnapshot(snapshot) {
  if (!snapshot) {
    return "";
  }
  const body = String(snapshot.bodyText || "").replace(/\s+/g, " ").trim();
  const shortText = body.slice(0, 180);
  return `${snapshot.title || "(untitled)"} | ${shortText}`;
}

function normalizeArtifactRefs(actionResult) {
  const file = actionResult?.detail?.file;
  return file ? [file] : [];
}

function isRetryableStaleError(action, error) {
  if (!action || !String(action.target || "").trim().startsWith("e")) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("No snapshot element found") ||
    message.includes("resolved to 0 elements") ||
    message.includes("strict mode violation")
  );
}

function createDecisionClient(scenario) {
  const provider = String(scenario?.model?.provider || "").trim().toLowerCase();
  if (provider === "codex-session") {
    return new CodexSessionDecisionClient({
      modelName: scenario.model.name,
      temperature: scenario.model.temperature,
    });
  }
  throw new Error(
    `Unsupported simulation model provider: ${scenario?.model?.provider || "(empty)"}. Only "codex-session" is allowed.`,
  );
}
