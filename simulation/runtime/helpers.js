import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : "Unknown error."}`);
  }
}

export async function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await fs.promises.writeFile(filePath, payload, "utf8");
}

export async function writeTextFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, String(value), "utf8");
}

export function copyDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
  });
}

export function computeFileHash(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export async function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Command failed (${command} ${args.join(" ")}): code=${code}\n${stderr || stdout || "(no output)"}`,
          ),
        );
        return;
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
}

export async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function utcIsoForSimDate(simDate, hour, minute) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${simDate}T${hh}:${mm}:00.000Z`;
}

export function nowCompact() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

export function createRunId() {
  const stamp = nowCompact();
  const rand = crypto.randomBytes(2).toString("hex");
  return `sim-${stamp}-${rand}`;
}

export function toIsoDateByOffset(startDate, offsetDays) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid start date: ${startDate}`);
  }
  date.setUTCDate(date.getUTCDate() + Number(offsetDays || 0));
  return date.toISOString().slice(0, 10);
}

export function normalizeForPath(value) {
  return String(value || "").replace(/\\/g, "/");
}
