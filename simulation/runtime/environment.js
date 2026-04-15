import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  copyDir,
  createRunId,
  ensureDir,
  execCommand,
  normalizeForPath,
  readJsonFile,
  utcIsoForSimDate,
  wait,
  writeJsonFile,
  writeTextFile,
} from "./helpers.js";

const HEALTH_TIMEOUT_MS = 120000;
const HEALTH_POLL_INTERVAL_MS = 1500;
const DEFAULT_SIMULATION_IMAGE = "local/tang-project:latest";

export async function initializeRuntime({ projectRoot, scenario }) {
  const { simulationImage } = ensureSimulationPrerequisites(scenario);

  const runId = createRunId();
  const runDir = path.join(projectRoot, "output", "simulations", runId);
  const envDir = path.join(runDir, "env");
  const runDataDir = path.join(envDir, "data");
  const runtimeDataDir = path.join(runDataDir, "runtime");
  const artifactsDir = path.join(runDir, "artifacts");
  const screenshotsDir = path.join(artifactsDir, "screenshots");
  const tracesDir = path.join(artifactsDir, "traces");
  const logsDir = path.join(runDir, "logs");
  const dailyDir = path.join(runDir, "daily");
  const snapshotsDir = path.join(runDir, "snapshots");
  const composeFile = path.join(envDir, "docker-compose.sim.yml");
  const clockFile = path.join(runtimeDataDir, "sim-clock.json");
  const runManifestFile = path.join(runDir, "run-manifest.json");
  const eventsFile = path.join(runDir, "events.jsonl");
  const finalReportFile = path.join(runDir, "final-report.md");
  const baselineMetricsFile = path.join(runDir, "baseline-metrics.json");
  const storeFile = path.join(runDataDir, "store.json");

  for (const directory of [
    runDir,
    envDir,
    runDataDir,
    runtimeDataDir,
    artifactsDir,
    screenshotsDir,
    tracesDir,
    logsDir,
    dailyDir,
    snapshotsDir,
  ]) {
    ensureDir(directory);
  }

  const sourceDataDir = path.join(projectRoot, "data");
  const sourceSeedFile = path.join(sourceDataDir, "seed-store.json");
  if (!fs.existsSync(sourceSeedFile)) {
    throw new Error(`Missing prerequisite file: ${sourceSeedFile}`);
  }
  copyDir(sourceDataDir, runDataDir);
  fs.copyFileSync(sourceSeedFile, storeFile);
  fs.writeFileSync(eventsFile, "", "utf8");

  const selectedPort = await findAvailablePort(scenario.basePort, 60);
  const dockerProjectName = toDockerProjectName(runId);
  const composeContent = buildSimulationComposeContent({
    projectRoot,
    runId,
    selectedPort,
    runDataDir,
    scenario,
    simulationImage,
  });
  await writeTextFile(composeFile, composeContent);

  const runtime = {
    runId,
    scenario,
    projectRoot,
    selectedPort,
    baseUrl: `http://127.0.0.1:${selectedPort}`,
    dockerProjectName,
    paths: {
      runDir,
      envDir,
      runDataDir,
      runtimeDataDir,
      composeFile,
      clockFile,
      artifactsDir,
      screenshotsDir,
      tracesDir,
      logsDir,
      dailyDir,
      snapshotsDir,
      runManifestFile,
      eventsFile,
      finalReportFile,
      baselineMetricsFile,
      storeFile,
    },
    clock: createClockController(clockFile),
  };

  await runtime.clock.setDay({
    simDate: scenario.startDate,
    dayIndex: 0,
    turnIndex: 0,
  });

  await writeJsonFile(runManifestFile, {
    runId,
    scenarioName: scenario.name,
    baseUrl: runtime.baseUrl,
    clockFile,
    accounts: [],
    startAt: new Date().toISOString(),
    endAt: null,
    status: "starting",
    simulation: {
      startDate: scenario.startDate,
      days: scenario.days,
    },
  });

  try {
    await execCommand(
      "docker",
      ["compose", "-f", composeFile, "-p", dockerProjectName, "up", "-d", "--build"],
      { cwd: projectRoot },
    );
    await waitForHealthy(runtime.baseUrl);
    const health = await fetchHealth(runtime.baseUrl);
    if (!health?.simulation?.enabled) {
      throw new Error("Simulation runtime did not start with simulation mode enabled.");
    }
    if (health?.simulation?.mode !== "simulation") {
      throw new Error(`Simulation runtime mode is invalid: ${health?.simulation?.mode || "(empty)"}`);
    }
    if (shouldRequireResponsesHealth(scenario) && health?.authStatus && health?.configured === false) {
      throw new Error(`Server prerequisite failed: ${health.authStatus}`);
    }
  } catch (error) {
    await execCommand(
      "docker",
      ["compose", "-f", composeFile, "-p", dockerProjectName, "down", "--remove-orphans"],
      { cwd: projectRoot },
    ).catch(() => {
      // Ignore shutdown failures during startup cleanup.
    });
    throw error;
  }

  await writeJsonFile(runManifestFile, {
    ...readJsonFile(runManifestFile),
    status: "running",
  });

  return runtime;
}

export async function shutdownRuntime(runtime) {
  if (!runtime) {
    return;
  }
  const manifest = readJsonFile(runtime.paths.runManifestFile);
  await writeJsonFile(runtime.paths.runManifestFile, {
    ...manifest,
    endAt: new Date().toISOString(),
    status: manifest.status === "failed" ? "failed" : manifest.status || "finished",
  });
  await execCommand(
    "docker",
    ["compose", "-f", runtime.paths.composeFile, "-p", runtime.dockerProjectName, "down", "--remove-orphans"],
    { cwd: runtime.projectRoot },
  ).catch(() => {
    // Keep shutdown best-effort so reports can still be collected.
  });
}

function ensureSimulationPrerequisites(scenario) {
  const simulationImage = resolveSimulationImage();
  const provider = String(scenario?.model?.provider || "").trim().toLowerCase();
  if (provider === "codex-session") {
    const check = spawnSync("codex", ["login", "status"], {
      shell: false,
      encoding: "utf8",
    });
    if (check.error) {
      throw new Error(
        `Codex CLI prerequisite failed: ${check.error instanceof Error ? check.error.message : String(check.error)}`,
      );
    }
    if (Number(check.status) !== 0) {
      throw new Error(
        `Codex CLI prerequisite failed. Please run \`codex login\` first. Details: ${String(check.stderr || check.stdout || "").trim().slice(0, 400)}`,
      );
    }
    const detail = `${String(check.stdout || "")}\n${String(check.stderr || "")}`.toLowerCase();
    if (detail.includes("not logged in") || detail.includes("login required")) {
      throw new Error("Codex CLI is not authenticated. Please run `codex login` first.");
    }
  }
  const imageCheck = spawnSync("docker", ["image", "inspect", simulationImage], {
    shell: false,
    encoding: "utf8",
  });
  if (imageCheck.error) {
    throw new Error(
      `Simulation Docker image prerequisite check failed: ${imageCheck.error instanceof Error ? imageCheck.error.message : String(imageCheck.error)}`,
    );
  }
  if (Number(imageCheck.status) !== 0) {
    throw new Error(
      `Simulation Docker image is missing: ${simulationImage}. Please build/deploy the app image on this host before running simulation.`,
    );
  }
  return {
    simulationImage,
  };
}

function shouldRequireResponsesHealth(scenario) {
  const provider = String(scenario?.model?.provider || "").trim().toLowerCase();
  return provider === "responses-api";
}

function createClockController(clockFile) {
  return {
    async setDay({ simDate, dayIndex, turnIndex }) {
      const hour = 12;
      const minute = Math.min(59, Number(turnIndex || 0) * 7);
      const currentDateTime = utcIsoForSimDate(simDate, hour, minute);
      await writeJsonFile(clockFile, {
        currentDate: simDate,
        currentDateTime,
        dayIndex,
        turnIndex,
        updatedAt: new Date().toISOString(),
      });
      return {
        currentDate: simDate,
        currentDateTime,
      };
    },
  };
}

async function waitForHealthy(baseUrl) {
  const startAt = Date.now();
  while (Date.now() - startAt < HEALTH_TIMEOUT_MS) {
    try {
      const health = await fetchHealth(baseUrl);
      if (health?.ok || health?.configured !== undefined) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await wait(HEALTH_POLL_INTERVAL_MS);
  }
  throw new Error(`Server did not become healthy within ${HEALTH_TIMEOUT_MS}ms.`);
}

async function fetchHealth(baseUrl) {
  const response = await fetch(`${baseUrl}/api/health`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `Health check failed with HTTP ${response.status}`);
  }
  return payload;
}

function toDockerProjectName(runId) {
  return `sim${String(runId || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40)}`;
}

async function findAvailablePort(basePort, maxAttempts) {
  const base = Number(basePort);
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = base + offset;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(
    `Could not allocate a simulation port starting from ${basePort} after ${maxAttempts} attempts.`,
  );
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function buildSimulationComposeContent({
  projectRoot,
  runId,
  selectedPort,
  runDataDir,
  scenario,
  simulationImage,
}) {
  const normalizedProjectRoot = normalizeForPath(projectRoot);
  const normalizedRunDataDir = normalizeForPath(runDataDir);
  const apiKey = String(process.env.OPENAI_API_KEY || "");
  const responsesBaseUrl = String(process.env.RESPONSES_BASE_URL || "https://api.asxs.top/v1");
  const responsesTimeoutMs = String(process.env.RESPONSES_TIMEOUT_MS || "120000");
  const responsesMaxConcurrentRequests = String(process.env.RESPONSES_MAX_CONCURRENT_REQUESTS || "2");
  const defaultInitialPassword = String(process.env.DEFAULT_INITIAL_PASSWORD || "123456");
  const backUpAdminAccount = String(process.env.BACKUP_ADMIN_ACCOUNT || "backup-admin");
  const backUpAdminName = String(process.env.BACKUP_ADMIN_NAME || "Data Backup Admin");

  const escape = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    "services:",
    "  tang-project:",
    `    image: "${escape(simulationImage)}"`,
    "    restart: \"no\"",
    "    ports:",
    `      - "${selectedPort}:3000"`,
    "    environment:",
    "      PORT: \"3000\"",
    `      RESPONSES_BASE_URL: "${escape(responsesBaseUrl)}"`,
    `      RESPONSES_MODEL: "${escape(scenario.model.name)}"`,
    `      OPENAI_API_KEY: "${escape(apiKey)}"`,
    `      RESPONSES_TIMEOUT_MS: "${escape(responsesTimeoutMs)}"`,
    `      RESPONSES_MAX_CONCURRENT_REQUESTS: "${escape(responsesMaxConcurrentRequests)}"`,
    `      DEFAULT_INITIAL_PASSWORD: "${escape(defaultInitialPassword)}"`,
    `      BACKUP_ADMIN_ACCOUNT: "${escape(backUpAdminAccount)}"`,
    `      BACKUP_ADMIN_NAME: "${escape(backUpAdminName)}"`,
    "      SIMULATION_MODE: \"true\"",
    "      SIMULATION_CLOCK_FILE: \"/app/data/runtime/sim-clock.json\"",
    "    volumes:",
    `      - "${escape(normalizedProjectRoot)}:/app"`,
    `      - "${escape(normalizedRunDataDir)}:/app/data"`,
    "",
  ].join("\n");
}

function resolveSimulationImage() {
  const candidate = String(process.env.SIMULATION_APP_IMAGE || "").trim();
  return candidate || DEFAULT_SIMULATION_IMAGE;
}
