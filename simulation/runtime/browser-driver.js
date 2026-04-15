import path from "node:path";

import { chromium } from "playwright";

import { ensureDir } from "./helpers.js";

const ACTION_SET = new Set([
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
]);

export class BrowserDriver {
  constructor({
    baseUrl,
    roleLabel,
    artifactsDir,
    tracesDir,
    enableTrace,
  }) {
    this.baseUrl = baseUrl;
    this.roleLabel = roleLabel;
    this.artifactsDir = artifactsDir;
    this.tracesDir = tracesDir;
    this.enableTrace = enableTrace;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.snapshotElements = new Map();
    this.lastSnapshot = null;
  }

  async start(initialDateTimeIso) {
    ensureDir(this.artifactsDir);
    ensureDir(this.tracesDir);
    try {
      this.browser = await chromium.launch({
        headless: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to launch Chromium. Install browser binaries with "npx playwright install chromium". ${error instanceof Error ? error.message : ""}`.trim(),
      );
    }
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await this.context.addInitScript(buildDateOverrideInitScript(), {
      initialIso: initialDateTimeIso,
    });
    if (this.enableTrace) {
      await this.context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false,
      });
    }
    this.page = await this.context.newPage();
    await this.page.goto(this.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  }

  async stop() {
    try {
      if (this.context && this.enableTrace) {
        const tracePath = path.join(this.tracesDir, `${this.roleLabel}-trace.zip`);
        await this.context.tracing.stop({ path: tracePath });
      }
    } finally {
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async setSimulatedNow(isoDateTime) {
    if (!this.page) {
      throw new Error("Browser page has not been initialized.");
    }
    await this.page.evaluate((value) => {
      if (typeof window.__SIM_SET_NOW__ === "function") {
        window.__SIM_SET_NOW__(value);
      }
    }, String(isoDateTime));
  }

  async captureSnapshot() {
    if (!this.page) {
      throw new Error("Browser page has not been initialized.");
    }
    const payload = await this.page.evaluate(() => {
      const isVisible = (element) => {
        if (!element) {
          return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const cssEscape = (value) => {
        if (window.CSS && typeof window.CSS.escape === "function") {
          return window.CSS.escape(value);
        }
        return String(value).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      };

      const buildSelector = (node) => {
        if (!node || node.nodeType !== 1) {
          return "";
        }
        if (node.id) {
          return `#${cssEscape(node.id)}`;
        }
        const parts = [];
        let cursor = node;
        while (cursor && cursor.nodeType === 1 && parts.length < 6) {
          let part = cursor.tagName.toLowerCase();
          if (cursor.classList?.length) {
            const classes = [...cursor.classList]
              .map((name) => cssEscape(name))
              .slice(0, 2)
              .join(".");
            if (classes) {
              part += `.${classes}`;
            }
          }
          const parent = cursor.parentElement;
          if (parent) {
            const siblings = [...parent.children].filter(
              (child) => child.tagName === cursor.tagName,
            );
            if (siblings.length > 1) {
              const index = siblings.indexOf(cursor) + 1;
              part += `:nth-of-type(${index})`;
            }
          }
          parts.unshift(part);
          if (cursor.id) {
            parts[0] = `#${cssEscape(cursor.id)}`;
            break;
          }
          cursor = parent;
        }
        return parts.join(" > ");
      };

      const extractText = (node) => {
        const text = (node.innerText || node.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        return text.slice(0, 120);
      };

      const nodes = [
        ...document.querySelectorAll(
          "button, input, select, textarea, a, [role='button'], [tabindex]",
        ),
      ]
        .filter(isVisible)
        .slice(0, 180)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          type: node.getAttribute("type") || "",
          selector: buildSelector(node),
          text: extractText(node),
          ariaLabel: node.getAttribute("aria-label") || "",
          placeholder: node.getAttribute("placeholder") || "",
          value:
            node instanceof HTMLInputElement ||
            node instanceof HTMLTextAreaElement ||
            node instanceof HTMLSelectElement
              ? String(node.value || "")
              : "",
        }))
        .filter((item) => item.selector);

      const bodyText = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
      return {
        url: window.location.href,
        title: document.title,
        bodyText,
        elements: nodes,
      };
    });

    this.snapshotElements.clear();
    const elements = payload.elements.map((item, index) => {
      const id = `e${index + 1}`;
      const output = { id, ...item };
      this.snapshotElements.set(id, output);
      return output;
    });

    this.lastSnapshot = {
      capturedAt: new Date().toISOString(),
      url: payload.url,
      title: payload.title,
      bodyText: payload.bodyText,
      elements,
    };
    return this.lastSnapshot;
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }

  hasElementReference(reference) {
    return this.snapshotElements.has(reference);
  }

  async executeAction(action, options = {}) {
    if (!this.page) {
      throw new Error("Browser page has not been initialized.");
    }
    if (!action || typeof action !== "object") {
      throw new Error("Action payload is invalid.");
    }
    const actionType = String(action.type || "").trim();
    if (!ACTION_SET.has(actionType)) {
      throw new Error(`Unsupported action type: ${actionType}`);
    }

    if (actionType === "open") {
      const target = String(action.value || "").trim() || this.baseUrl;
      const url = target.startsWith("http") ? target : new URL(target, this.baseUrl).toString();
      await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return { actionType, detail: { url } };
    }

    if (actionType === "snapshot") {
      const snapshot = await this.captureSnapshot();
      return {
        actionType,
        detail: {
          url: snapshot.url,
          title: snapshot.title,
          elementCount: snapshot.elements.length,
        },
      };
    }

    if (actionType === "wait") {
      const ms = Math.max(100, Math.min(5000, Number(action.ms || 800)));
      await this.page.waitForTimeout(ms);
      return { actionType, detail: { ms } };
    }

    if (actionType === "scroll") {
      const pixelsRaw = Number(action.pixels || 500);
      const direction = String(action.direction || "down").toLowerCase();
      const pixels = Math.max(50, Math.min(2000, Math.abs(pixelsRaw)));
      const delta = direction === "up" ? -pixels : pixels;
      await this.page.mouse.wheel(0, delta);
      return { actionType, detail: { direction, pixels } };
    }

    if (actionType === "press") {
      const key = String(action.key || action.value || "").trim();
      if (!key) {
        throw new Error("Action press requires a key.");
      }
      await this.page.keyboard.press(key);
      return { actionType, detail: { key } };
    }

    if (actionType === "extract_visible_text") {
      const text = await this.page.evaluate(() =>
        (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 6000),
      );
      return {
        actionType,
        detail: {
          text: String(text || ""),
        },
      };
    }

    if (actionType === "screenshot") {
      const fileName = options.screenshotFileName || `${this.roleLabel}-${Date.now()}.png`;
      const target = path.join(this.artifactsDir, fileName);
      await this.page.screenshot({
        path: target,
        fullPage: true,
      });
      return {
        actionType,
        detail: {
          file: target,
        },
      };
    }

    const target = this.resolveTarget(action.target);
    const locator = this.page.locator(target.selector).first();
    if (actionType === "click") {
      const promptValue = String(action.value || "");
      if (promptValue) {
        const dialogPromise = this.page.waitForEvent("dialog", {
          timeout: 1200,
        });
        await locator.click({ timeout: 10000 });
        try {
          const dialog = await dialogPromise;
          await dialog.accept(promptValue);
        } catch {
          // If no dialog appears, continue without fallback behavior.
        }
      } else {
        await locator.click({ timeout: 10000 });
      }
      return { actionType, detail: { target } };
    }
    if (actionType === "fill") {
      const value = String(action.value || "");
      await locator.fill(value, { timeout: 10000 });
      return { actionType, detail: { target, value } };
    }
    if (actionType === "type") {
      const value = String(action.value || "");
      await locator.click({ timeout: 10000 });
      await this.page.keyboard.type(value);
      return { actionType, detail: { target, value } };
    }
    if (actionType === "select") {
      const value = String(action.value || "");
      await locator.selectOption(value);
      return { actionType, detail: { target, value } };
    }

    throw new Error(`Action type is not implemented: ${actionType}`);
  }

  resolveTarget(rawTarget) {
    const target = String(rawTarget || "").trim();
    if (!target) {
      throw new Error("Action target is required for this action type.");
    }
    if (target.startsWith("e")) {
      const mapped = this.snapshotElements.get(target);
      if (!mapped) {
        throw new Error(`No snapshot element found for reference ${target}.`);
      }
      return {
        elementRef: target,
        selector: mapped.selector,
      };
    }
    return {
      elementRef: null,
      selector: target,
    };
  }
}

function buildDateOverrideInitScript() {
  return ({ initialIso }) => {
    const RealDate = Date;
    const state = {
      nowMs: Number.isFinite(new RealDate(initialIso).getTime())
        ? new RealDate(initialIso).getTime()
        : null,
    };

    window.__SIM_SET_NOW__ = (value) => {
      const parsed = new RealDate(String(value || ""));
      if (!Number.isFinite(parsed.getTime())) {
        throw new Error(`Invalid simulated date: ${value}`);
      }
      try {
        localStorage.setItem("__SIM_NOW_ISO__", parsed.toISOString());
      } catch {
        // Ignore storage failures for origins that disallow storage.
      }
      state.nowMs = parsed.getTime();
    };

    try {
      const localIso = localStorage.getItem("__SIM_NOW_ISO__");
      if (localIso) {
        const parsed = new RealDate(localIso);
        if (Number.isFinite(parsed.getTime())) {
          state.nowMs = parsed.getTime();
        }
      }
    } catch {
      // Ignore storage failures for origins that disallow storage.
    }

    class SimDate extends RealDate {
      constructor(...args) {
        if (args.length === 0 && state.nowMs !== null) {
          super(state.nowMs);
        } else {
          super(...args);
        }
      }

      static now() {
        return state.nowMs !== null ? state.nowMs : RealDate.now();
      }
    }

    SimDate.parse = RealDate.parse.bind(RealDate);
    SimDate.UTC = RealDate.UTC.bind(RealDate);
    window.Date = SimDate;
  };
}
