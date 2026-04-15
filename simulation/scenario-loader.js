import path from "node:path";

import { readJsonFile } from "./runtime/helpers.js";

const ROLE_SET = new Set(["manager", "supervisor", "specialist"]);
const MODEL_PROVIDER = "codex-session";

export function loadScenario({ projectRoot, scenarioName }) {
  const normalizedName = String(scenarioName || "").trim() || "default-month";
  const scenarioFile = path.join(projectRoot, "simulation", "scenarios", `${normalizedName}.json`);
  const scenario = readJsonFile(scenarioFile);

  assertString(scenario?.name, "Scenario name is required.");
  assertIsoDate(scenario?.startDate, "Scenario startDate must be YYYY-MM-DD.");
  assertInteger(scenario?.days, "Scenario days must be a positive integer.", 1);
  assertInteger(scenario?.basePort, "Scenario basePort must be a positive integer.", 1);

  if (!Array.isArray(scenario.roster) || scenario.roster.length === 0) {
    throw new Error("Scenario roster is required.");
  }
  for (const item of scenario.roster) {
    if (!ROLE_SET.has(item?.role)) {
      throw new Error(`Scenario roster contains an unknown role: ${item?.role}`);
    }
    assertInteger(item?.count, `Scenario roster count for ${item.role} must be >= 1.`, 1);
  }

  const turnBudget = scenario.turnBudget || {};
  assertInteger(turnBudget.maxActionsPerTurn, "Scenario turnBudget.maxActionsPerTurn must be >= 1.", 1);
  assertInteger(turnBudget.roundsPerDay, "Scenario turnBudget.roundsPerDay must be >= 1.", 1);

  if (!scenario.model || typeof scenario.model !== "object") {
    throw new Error("Scenario model configuration is required.");
  }
  assertString(scenario.model.provider, "Scenario model.provider is required.");
  if (String(scenario.model.provider).trim().toLowerCase() !== MODEL_PROVIDER) {
    throw new Error(
      `Scenario model.provider must be "${MODEL_PROVIDER}" for real-model simulation.`,
    );
  }
  assertString(scenario.model.name, "Scenario model.name is required.");
  if (typeof scenario.model.temperature !== "number" || Number.isNaN(scenario.model.temperature)) {
    throw new Error("Scenario model.temperature must be a number.");
  }

  if (!scenario.scorecards || typeof scenario.scorecards !== "object") {
    throw new Error("Scenario scorecards are required.");
  }
  for (const role of ROLE_SET) {
    if (!scenario.scorecards[role] || typeof scenario.scorecards[role] !== "object") {
      throw new Error(`Scenario scorecards.${role} is required.`);
    }
  }
  assertWeightsSumToOne(scenario.scorecards.manager, "scorecards.manager");
  assertWeightsSumToOne(scenario.scorecards.supervisor, "scorecards.supervisor");
  assertWeightsSumToOne(scenario.scorecards.specialist, "scorecards.specialist");

  const artifactPolicy = scenario.artifactPolicy || {};
  assertInteger(artifactPolicy.screenshotsPerTurn, "Scenario artifactPolicy.screenshotsPerTurn must be >= 0.", 0);
  if (typeof artifactPolicy.recordTrace !== "boolean") {
    throw new Error("Scenario artifactPolicy.recordTrace must be boolean.");
  }

  return {
    name: scenario.name,
    startDate: scenario.startDate,
    days: scenario.days,
    basePort: scenario.basePort,
    roster: scenario.roster.map((item) => ({
      role: item.role,
      count: item.count,
    })),
    turnBudget: {
      maxActionsPerTurn: turnBudget.maxActionsPerTurn,
      roundsPerDay: turnBudget.roundsPerDay,
    },
    scorecards: scenario.scorecards,
    model: scenario.model,
    artifactPolicy: {
      screenshotsPerTurn: artifactPolicy.screenshotsPerTurn,
      recordTrace: artifactPolicy.recordTrace,
    },
  };
}

function assertString(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
}

function assertIsoDate(value, message) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(message);
  }
}

function assertInteger(value, message, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(message);
  }
}

function assertWeightsSumToOne(weightSet, label) {
  const entries = Object.entries(weightSet || {});
  if (!entries.length) {
    throw new Error(`${label} must define at least one KPI weight.`);
  }
  const invalid = entries.find(([, value]) => typeof value !== "number" || value < 0);
  if (invalid) {
    throw new Error(`${label}.${invalid[0]} must be a non-negative number.`);
  }
  const sum = entries.reduce((acc, [, value]) => acc + value, 0);
  if (Math.abs(sum - 1) > 0.0001) {
    throw new Error(`${label} weights must sum to 1. Current sum=${sum.toFixed(4)}.`);
  }
}
