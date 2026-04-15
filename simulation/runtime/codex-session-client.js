import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ACTION_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["decision", "reasoning", "expected_state_change", "action"],
  properties: {
    decision: {
      type: "string",
      enum: ["act", "idle"],
    },
    reasoning: {
      type: "string",
      minLength: 1,
      maxLength: 500,
    },
    expected_state_change: {
      type: "boolean",
    },
    action: {
      anyOf: [
        {
          type: "null",
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: [
                "open",
                "snapshot",
                "click",
                "fill",
                "type",
                "select",
                "press",
                "scroll",
                "wait",
                "extract_visible_text",
                "screenshot",
              ],
            },
            target: {
              type: "string",
              maxLength: 160,
            },
            value: {
              type: "string",
              maxLength: 4000,
            },
            key: {
              type: "string",
              maxLength: 30,
            },
            direction: {
              type: "string",
              enum: ["up", "down"],
            },
            pixels: {
              type: "integer",
              minimum: 1,
              maximum: 2000,
            },
            ms: {
              type: "integer",
              minimum: 100,
              maximum: 5000,
            },
            note: {
              type: "string",
              maxLength: 300,
            },
          },
        },
      ],
    },
  },
};

export class CodexSessionDecisionClient {
  constructor({ modelName, temperature }) {
    this.modelName = String(modelName || "").trim();
    this.temperature = Number(temperature);
    this.timeoutMs = toPositiveInteger(process.env.SIM_CODEX_TIMEOUT_MS, 300000);
    this.runtimeDirRelative = path.posix.join("output", ".sim-codex-runtime");
    this.runtimeDirAbsolute = path.join(
      process.cwd(),
      ...this.runtimeDirRelative.split("/"),
    );
    fs.mkdirSync(this.runtimeDirAbsolute, { recursive: true });
    this.schemaFileRelative = path.posix.join(
      this.runtimeDirRelative,
      `turn-action-schema-${process.pid}.json`,
    );
    this.schemaFileAbsolute = path.join(
      process.cwd(),
      ...this.schemaFileRelative.split("/"),
    );
    fs.writeFileSync(this.schemaFileAbsolute, `${JSON.stringify(ACTION_SCHEMA, null, 2)}\n`, "utf8");
    this.readyChecked = false;
  }

  async decideTurnAction(input) {
    await this.ensureReady();
    const prompt = buildDecisionPrompt(input);
    const payload = await this.runCodexSchemaDecision(prompt);
    return normalizeDecisionPayload(payload);
  }

  async ensureReady() {
    if (this.readyChecked) {
      return;
    }
    const loginStatus = await runProcessCommand({
      command: "codex",
      args: ["login", "status"],
      timeoutMs: 15000,
      stdinText: "",
    });
    if (loginStatus.timedOut) {
      throw new Error("Codex CLI prerequisite check timed out while running `codex login status`.");
    }
    if (loginStatus.code !== 0) {
      throw new Error(
        `Codex CLI prerequisite failed. Please run \`codex login\` first. Details: ${formatCmdError(loginStatus)}`,
      );
    }
    const merged = `${loginStatus.stdout}\n${loginStatus.stderr}`.toLowerCase();
    if (merged.includes("not logged in") || merged.includes("login required")) {
      throw new Error("Codex CLI is not authenticated. Please run `codex login` first.");
    }
    this.readyChecked = true;
  }

  async runCodexSchemaDecision(prompt) {
    const outputFileRelative = path.posix.join(
      this.runtimeDirRelative,
      `decision-${Date.now()}-${crypto.randomBytes(2).toString("hex")}.json`,
    );
    const outputFileAbsolute = path.join(
      process.cwd(),
      ...outputFileRelative.split("/"),
    );
    const invocation = buildCodexExecInvocation({
      schemaFile: this.schemaFileRelative,
      outputFile: outputFileRelative,
      modelName: this.modelName,
    });

    const result = await runProcessCommand({
      command: invocation.command,
      args: invocation.args,
      timeoutMs: this.timeoutMs,
      stdinText: prompt,
    });

    if (result.timedOut) {
      throw new Error(`Codex session request timed out after ${this.timeoutMs}ms.`);
    }
    if (result.code !== 0) {
      throw new Error(
        `Codex session request failed with exit code ${result.code}. ${formatCmdError(result)}`,
      );
    }
    if (!fs.existsSync(outputFileAbsolute)) {
      throw new Error("Codex session request finished without structured output file.");
    }

    const text = fs.readFileSync(outputFileAbsolute, "utf8").trim();
    if (!text) {
      throw new Error("Codex session returned empty structured output.");
    }
    const parsed = parseJsonWithFenceFallback(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Codex session returned non-object JSON payload.");
    }
    fs.unlink(outputFileAbsolute, () => {
      // Best-effort cleanup.
    });
    return parsed;
  }
}

function buildDecisionPrompt(input) {
  const {
    role,
    account,
    goalCard,
    previousSummary,
    simDate,
    actionBudget,
    currentActionIndex,
    snapshot,
  } = input;
  const snapshotElementLines = (snapshot?.elements || [])
    .slice(0, 60)
    .map(
      (item) =>
        `${item.id} | <${item.tag}> | text="${clipForPrompt(item.text, 80)}" | placeholder="${clipForPrompt(item.placeholder, 60)}" | aria="${clipForPrompt(item.ariaLabel, 60)}" | selector="${clipForPrompt(item.selector, 120)}"`,
    );

  return [
    "You are controlling a real browser UI to achieve role goals in a healthcare rollout system.",
    "Rules:",
    "- Use exactly one primitive action each response.",
    "- Prefer element references from the latest snapshot (e1/e2/...).",
    "- Never use hidden APIs or direct data edits.",
    "- If no meaningful action exists, return decision=idle.",
    "",
    `Role: ${role}`,
    `Account: ${account}`,
    `Simulation date: ${simDate}`,
    `Action budget in this turn: ${currentActionIndex}/${actionBudget}`,
    `Goal card: ${sanitizeForPrompt(goalCard)}`,
    `Previous summary: ${sanitizeForPrompt(previousSummary)}`,
    "",
    "Current page:",
    `url=${sanitizeForPrompt(snapshot?.url || "")}`,
    `title=${sanitizeForPrompt(snapshot?.title || "")}`,
    `bodyText=${clipForPrompt(snapshot?.bodyText || "", 1400)}`,
    "Interactive elements:",
    snapshotElementLines.length ? snapshotElementLines.join("\n") : "(none)",
    "",
    "Return JSON strictly following the provided schema.",
  ].join("\n");
}

function buildCodexExecInvocation({ schemaFile, outputFile, modelName }) {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "--ephemeral",
    "--output-schema",
    schemaFile,
    "--output-last-message",
    outputFile,
  ];
  if (modelName) {
    args.push("--model", modelName);
  }
  args.push("-");
  return {
    command: "codex",
    args,
  };
}

async function runProcessCommand({ command, args, timeoutMs, stdinText }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, Array.isArray(args) ? args : [], {
      cwd: process.cwd(),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: Number.isInteger(code) ? code : -1,
        stdout,
        stderr,
        timedOut,
      });
    });

    if (stdinText) {
      child.stdin.write(String(stdinText), "utf8");
    }
    child.stdin.end();
  });
}

function normalizeDecisionPayload(payload) {
  const decision = String(payload?.decision || "").trim();
  if (decision !== "act" && decision !== "idle") {
    throw new Error(`Codex session returned invalid decision value: ${decision}`);
  }
  const reasoning = String(payload?.reasoning || "").trim();
  if (!reasoning) {
    throw new Error("Codex session decision is missing reasoning.");
  }
  const expectedStateChange = payload?.expected_state_change === true;
  const action = payload?.action && typeof payload.action === "object" ? payload.action : null;
  if (decision === "act" && !action) {
    throw new Error("Codex session returned decision=act without action.");
  }
  if (decision === "idle" && action) {
    return {
      decision: "idle",
      reasoning,
      expectedStateChange: false,
      action: null,
    };
  }
  return {
    decision,
    reasoning,
    expectedStateChange,
    action: action
      ? {
          type: String(action.type || "").trim(),
          target: String(action.target || "").trim(),
          value: String(action.value || ""),
          key: String(action.key || "").trim(),
          direction: String(action.direction || "").trim(),
          pixels: Number(action.pixels || 0),
          ms: Number(action.ms || 0),
          note: String(action.note || "").trim(),
        }
      : null,
  };
}

function parseJsonWithFenceFallback(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!match) {
      throw new Error(`Codex session returned invalid JSON: ${String(text).slice(0, 260)}`);
    }
    try {
      return JSON.parse(match[1]);
    } catch {
      throw new Error(`Codex session returned invalid fenced JSON: ${String(text).slice(0, 260)}`);
    }
  }
}

function formatCmdError(result) {
  const merged = `${String(result?.stderr || "")}\n${String(result?.stdout || "")}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!merged.length) {
    return "No additional error output.";
  }
  const preferred =
    merged.find((line) => /unexpected status|service unavailable|temporarily unavailable/i.test(line)) ||
    null;
  if (preferred) {
    return String(preferred).slice(0, 500);
  }
  const errorLines = merged.filter((line) => line.startsWith("ERROR:"));
  const critical = errorLines.length ? errorLines[errorLines.length - 1] : merged[merged.length - 1];
  return String(critical).slice(0, 500);
}

function sanitizeForPrompt(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clipForPrompt(value, maxChars) {
  return sanitizeForPrompt(value).slice(0, Math.max(1, Number(maxChars) || 1));
}

function toPositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallbackValue;
}
