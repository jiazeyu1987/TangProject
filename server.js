import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
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

const port = Number(process.env.PORT || 3000);
const configuredCodexPath = process.env.CODEX_CLI_PATH || "codex";
const model = process.env.CODEX_MODEL?.trim() || null;
const sandbox = normalizeSandbox(process.env.CODEX_SANDBOX || "read-only");

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
  const launch = getCodexLaunchSpec();
  if (!launch.available) {
    return {
      ok: false,
      configured: false,
      codexPath: configuredCodexPath,
      authStatus: launch.message,
      extractionMode: "heuristic-fallback",
      model,
      sandbox,
      dataStore: {
        path: STORE_PATH,
        projectCount: store.projects.length,
        taskCount: store.tasks.length,
      },
    };
  }

  const health = getCodexHealth();
  return {
    ok: health.available,
    configured: health.available && health.loggedIn,
    codexPath: launch.display,
    authStatus: health.message,
    extractionMode:
      health.available && health.loggedIn ? "local-codex-exec" : "heuristic-fallback",
    model,
    sandbox,
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
  const stageAfterId = resolveStageId(extracted.extraction.stageAfterUpdate) || stageBeforeId;
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
      dueAt: action.dueDate ? `${action.dueDate}T09:00:00.000Z` : fallbackTaskDueDate(visitDate),
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
  project.nextAction = extracted.extraction.nextStep || createdTasks[0]?.title || project.nextAction || "";
  project.nextActionDueAt = createdTasks[0]?.dueAt || project.nextActionDueAt || null;
  project.latestSummary = extracted.extraction.feedbackSummary;
  project.managerAttentionNeeded = extracted.extraction.managerAttentionNeeded;
  project.latestUpdateId = update.id;
  project.currentIssueTagIds = issueTagIds.length ? issueTagIds : project.currentIssueTagIds;
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
  const fallback = fallbackExtractIntake({ project, note, visitDate });
  const launch = getCodexLaunchSpec();
  const health = launch.available ? getCodexHealth() : null;

  if (!launch.available || !health?.available || !health.loggedIn) {
    return {
      source: "heuristic",
      warnings: [health?.message || launch.message || "Codex CLI unavailable."],
      extraction: fallback,
    };
  }

  try {
    const prompt = buildExtractionPrompt({ project, note, visitDate });
    const parsed = runCodexStructuredExtraction(prompt, launch);
    return {
      source: "codex",
      warnings: [],
      extraction: normalizeExtraction(parsed, { project, note, visitDate }),
    };
  } catch (error) {
    return {
      source: "heuristic",
      warnings: [error instanceof Error ? error.message : "Codex extraction failed."],
      extraction: fallback,
    };
  }
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

function runCodexStructuredExtraction(prompt, launch) {
  const outputPath = path.join(DATA_DIR, `codex-output-${crypto.randomUUID()}.json`);
  const args = [
    ...launch.prefixArgs,
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--output-schema",
    INTAKE_SCHEMA_PATH,
    "--output-last-message",
    outputPath,
    "--color",
    "never",
    "-C",
    __dirname,
  ];

  if (model) {
    args.push("-m", model);
  }

  args.push("-");

  const result = spawnSync(launch.command, args, {
    cwd: __dirname,
    env: process.env,
    encoding: "utf8",
    input: prompt,
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  const stderr = asString(result.stderr);
  const stdout = asString(result.stdout);

  try {
    const raw = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : stdout;
    const parsed = JSON.parse(raw);
    if (result.status !== 0) {
      throw new Error(stderr || stdout || `Codex exec exited with code ${result.status}.`);
    }
    return parsed;
  } finally {
    if (existsSync(outputPath)) {
      unlinkSync(outputPath);
    }
  }
}

function normalizeExtraction(raw, { project, note, visitDate }) {
  const nextActions = asArray(raw.next_actions || raw.nextActions)
    .map((item) => ({
      title: clipText(asString(item?.title), 80),
      assigneeName: clipText(asString(item?.assignee_name || item?.assigneeName), 40),
      dueDate: normalizeDateOnly(item?.due_date || item?.dueDate) || "",
    }))
    .filter((item) => item.title);

  return {
    department: clipText(asString(raw.department), 80),
    contacts: ensureUniqueByName(
      asArray(raw.contacts).map((item) => ({
        name: clipText(asString(item?.name), 40),
        role: clipText(asString(item?.role), 40),
      })),
    ).filter((item) => item.name),
    feedbackSummary: clipText(asString(raw.feedback_summary || raw.feedbackSummary) || note, 260),
    blockers: clipText(asString(raw.blockers), 180),
    opportunities: clipText(asString(raw.opportunities), 180),
    issues: uniqueStrings(
      asArray(raw.issues)
        .map((item) => resolveIssueTagName(asString(item)))
        .filter(Boolean),
    ),
    nextActions: nextActions.length
      ? nextActions
      : [{ title: fallbackActionTitle(note), assigneeName: "", dueDate: fallbackTaskDueDate(visitDate).slice(0, 10) }],
    stageAfterUpdate:
      resolveStageName(asString(raw.stage_after_update || raw.stageAfterUpdate)) ||
      getStageById(project.currentStageId).name,
    managerAttentionNeeded: Boolean(
      raw.manager_attention_needed ?? raw.managerAttentionNeeded ?? inferAttentionFlag(note),
    ),
    nextStep:
      clipText(asString(raw.next_step || raw.nextStep), 120) ||
      nextActions[0]?.title ||
      fallbackActionTitle(note),
  };
}
function fallbackExtractIntake({ project, note, visitDate }) {
  const issues = store.issueTags.filter((tag) => matchesIssueKeyword(tag.name, note)).map((tag) => tag.name);
  const nextStep = inferNextStep(note, issues);

  return {
    department: inferDepartment(project.hospitalId, note),
    contacts: inferContacts(note),
    feedbackSummary: clipText(note, 260),
    blockers: inferBlockers(note, issues),
    opportunities: inferOpportunities(note),
    issues,
    nextActions: [{ title: nextStep, assigneeName: "", dueDate: fallbackTaskDueDate(visitDate).slice(0, 10) }],
    stageAfterUpdate: inferStageFromText(note) || getStageById(project.currentStageId).name,
    managerAttentionNeeded: inferAttentionFlag(note),
    nextStep,
  };
}

function inferDepartment(hospitalId, note) {
  const currentDepartments = store.departments.filter((item) => item.hospitalId === hospitalId);
  for (const department of currentDepartments) {
    if (note.includes(department.name)) {
      return department.name;
    }
  }

  return ["疼痛科", "麻醉科", "康复科", "骨科", "介入科", "护理部"].find((item) => note.includes(item)) || "";
}

function inferContacts(note) {
  const matches = [];
  const pattern = /([\u4e00-\u9fa5]{1,3})(主任|院长|护士长|老师|医生)/g;
  let match = null;
  while ((match = pattern.exec(note))) {
    matches.push({ name: `${match[1]}${match[2]}`, role: match[2] });
  }
  return ensureUniqueByName(matches);
}

function inferBlockers(note, issues) {
  if (/卡|阻|收费|采购|流程|无法|担心/.test(note)) {
    return clipText(note, 180);
  }
  return issues.length ? `当前存在${issues.join("、")}相关阻力，需要继续跟进。` : "";
}

function inferOpportunities(note) {
  return /认可|愿意|接受|有兴趣|安排培训|推进/.test(note) ? clipText(note, 160) : "";
}

function inferNextStep(note, issues) {
  if (/培训/.test(note)) {
    return "确认培训时间并准备培训材料";
  }
  if (/试用|病例|使用/.test(note)) {
    return "跟进试用反馈并确认下一轮推进意见";
  }
  if (/收费|医保|成本/.test(note)) {
    return "补充收费与经济性说明材料";
  }
  if (/采购/.test(note)) {
    return "梳理采购流程并确认所需材料";
  }
  return issues.length ? `围绕${issues.join("、")}问题安排下一轮沟通` : fallbackActionTitle(note);
}

function fallbackActionTitle(note) {
  return /支持|总部/.test(note) ? "整理问题并提交给管理层跟进" : "整理本次医院反馈并安排下一次跟进";
}

function inferStageFromText(note) {
  const rules = [
    { pattern: /常规使用|稳定使用|持续使用/, value: "常规使用" },
    { pattern: /培训|操作培训|培训排期/, value: "培训排期" },
    { pattern: /试用|评估|病例/, value: "试用评估" },
    { pattern: /科室|接触|拜访|会面/, value: "科室接触" },
    { pattern: /建档|目标医院/, value: "目标建档" },
  ];
  return rules.find((item) => item.pattern.test(note))?.value || "";
}

function matchesIssueKeyword(issueName, note) {
  const patterns = {
    收费: /收费|医保|成本|价格|预算/,
    培训: /培训|带教|操作/,
    采购流程: /采购|招标|准入|审批/,
    临床价值: /价值|疗效|证据|病例/,
    院内协同: /协同|护理部|设备科|院办|多科室/,
    使用流程: /流程|路径|操作习惯/,
    科室支持: /主任|护士长|带头|支持力度/,
  };
  return patterns[issueName]?.test(note) || false;
}

function inferAttentionFlag(text) {
  return /卡|阻|收费|采购|担心|总部|支持|无法|招标/.test(text);
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

  const exact = store.issueTags.find((item) => item.name === normalized);
  if (exact) {
    return exact.name;
  }

  return store.issueTags.find((item) => normalized.includes(item.name) || item.name.includes(normalized))?.name || "";
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

  const exact = store.stages.find((item) => item.name === normalized);
  if (exact) {
    return exact.name;
  }

  const rules = [
    { pattern: /常规|使用/, value: "常规使用" },
    { pattern: /培训/, value: "培训排期" },
    { pattern: /试用|评估/, value: "试用评估" },
    { pattern: /科室|接触|拜访/, value: "科室接触" },
    { pattern: /建档|目标/, value: "目标建档" },
  ];
  return rules.find((item) => item.pattern.test(normalized))?.value || "";
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

function fallbackTaskDueDate(baseDate) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString();
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

function getCodexHealth() {
  const launch = getCodexLaunchSpec();
  if (!launch.available) {
    return { available: false, loggedIn: false, message: launch.message };
  }

  const result = spawnSync(launch.command, [...launch.prefixArgs, "login", "status"], {
    cwd: __dirname,
    env: process.env,
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
  });

  if (result.error) {
    return { available: false, loggedIn: false, message: result.error.message };
  }

  const message = asString(result.stdout || result.stderr);
  return {
    available: result.status === 0,
    loggedIn: result.status === 0 && /logged in/i.test(message),
    message: message || "Unknown Codex CLI status.",
  };
}

function getCodexLaunchSpec() {
  if (process.platform !== "win32") {
    return { available: true, command: configuredCodexPath, prefixArgs: [], display: configuredCodexPath };
  }

  const resolvedPath = resolveCodexPathOnWindows(configuredCodexPath);
  if (!resolvedPath) {
    return { available: false, message: `Could not resolve ${configuredCodexPath} on PATH.` };
  }

  if (/\.cmd$/i.test(resolvedPath) || /\.ps1$/i.test(resolvedPath)) {
    const scriptPath = path.join(
      path.dirname(resolvedPath),
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    );

    if (existsSync(scriptPath)) {
      return {
        available: true,
        command: process.execPath,
        prefixArgs: [scriptPath],
        display: resolvedPath,
      };
    }

    return { available: false, message: `Found ${resolvedPath} but could not locate codex.js beside it.` };
  }

  return { available: true, command: resolvedPath, prefixArgs: [], display: resolvedPath };
}

function resolveCodexPathOnWindows(target) {
  if (existsSync(target)) {
    return target;
  }

  const candidates = [/\.cmd$/i.test(target) || /\.ps1$/i.test(target) ? target : `${target}.cmd`, target];
  for (const name of candidates) {
    const result = spawnSync("where.exe", [name], {
      cwd: __dirname,
      env: process.env,
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    if (result.status === 0) {
      const match = (result.stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function normalizeSandbox(value) {
  const allowed = new Set(["read-only", "workspace-write", "danger-full-access"]);
  return allowed.has(value) ? value : "read-only";
}
