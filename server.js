import crypto from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const SEED_STORE_PATH = path.join(DATA_DIR, "seed-store.json");
const INTAKE_SCHEMA_PATH = path.join(DATA_DIR, "intake-schema.json");
const INTAKE_RESPONSE_SCHEMA = readJsonFile(INTAKE_SCHEMA_PATH);

const port = Number(process.env.PORT || 3000);
const responsesBaseUrl = normalizeResponsesBaseUrl(
  process.env.RESPONSES_BASE_URL?.trim() || "https://api.asxs.top/v1",
);
const responsesModel = process.env.RESPONSES_MODEL?.trim() || "gpt-5.4";
const responsesApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const responsesTimeoutMs = toPositiveInteger(process.env.RESPONSES_TIMEOUT_MS, 120000);

let store = loadOrCreateStore();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json(buildHealthPayload());
});

app.get("/api/bootstrap", (_req, res) => {
  res.json(buildBootstrapPayload());
});

app.patch("/api/tasks/:taskId", (req, res) => {
  const task = store.tasks.find((item) => item.id === req.params.taskId);
  const taskStatus = asString(req.body?.taskStatus);
  const allowed = new Set(["todo", "in_progress", "blocked", "completed"]);

  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  if (!allowed.has(taskStatus)) {
    res.status(400).json({ error: "taskStatus is invalid." });
    return;
  }

  task.status = taskStatus;
  task.completedAt = taskStatus === "completed" ? nowIso() : null;
  touchStore();
  persistStore();

  res.json({
    ok: true,
    task: buildTaskView(task),
    bootstrap: buildBootstrapPayload(),
  });
});

app.post("/api/intake", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const project = store.projects.find((item) => item.id === projectId);

  if (!projectId) {
    res.status(400).json({ error: "projectId is required." });
    return;
  }

  if (!note) {
    res.status(400).json({ error: "note is required." });
    return;
  }

  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  try {
    const result = await processIntake({ project, note, visitDate });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process intake.",
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`AI clinical rollout MVP running at http://localhost:${port}`);
});

function buildBootstrapPayload() {
  const projects = buildProjectViews();
  const tasks = buildTaskViews();

  return {
    ok: true,
    generatedAt: nowIso(),
    health: buildHealthPayload(),
    currentUser: buildUserView(getCurrentUser()),
    lookups: {
      stages: [...store.stages].sort((left, right) => left.sortOrder - right.sortOrder),
      issueTags: store.issueTags,
      users: store.users.map((user) => buildUserView(user)),
      regions: store.regions,
    },
    dashboard: buildDashboard(projects, tasks),
    signals: buildSignals(projects, tasks),
    projects,
    tasks,
  };
}

function buildHealthPayload() {
  const health = getResponsesApiHealth();
  return {
    ok: health.configured,
    configured: health.configured,
    authStatus: health.message,
    extractionMode: health.configured ? "responses-api" : "unconfigured",
    model: responsesModel,
    baseUrl: responsesBaseUrl,
    dataStore: {
      path: STORE_PATH,
      projectCount: store.projects.length,
      taskCount: store.tasks.length,
    },
  };
}

function buildDashboard(projects, tasks) {
  const stageCounts = new Map();
  const issueCounts = new Map();

  for (const project of projects) {
    stageCounts.set(project.stage.name, (stageCounts.get(project.stage.name) || 0) + 1);
    for (const issueName of project.issueNames) {
      issueCounts.set(issueName, (issueCounts.get(issueName) || 0) + 1);
    }
  }

  return {
    totalProjects: projects.length,
    attentionProjects: projects.filter((project) => project.managerAttentionNeeded).length,
    overdueTasks: tasks.filter((task) => task.overdue).length,
    stalledProjects: projects.filter((project) => project.isStalled).length,
    tasksInFlight: tasks.filter((task) => task.status !== "completed").length,
    stageDistribution: mapCountEntries(stageCounts),
    issueDistribution: mapCountEntries(issueCounts),
  };
}

function buildSignals(projects, tasks) {
  return {
    attentionProjects: projects.filter((project) => project.managerAttentionNeeded).slice(0, 4),
    stalledProjects: projects.filter((project) => project.isStalled).slice(0, 4),
    overdueTasks: tasks.filter((task) => task.overdue).slice(0, 4),
    recentUpdates: [...store.updates]
      .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
      .slice(0, 5)
      .map((update) => buildUpdateView(update)),
  };
}

function buildProjectViews() {
  return [...store.projects].map((project) => buildProjectView(project)).sort(compareProjectViews);
}

function buildProjectView(project) {
  const hospital = getHospitalById(project.hospitalId);
  const region = getRegionById(project.regionId);
  const stage = getStageById(project.currentStageId);
  const tasks = store.tasks
    .filter((task) => task.projectId === project.id)
    .map((task) => buildTaskView(task))
    .sort(compareTaskViews);
  const updates = store.updates
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
    .map((update) => buildUpdateView(update));
  const contacts = store.contacts
    .filter((contact) => contact.hospitalId === project.hospitalId)
    .sort((left, right) => compareIsoDesc(left.lastContactAt, right.lastContactAt))
    .map((contact) => buildContactView(contact));
  const stalledDays = calculateStalledDays(project.lastFollowUpAt);

  return {
    id: project.id,
    hospital: {
      id: hospital.id,
      name: hospital.name,
      city: hospital.city,
      level: hospital.hospitalLevel,
    },
    region: {
      id: region.id,
      name: region.name,
    },
    owner: buildUserView(getUserById(project.ownerUserId)),
    stage: {
      id: stage.id,
      name: stage.name,
      code: stage.code,
    },
    riskLevel: project.riskLevel,
    managerAttentionNeeded: Boolean(project.managerAttentionNeeded),
    lastFollowUpAt: project.lastFollowUpAt,
    nextAction: project.nextAction,
    nextActionDueAt: project.nextActionDueAt,
    latestSummary: project.latestSummary,
    issueNames: (project.currentIssueTagIds || [])
      .map((id) => getIssueTagById(id)?.name)
      .filter(Boolean),
    blockers: updates[0]?.blockers || "",
    contacts,
    tasks,
    updates,
    metrics: {
      openTaskCount: tasks.filter((task) => task.status !== "completed").length,
      overdueTaskCount: tasks.filter((task) => task.overdue).length,
      updateCount: updates.length,
    },
    stalledDays,
    isStalled: stalledDays >= 10,
  };
}

function buildTaskViews() {
  return [...store.tasks].map((task) => buildTaskView(task)).sort(compareTaskViews);
}
function buildTaskView(task) {
  const project = getProjectById(task.projectId);
  const hospital = getHospitalById(project.hospitalId);
  const assignee = getUserById(task.assigneeUserId);
  const overdue = task.status !== "completed" && isDatePast(task.dueAt);

  return {
    id: task.id,
    projectId: task.projectId,
    hospitalName: hospital.name,
    title: task.title,
    description: task.description,
    assigneeName: assignee?.name || "未分配",
    dueAt: task.dueAt,
    status: task.status,
    effectiveStatus: overdue ? "overdue" : task.status,
    overdue,
    priority: task.priority,
    completedAt: task.completedAt,
  };
}

function buildUpdateView(update) {
  return {
    id: update.id,
    projectId: update.projectId,
    visitDate: update.visitDate,
    createdAt: update.createdAt,
    createdByName: getUserById(update.createdByUserId)?.name || "未知用户",
    departmentName: getDepartmentById(update.departmentId)?.name || "未填写",
    contacts: update.contactEntries || [],
    feedbackSummary: update.feedbackSummary,
    blockers: update.blockers,
    opportunities: update.opportunities,
    nextStep: update.nextStep,
    issueNames: (update.issueTagIds || []).map((id) => getIssueTagById(id)?.name).filter(Boolean),
    stageBeforeName: getStageById(update.stageBeforeId)?.name || "",
    stageAfterName: getStageById(update.stageAfterId)?.name || "",
    managerAttentionNeeded: Boolean(update.managerAttentionNeeded),
    sourceNote: update.sourceNote,
  };
}

function buildContactView(contact) {
  return {
    id: contact.id,
    name: contact.name,
    roleTitle: contact.roleTitle || "",
    departmentName: getDepartmentById(contact.departmentId)?.name || "",
    lastContactAt: contact.lastContactAt || null,
  };
}

function buildUserView(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    regionName: getRegionById(user.regionId)?.name || "",
  };
}

async function processIntake({ project, note, visitDate }) {
  const extracted = await extractStructuredUpdate({ project, note, visitDate });
  const currentUser = getCurrentUser();
  const departmentId = ensureDepartment(project.hospitalId, extracted.extraction.department);
  const stageBeforeId = project.currentStageId;
  const stageAfterId = resolveStageId(extracted.extraction.stageAfterUpdate);
  if (!stageAfterId) {
    throw new Error(`Unknown stage returned by Responses API: ${extracted.extraction.stageAfterUpdate}.`);
  }
  const issueTagIds = resolveIssueTagIds(extracted.extraction.issues);
  const contacts = extracted.extraction.contacts.map((contact) =>
    upsertHospitalContact({
      hospitalId: project.hospitalId,
      departmentId,
      name: contact.name,
      roleTitle: contact.role,
      lastContactAt: `${visitDate}T09:00:00.000Z`,
    }),
  );

  const session = {
    id: createId("session"),
    projectId: project.id,
    userId: currentUser.id,
    source: "web-intake",
    extractionSource: extracted.source,
    createdAt: nowIso(),
  };
  store.sessions.push(session);

  store.messages.push(
    {
      id: createId("message"),
      sessionId: session.id,
      senderType: "user",
      content: note,
      createdAt: nowIso(),
    },
    {
      id: createId("message"),
      sessionId: session.id,
      senderType: "assistant",
      content: JSON.stringify(extracted.extraction),
      createdAt: nowIso(),
    },
  );

  const update = {
    id: createId("update"),
    projectId: project.id,
    createdByUserId: currentUser.id,
    sessionId: session.id,
    visitDate,
    departmentId,
    contactEntries: contacts.map((contact) => ({
      contactId: contact.id,
      name: contact.name,
      role: contact.roleTitle || "",
    })),
    feedbackSummary: extracted.extraction.feedbackSummary,
    blockers: extracted.extraction.blockers,
    opportunities: extracted.extraction.opportunities,
    nextStep: extracted.extraction.nextStep,
    stageBeforeId,
    stageAfterId,
    managerAttentionNeeded: extracted.extraction.managerAttentionNeeded,
    issueTagIds,
    sourceNote: note,
    createdAt: nowIso(),
  };
  store.updates.push(update);

  const createdTasks = extracted.extraction.nextActions.map((action) => {
    const assignee = resolveUserByName(action.assigneeName) || getUserById(project.ownerUserId) || currentUser;
    const task = {
      id: createId("task"),
      projectId: project.id,
      updateId: update.id,
      title: action.title,
      description: `来源于 ${getHospitalById(project.hospitalId)?.name || "医院项目"} 的 AI 录入纪要。`,
      assigneeUserId: assignee.id,
      dueAt: action.dueDate ? `${action.dueDate}T09:00:00.000Z` : null,
      status: "todo",
      priority: extracted.extraction.managerAttentionNeeded ? "high" : "medium",
      completedAt: null,
      createdAt: nowIso(),
    };
    store.tasks.push(task);
    return task;
  });

  project.currentStageId = stageAfterId;
  project.lastFollowUpAt = `${visitDate}T09:00:00.000Z`;
  project.nextAction = extracted.extraction.nextStep || createdTasks[0]?.title || "";
  project.nextActionDueAt = createdTasks[0]?.dueAt || null;
  project.latestSummary = extracted.extraction.feedbackSummary;
  project.managerAttentionNeeded = extracted.extraction.managerAttentionNeeded;
  project.latestUpdateId = update.id;
  project.currentIssueTagIds = issueTagIds;
  project.riskLevel = deriveRiskLevel({
    managerAttentionNeeded: project.managerAttentionNeeded,
    issueCount: project.currentIssueTagIds.length,
    blockers: extracted.extraction.blockers,
    stalledDays: calculateStalledDays(project.lastFollowUpAt),
  });

  touchStore();
  persistStore();

  return {
    ok: true,
    extractionSource: extracted.source,
    extractionWarnings: extracted.warnings,
    extraction: extracted.extraction,
    update: buildUpdateView(update),
    createdTasks: createdTasks.map((task) => buildTaskView(task)),
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(),
  };
}

async function extractStructuredUpdate({ project, note, visitDate }) {
  const health = getResponsesApiHealth();
  if (!health.configured) {
    throw new Error(health.message);
  }

  const prompt = buildExtractionPrompt({ project, note, visitDate });
  const parsed = await runResponsesStructuredExtraction(prompt);
  return {
    source: "responses-api",
    warnings: [],
    extraction: normalizeExtraction(parsed),
  };
}

function buildExtractionPrompt({ project, note, visitDate }) {
  const hospital = getHospitalById(project.hospitalId);
  const stage = getStageById(project.currentStageId);
  const issueNames = store.issueTags.map((item) => item.name).join("、");
  const stageNames = [...store.stages]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => item.name)
    .join("、");

  return [
    "你是医疗器械医院导入项目的结构化纪要助手。",
    "请根据一线自由文本提取结构化字段，并且只输出 JSON。",
    "stage_after_update 必须严格使用可选阶段中的原值，issues 必须严格使用可选问题标签中的原值。",
    "next_actions 和 next_step 不允许留空，至少生成 1 条可执行动作；next_actions[*].due_date 如能判断请使用 YYYY-MM-DD，否则返回空字符串。",
    `医院：${hospital.name}`,
    `当前阶段：${stage.name}`,
    `记录日期：${visitDate}`,
    `可选阶段：${stageNames}`,
    `可选问题标签：${issueNames}`,
    "不能判断的字段请返回空字符串、空数组或 false。",
    "原始记录：",
    note,
  ].join("\n");
}

async function runResponsesStructuredExtraction(prompt) {
  const endpoint = `${responsesBaseUrl}/responses`;
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${responsesApiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: responsesModel,
        store: false,
        stream: true,
        instructions: "Return only JSON that matches the provided schema.",
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "intake_extraction",
            strict: true,
            schema: INTAKE_RESPONSE_SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(responsesTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && /abort|timeout/i.test(error.message)) {
      throw new Error(`Responses API request timed out after ${responsesTimeoutMs}ms.`);
    }
    throw new Error(
      `Responses API request failed: ${error instanceof Error ? error.message : "Unknown network error."}`,
    );
  }

  if (!response.ok) {
    const details = clipText(await response.text(), 400);
    throw new Error(
      `Responses API request failed with HTTP ${response.status}${details ? `: ${details}` : "."}`,
    );
  }

  const contentType = asString(response.headers.get("content-type")).toLowerCase();
  if (contentType.includes("text/event-stream")) {
    return parseResponsesEventStream(await response.text());
  }

  if (contentType.includes("application/json")) {
    return parseResponsesJsonPayload(await response.json());
  }

  throw new Error(
    `Responses API returned unsupported content type: ${contentType || "unknown"}.`,
  );
}

function normalizeExtraction(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Responses API returned an invalid extraction payload.");
  }

  const resolvedIssues = asArray(raw.issues).map((item) => {
    const resolved = resolveIssueTagName(item);
    if (!resolved && asString(item)) {
      throw new Error(`Responses API returned an unknown issue tag: ${asString(item)}.`);
    }
    return resolved;
  });

  const nextActions = asArray(raw.next_actions)
    .map((item) => ({
      title: clipText(asString(item?.title), 80),
      assigneeName: clipText(asString(item?.assignee_name), 40),
      dueDate: normalizeDateOnly(item?.due_date),
    }))
    .map((item, index) => {
      if (!item.title) {
        throw new Error(`Responses API returned next_actions[${index}] without a title.`);
      }
      return item;
    });

  if (!nextActions.length) {
    throw new Error("Responses API returned no next_actions.");
  }

  const stageAfterUpdate = resolveStageName(raw.stage_after_update);
  if (!stageAfterUpdate) {
    throw new Error(
      `Responses API returned an unknown stage_after_update: ${asString(raw.stage_after_update) || "(empty)"}.`,
    );
  }

  return {
    department: clipText(asString(raw.department), 80),
    contacts: ensureUniqueByName(
      asArray(raw.contacts).map((item) => ({
        name: clipText(asString(item?.name), 40),
        role: clipText(asString(item?.role), 40),
      })),
    ).filter((item) => item.name),
    feedbackSummary: clipText(asString(raw.feedback_summary), 260),
    blockers: clipText(asString(raw.blockers), 180),
    opportunities: clipText(asString(raw.opportunities), 180),
    issues: uniqueStrings(resolvedIssues.filter(Boolean)),
    nextActions,
    stageAfterUpdate,
    managerAttentionNeeded: Boolean(raw.manager_attention_needed),
    nextStep: clipText(asString(raw.next_step), 120),
  };
}

function ensureDepartment(hospitalId, departmentName) {
  const normalized = clipText(asString(departmentName), 80);
  if (!normalized) {
    return null;
  }

  const existing = store.departments.find(
    (item) => item.hospitalId === hospitalId && item.name.toLowerCase() === normalized.toLowerCase(),
  );
  if (existing) {
    return existing.id;
  }

  const department = { id: createId("department"), hospitalId, name: normalized };
  store.departments.push(department);
  return department.id;
}

function upsertHospitalContact({ hospitalId, departmentId, name, roleTitle, lastContactAt }) {
  const normalizedName = clipText(asString(name), 40);
  if (!normalizedName) {
    return { id: null, name: "", roleTitle: "" };
  }

  const existing = store.contacts.find(
    (item) => item.hospitalId === hospitalId && item.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (existing) {
    existing.departmentId = departmentId || existing.departmentId || null;
    existing.roleTitle = clipText(asString(roleTitle), 40) || existing.roleTitle || "";
    existing.lastContactAt = lastContactAt || existing.lastContactAt || nowIso();
    return existing;
  }

  const contact = {
    id: createId("contact"),
    hospitalId,
    departmentId: departmentId || null,
    name: normalizedName,
    roleTitle: clipText(asString(roleTitle), 40),
    lastContactAt: lastContactAt || nowIso(),
  };
  store.contacts.push(contact);
  return contact;
}

function resolveUserByName(name) {
  const normalized = asString(name).toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    store.users.find((user) => user.name.toLowerCase() === normalized) ||
    store.users.find((user) => user.name.toLowerCase().includes(normalized)) ||
    null
  );
}

function resolveIssueTagIds(issueNames) {
  return uniqueStrings(issueNames)
    .map((name) => store.issueTags.find((item) => item.name === name)?.id)
    .filter(Boolean);
}

function resolveIssueTagName(name) {
  const normalized = asString(name);
  if (!normalized) {
    return "";
  }

  return store.issueTags.find((item) => item.name === normalized)?.name || "";
}

function resolveStageId(stageName) {
  const resolved = resolveStageName(stageName);
  return store.stages.find((item) => item.name === resolved)?.id || null;
}

function resolveStageName(stageName) {
  const normalized = asString(stageName);
  if (!normalized) {
    return "";
  }

  return store.stages.find((item) => item.name === normalized)?.name || "";
}

function deriveRiskLevel({ managerAttentionNeeded, issueCount, blockers, stalledDays }) {
  if (managerAttentionNeeded || stalledDays >= 21 || issueCount >= 3) {
    return "high";
  }
  if (blockers || stalledDays >= 10 || issueCount >= 1) {
    return "normal";
  }
  return "low";
}

function compareProjectViews(left, right) {
  if (left.managerAttentionNeeded !== right.managerAttentionNeeded) {
    return Number(right.managerAttentionNeeded) - Number(left.managerAttentionNeeded);
  }
  if (left.isStalled !== right.isStalled) {
    return Number(right.isStalled) - Number(left.isStalled);
  }
  return compareIsoDesc(left.lastFollowUpAt, right.lastFollowUpAt);
}

function compareTaskViews(left, right) {
  const weight = { overdue: 0, blocked: 1, in_progress: 2, todo: 3, completed: 4 };
  const delta = (weight[left.effectiveStatus] ?? 99) - (weight[right.effectiveStatus] ?? 99);
  return delta || compareIsoAsc(left.dueAt, right.dueAt);
}
function loadOrCreateStore() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (!existsSync(STORE_PATH)) {
    if (!existsSync(SEED_STORE_PATH)) {
      throw new Error(`Missing seed store at ${SEED_STORE_PATH}`);
    }
    const seeded = JSON.parse(readFileSync(SEED_STORE_PATH, "utf8"));
    writeFileSync(STORE_PATH, JSON.stringify(seeded, null, 2), "utf8");
    return normalizeStoreShape(seeded);
  }

  return normalizeStoreShape(JSON.parse(readFileSync(STORE_PATH, "utf8")));
}

function normalizeStoreShape(input) {
  return {
    meta: input.meta || { version: "0.1.0", createdAt: nowIso(), updatedAt: nowIso() },
    currentUserId: input.currentUserId || "",
    regions: Array.isArray(input.regions) ? input.regions : [],
    users: Array.isArray(input.users) ? input.users : [],
    hospitals: Array.isArray(input.hospitals) ? input.hospitals : [],
    departments: Array.isArray(input.departments) ? input.departments : [],
    contacts: Array.isArray(input.contacts) ? input.contacts : [],
    stages: Array.isArray(input.stages) ? input.stages : [],
    issueTags: Array.isArray(input.issueTags) ? input.issueTags : [],
    projects: Array.isArray(input.projects) ? input.projects : [],
    updates: Array.isArray(input.updates) ? input.updates : [],
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    messages: Array.isArray(input.messages) ? input.messages : [],
  };
}

function persistStore() {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function touchStore() {
  store.meta.updatedAt = nowIso();
}

function getCurrentUser() {
  return getUserById(store.currentUserId) || store.users[0] || null;
}

function getProjectById(id) {
  return store.projects.find((item) => item.id === id);
}

function getHospitalById(id) {
  return store.hospitals.find((item) => item.id === id);
}

function getRegionById(id) {
  return store.regions.find((item) => item.id === id);
}

function getDepartmentById(id) {
  return store.departments.find((item) => item.id === id);
}

function getIssueTagById(id) {
  return store.issueTags.find((item) => item.id === id);
}

function getStageById(id) {
  return store.stages.find((item) => item.id === id);
}

function getUserById(id) {
  return store.users.find((item) => item.id === id);
}

function nowIso() {
  return new Date().toISOString();
}

function todayDateOnly() {
  return nowIso().slice(0, 10);
}

function calculateStalledDays(isoString) {
  if (!isoString) {
    return 999;
  }
  return Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000));
}

function isDatePast(isoString) {
  return Boolean(isoString) && new Date(isoString).getTime() < Date.now();
}

function compareIsoDesc(left, right) {
  return new Date(right || 0).getTime() - new Date(left || 0).getTime();
}

function compareIsoAsc(left, right) {
  return new Date(left || 8640000000000000).getTime() - new Date(right || 8640000000000000).getTime();
}

function normalizeDateOnly(value) {
  const text = asString(value);
  if (!text) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function clipText(value, maxLength) {
  const text = asString(value);
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function ensureUniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = asString(item?.name).toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapCountEntries(countMap) {
  return [...countMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getResponsesApiHealth() {
  if (!responsesBaseUrl) {
    return { configured: false, message: "RESPONSES_BASE_URL is required." };
  }
  if (/\/responses\/?$/i.test(responsesBaseUrl)) {
    return {
      configured: false,
      message: "RESPONSES_BASE_URL must point to the API root, for example https://api.asxs.top/v1.",
    };
  }
  if (!responsesApiKey) {
    return { configured: false, message: "OPENAI_API_KEY is required for intake extraction." };
  }
  if (!responsesModel) {
    return { configured: false, message: "RESPONSES_MODEL is required for intake extraction." };
  }

  return { configured: true, message: "Responses API configured." };
}

function parseResponsesEventStream(streamText) {
  let outputText = "";
  let responseError = null;

  for (const entry of parseSseEntries(streamText)) {
    if (!entry.data || entry.data === "[DONE]") {
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(entry.data);
    } catch {
      throw new Error("Responses API returned malformed SSE data.");
    }

    if (payload.type === "response.output_text.delta" && typeof payload.delta === "string") {
      outputText += payload.delta;
    }

    if (payload.type === "response.output_text.done" && typeof payload.text === "string") {
      outputText = payload.text;
    }

    if (payload.type === "response.completed" && payload.response?.error) {
      responseError = payload.response.error;
    }

    if ((payload.type === "response.failed" || payload.type === "response.error") && payload.error) {
      responseError = payload.error;
    }
  }

  if (responseError) {
    throw new Error(formatResponsesApiError(responseError));
  }
  if (!outputText) {
    throw new Error("Responses API stream completed without output text.");
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
    throw new Error("Responses API JSON response did not include output_text.");
  }

  return parseStructuredResponseText(outputText);
}

function parseStructuredResponseText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Responses API returned invalid JSON: ${clipText(text, 240) || "empty response"}`);
  }
}

function parseSseEntries(streamText) {
  return streamText
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const entry = { event: "", data: "" };
      const dataLines = [];

      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          entry.event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      entry.data = dataLines.join("\n");
      return entry;
    })
    .filter((entry) => entry.event || entry.data);
}

function formatResponsesApiError(error) {
  if (!error) {
    return "Responses API returned an unknown error.";
  }

  if (typeof error === "string") {
    return `Responses API error: ${error}`;
  }

  const code = asString(error.code);
  const message = asString(error.message) || asString(error.type) || "Unknown error.";
  return code ? `Responses API error (${code}): ${message}` : `Responses API error: ${message}`;
}

function normalizeResponsesBaseUrl(value) {
  return asString(value).replace(/\/+$/, "");
}

function toPositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallbackValue;
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
