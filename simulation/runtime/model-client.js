const ACTION_SCHEMA = {
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

export class ResponsesDecisionClient {
  constructor({ modelName, temperature }) {
    this.modelName = String(modelName || "").trim();
    this.temperature = Number(temperature);
    this.baseUrl = normalizeBaseUrl(process.env.RESPONSES_BASE_URL || "https://api.asxs.top/v1");
    this.apiKey = String(process.env.OPENAI_API_KEY || "").trim();
    this.timeoutMs = toPositiveInteger(process.env.RESPONSES_TIMEOUT_MS, 120000);
    this.assertReady();
  }

  assertReady() {
    if (!this.baseUrl) {
      throw new Error("RESPONSES_BASE_URL is required for simulation model decisions.");
    }
    if (/\/responses\/?$/i.test(this.baseUrl)) {
      throw new Error("RESPONSES_BASE_URL must point to API root, not /responses endpoint.");
    }
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for simulation model decisions.");
    }
    if (!this.modelName) {
      throw new Error("Scenario model name is required.");
    }
    if (!Number.isFinite(this.temperature)) {
      throw new Error("Scenario model temperature must be numeric.");
    }
  }

  async decideTurnAction(input) {
    const prompt = buildDecisionPrompt(input);
    const payload = await this.runResponsesSchemaExtraction({
      prompt,
      schemaName: "simulation_turn_action",
      schema: ACTION_SCHEMA,
      instructions:
        "Return only JSON that strictly matches the schema. Decide one UI primitive action or idle.",
    });
    return normalizeDecisionPayload(payload);
  }

  async runResponsesSchemaExtraction({ prompt, schemaName, schema, instructions }) {
    const endpoint = `${this.baseUrl}/responses`;
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: this.modelName,
          store: false,
          stream: true,
          temperature: this.temperature,
          instructions,
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: prompt }],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              strict: true,
              schema,
            },
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && /abort|timeout/i.test(error.message)) {
        throw new Error(
          `Simulation model request timed out after ${this.timeoutMs}ms.`,
        );
      }
      throw new Error(
        `Simulation model request failed: ${error instanceof Error ? error.message : "Unknown network error."}`,
      );
    }

    if (!response.ok) {
      const details = String(await response.text() || "").slice(0, 600);
      throw new Error(
        `Simulation model request failed with HTTP ${response.status}${details ? `: ${details}` : "."}`,
      );
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/event-stream")) {
      return parseResponsesEventStream(response.body);
    }
    if (contentType.includes("application/json")) {
      return parseResponsesJsonPayload(await response.json());
    }
    throw new Error(
      `Simulation model returned unsupported content type: ${contentType || "unknown"}.`,
    );
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
    .slice(0, 120)
    .map(
      (item) =>
        `${item.id} | <${item.tag}> | text="${sanitizeForPrompt(item.text)}" | placeholder="${sanitizeForPrompt(item.placeholder)}" | aria="${sanitizeForPrompt(item.ariaLabel)}" | selector="${sanitizeForPrompt(item.selector)}"`,
    );
  return [
    "You are controlling a real browser UI to achieve role goals in a healthcare rollout system.",
    "Rules:",
    "- Use only one primitive action each response.",
    "- Prefer element references from the latest snapshot (e1/e2/...).",
    "- Do not invent hidden APIs or non-UI shortcuts.",
    "- If no meaningful action is possible, return decision=idle.",
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
    `bodyText=${sanitizeForPrompt(snapshot?.bodyText || "").slice(0, 2400)}`,
    "Interactive elements:",
    snapshotElementLines.length ? snapshotElementLines.join("\n") : "(none)",
    "",
    "Pick the most useful next action now.",
  ].join("\n");
}

function normalizeDecisionPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Simulation model returned an invalid decision payload.");
  }
  const decision = String(payload.decision || "").trim();
  if (decision !== "act" && decision !== "idle") {
    throw new Error(`Simulation model returned invalid decision value: ${decision}`);
  }
  const reasoning = String(payload.reasoning || "").trim();
  if (!reasoning) {
    throw new Error("Simulation model decision is missing reasoning.");
  }
  const expectedStateChange = payload.expected_state_change === true;
  const action = payload.action && typeof payload.action === "object" ? payload.action : null;
  if (decision === "act" && !action) {
    throw new Error("Simulation model returned decision=act without action.");
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

async function parseResponsesEventStream(body) {
  if (!body || typeof body.getReader !== "function") {
    throw new Error("Simulation model stream body is unavailable.");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";
  let responseError = null;
  let completed = false;

  const processEntry = (entry) => {
    if (!entry.data || entry.data === "[DONE]") {
      return;
    }
    let payload;
    try {
      payload = JSON.parse(entry.data);
    } catch {
      throw new Error("Simulation model returned malformed SSE data.");
    }
    if (payload.type === "response.output_text.delta" && typeof payload.delta === "string") {
      outputText += payload.delta;
    }
    if (payload.type === "response.output_text.done" && typeof payload.text === "string") {
      outputText = payload.text;
    }
    if (payload.type === "response.completed") {
      if (payload.response?.error) {
        responseError = payload.response.error;
      }
      completed = true;
    }
    if ((payload.type === "response.failed" || payload.type === "response.error") && payload.error) {
      responseError = payload.error;
      completed = true;
    }
  };

  try {
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const consumed = consumeSseBlocks(buffer);
      buffer = consumed.rest;
      for (const entry of consumed.entries) {
        processEntry(entry);
      }
      if (done) {
        break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation errors after completion.
    }
  }

  if (responseError) {
    throw new Error(formatResponsesApiError(responseError));
  }
  if (!outputText) {
    throw new Error("Simulation model stream completed without output text.");
  }
  return parseStructuredResponseText(outputText);
}

function parseResponsesJsonPayload(payload) {
  if (payload?.error) {
    throw new Error(formatResponsesApiError(payload.error));
  }
  const outputText =
    asString(payload?.output_text) ||
    asArray(payload?.output)
      .flatMap((item) => asArray(item?.content))
      .filter((item) => item?.type === "output_text")
      .map((item) => asString(item?.text))
      .join("");
  if (!outputText) {
    throw new Error("Simulation model JSON response did not include output_text.");
  }
  return parseStructuredResponseText(outputText);
}

function parseStructuredResponseText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Simulation model returned invalid JSON: ${String(text || "").slice(0, 240) || "empty response"}`,
    );
  }
}

function consumeSseBlocks(input) {
  let normalized = String(input || "").replace(/\r\n/g, "\n");
  const entries = [];
  let boundaryIndex = normalized.indexOf("\n\n");
  while (boundaryIndex !== -1) {
    const block = normalized.slice(0, boundaryIndex);
    normalized = normalized.slice(boundaryIndex + 2);
    const entry = parseSseBlock(block);
    if (entry.event || entry.data) {
      entries.push(entry);
    }
    boundaryIndex = normalized.indexOf("\n\n");
  }
  return {
    entries,
    rest: normalized,
  };
}

function parseSseBlock(block) {
  const entry = { event: "", data: "" };
  const dataLines = [];
  for (const line of String(block || "").split("\n")) {
    if (line.startsWith("event:")) {
      entry.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  entry.data = dataLines.join("\n");
  return entry;
}

function formatResponsesApiError(error) {
  if (!error) {
    return "Simulation model returned an unknown error.";
  }
  if (typeof error === "string") {
    return `Simulation model error: ${error}`;
  }
  const code = asString(error.code);
  const message = asString(error.message) || asString(error.type) || "Unknown error.";
  return code ? `Simulation model error (${code}): ${message}` : `Simulation model error: ${message}`;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function toPositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallbackValue;
}

function sanitizeForPrompt(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
