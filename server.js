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
const FOLLOWUP_QUESTIONS_SCHEMA_PATH = path.join(DATA_DIR, "followup-questions-schema.json");
const INTAKE_RESPONSE_SCHEMA = readJsonFile(INTAKE_SCHEMA_PATH);
const FOLLOWUP_QUESTIONS_RESPONSE_SCHEMA = readJsonFile(FOLLOWUP_QUESTIONS_SCHEMA_PATH);

const port = Number(process.env.PORT || 3000);
const responsesBaseUrl = normalizeResponsesBaseUrl(
  process.env.RESPONSES_BASE_URL?.trim() || "https://api.asxs.top/v1",
);
const responsesModel = process.env.RESPONSES_MODEL?.trim() || "gpt-5.4";
const responsesApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const responsesTimeoutMs = toPositiveInteger(process.env.RESPONSES_TIMEOUT_MS, 120000);
const SUPERVISOR_ROLES = new Set(["regional_manager", "district_manager", "director", "supervisor", "vp"]);

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

app.post("/api/projects", (req, res) => {
  const hospitalName = clipText(asString(req.body?.hospitalName), 120);
  const city = clipText(asString(req.body?.city), 40);
  const hospitalLevel = clipText(asString(req.body?.hospitalLevel), 20) || "未知";
  const currentUser = getCurrentUser();
  const defaultStage = [...store.stages].sort((left, right) => left.sortOrder - right.sortOrder)[0];
  const regionId = asString(req.body?.regionId) || currentUser?.regionId || store.regions[0]?.id || "";
  const ownerUserId = asString(req.body?.ownerUserId) || currentUser?.id || store.users[0]?.id || "";
  const currentStageId = asString(req.body?.currentStageId) || defaultStage?.id || "";

  if (!hospitalName) {
    res.status(400).json({ error: "hospitalName is required." });
    return;
  }
  if (!regionId || !getRegionById(regionId)) {
    res.status(400).json({ error: "regionId is invalid." });
    return;
  }
  if (!ownerUserId || !getUserById(ownerUserId)) {
    res.status(400).json({ error: "ownerUserId is invalid." });
    return;
  }
  if (!currentStageId || !getStageById(currentStageId)) {
    res.status(400).json({ error: "currentStageId is invalid." });
    return;
  }

  const duplicate = store.hospitals.find(
    (item) => item.name.toLowerCase() === hospitalName.toLowerCase(),
  );
  if (duplicate) {
    res.status(409).json({ error: "Hospital already exists." });
    return;
  }

  const hospital = {
    id: createId("hospital"),
    regionId,
    name: hospitalName,
    hospitalLevel,
    city,
  };
  store.hospitals.push(hospital);

  const project = {
    id: createId("project"),
    hospitalId: hospital.id,
    regionId,
    ownerUserId,
    currentStageId,
    riskLevel: "normal",
    managerAttentionNeeded: false,
    lastFollowUpAt: nowIso(),
    nextAction: "",
    nextActionDueAt: null,
    latestSummary: "新建医院项目，待录入首次纪要。",
    currentIssueTagIds: [],
    latestUpdateId: null,
  };
  store.projects.push(project);

  touchStore();
  persistStore();

  res.json({
    ok: true,
    hospital,
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(),
  });
});

app.post("/api/projects/:projectId/remarks", (req, res) => {
  const projectId = asString(req.params?.projectId);
  const content = clipText(asString(req.body?.content), 300);
  const toUserId = asString(req.body?.toUserId);
  const updateId = asString(req.body?.updateId);
  const currentUser = getCurrentUser();
  const project = getProjectById(projectId);

  if (!projectId) {
    res.status(400).json({ error: "projectId is required." });
    return;
  }
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!currentUser) {
    res.status(400).json({ error: "Current user is invalid." });
    return;
  }
  if (!SUPERVISOR_ROLES.has(asString(currentUser.role))) {
    res.status(403).json({ error: "Only supervisors can leave project remarks." });
    return;
  }
  if (!content) {
    res.status(400).json({ error: "content is required." });
    return;
  }

  const targetUserId = toUserId || project.ownerUserId;
  const targetUser = getUserById(targetUserId);
  if (!targetUser) {
    res.status(400).json({ error: "toUserId is invalid." });
    return;
  }
  if (updateId) {
    const update = store.updates.find((item) => item.id === updateId);
    if (!update || update.projectId !== project.id) {
      res.status(400).json({ error: "updateId is invalid for this project." });
      return;
    }
  }

  const remark = {
    id: createId("remark"),
    projectId: project.id,
    updateId: updateId || null,
    fromUserId: currentUser.id,
    toUserId: targetUser.id,
    content,
    createdAt: nowIso(),
    replyContent: "",
    replyByUserId: "",
    repliedAt: null,
    readByUserId: "",
    readAt: null,
  };
  store.remarks.push(remark);

  touchStore();
  persistStore();

  res.json({
    ok: true,
    remark: buildProjectRemarkView(remark),
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(),
  });
});

app.post("/api/project-remarks/:remarkId/reply", (req, res) => {
  const remarkId = asString(req.params?.remarkId);
  const reply = clipText(asString(req.body?.reply), 300);
  const currentUser = getCurrentUser();
  const remark = getRemarkById(remarkId);

  if (!remarkId) {
    res.status(400).json({ error: "remarkId is required." });
    return;
  }
  if (!remark) {
    res.status(404).json({ error: "Remark not found." });
    return;
  }
  if (!reply) {
    res.status(400).json({ error: "reply is required." });
    return;
  }
  if (!currentUser) {
    res.status(400).json({ error: "Current user is invalid." });
    return;
  }
  if (remark.replyContent) {
    res.status(400).json({ error: "Remark has already been replied." });
    return;
  }

  const project = getProjectById(remark.projectId);
  if (!project) {
    res.status(404).json({ error: "Project for remark not found." });
    return;
  }
  if (currentUser.id !== remark.toUserId && currentUser.id !== project.ownerUserId) {
    res.status(403).json({ error: "Only the assignee can reply this remark." });
    return;
  }

  remark.replyContent = reply;
  remark.replyByUserId = currentUser.id;
  remark.repliedAt = nowIso();
  if (!remark.readAt) {
    remark.readByUserId = currentUser.id;
    remark.readAt = nowIso();
  }

  touchStore();
  persistStore();

  res.json({
    ok: true,
    remark: buildProjectRemarkView(remark),
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(),
  });
});

app.post("/api/project-remarks/:remarkId/read", (req, res) => {
  const remarkId = asString(req.params?.remarkId);
  const currentUser = getCurrentUser();
  const remark = getRemarkById(remarkId);

  if (!remarkId) {
    res.status(400).json({ error: "remarkId is required." });
    return;
  }
  if (!remark) {
    res.status(404).json({ error: "Remark not found." });
    return;
  }
  if (!currentUser) {
    res.status(400).json({ error: "Current user is invalid." });
    return;
  }

  const project = getProjectById(remark.projectId);
  if (!project) {
    res.status(404).json({ error: "Project for remark not found." });
    return;
  }
  const canRead =
    currentUser.id === remark.toUserId ||
    currentUser.id === project.ownerUserId ||
    currentUser.id === remark.fromUserId ||
    SUPERVISOR_ROLES.has(asString(currentUser.role));
  if (!canRead) {
    res.status(403).json({ error: "Current user is not allowed to mark this remark as read." });
    return;
  }

  if (!remark.readAt) {
    remark.readByUserId = currentUser.id;
    remark.readAt = nowIso();
    touchStore();
    persistStore();
  }

  res.json({
    ok: true,
    remark: buildProjectRemarkView(remark),
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(),
  });
});

app.post("/api/followups/question", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const sessionId = asString(req.body?.sessionId);
  const scenario = parseScenarioPayload(req.body?.scenario);
  const project = store.projects.find((item) => item.id === projectId);

  if (!projectId) {
    res.status(400).json({ error: "projectId is required." });
    return;
  }
  if (!note) {
    res.status(400).json({ error: "note is required." });
    return;
  }
  if (!scenario) {
    res.status(400).json({ error: "scenario is required." });
    return;
  }
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  let followupSession;
  if (sessionId) {
    followupSession = getFollowupSessionById(sessionId);
    if (!followupSession) {
      res.status(404).json({ error: "Follow-up session not found." });
      return;
    }
    if (followupSession.projectId !== projectId) {
      res.status(400).json({ error: "Follow-up session does not belong to the project." });
      return;
    }
    if (followupSession.closedAt) {
      res.status(400).json({ error: "Follow-up session has been closed." });
      return;
    }
  } else {
    followupSession = null;
  }

  try {
    const result = await createFollowupQuestions({
      session: followupSession,
      project,
      note,
      visitDate,
      scenario,
      source: "web-followup",
      minQuestions: 1,
      maxQuestions: 1,
    });
    res.json({
      ok: true,
      sessionId: result.sessionId,
      question: result.questions[0] || null,
      history: result.history,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate follow-up question.",
    });
  }
});

app.post("/api/followups/questions", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const sessionId = asString(req.body?.sessionId);
  const scenario = parseScenarioPayload(req.body?.scenario);
  const project = store.projects.find((item) => item.id === projectId);

  if (!projectId) {
    res.status(400).json({ error: "projectId is required." });
    return;
  }
  if (!note) {
    res.status(400).json({ error: "note is required." });
    return;
  }
  if (!scenario) {
    res.status(400).json({ error: "scenario is required." });
    return;
  }
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  let followupSession;
  if (sessionId) {
    followupSession = getFollowupSessionById(sessionId);
    if (!followupSession) {
      res.status(404).json({ error: "Follow-up session not found." });
      return;
    }
    if (followupSession.projectId !== projectId) {
      res.status(400).json({ error: "Follow-up session does not belong to the project." });
      return;
    }
    if (followupSession.closedAt) {
      res.status(400).json({ error: "Follow-up session has been closed." });
      return;
    }
  } else {
    followupSession = null;
  }

  try {
    const result = await createFollowupQuestions({
      session: followupSession,
      project,
      note,
      visitDate,
      scenario,
      source: "web-followup",
      minQuestions: 1,
      maxQuestions: 3,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate follow-up question.",
    });
  }
});

app.post("/api/followups/answer", (req, res) => {
  const sessionId = asString(req.body?.sessionId);
  const questionMessageId = asString(req.body?.questionMessageId);
  const answer = asString(req.body?.answer);
  const scenario = parseScenarioPayload(req.body?.scenario);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required." });
    return;
  }
  if (!questionMessageId) {
    res.status(400).json({ error: "questionMessageId is required." });
    return;
  }
  if (!answer) {
    res.status(400).json({ error: "answer is required." });
    return;
  }
  if (!scenario) {
    res.status(400).json({ error: "scenario is required." });
    return;
  }

  const session = getFollowupSessionById(sessionId);
  if (!session) {
    res.status(404).json({ error: "Follow-up session not found." });
    return;
  }
  if (session.closedAt) {
    res.status(400).json({ error: "Follow-up session has been closed." });
    return;
  }

  const questionMessage = store.messages.find(
    (item) =>
      item.id === questionMessageId &&
      item.sessionId === sessionId &&
      item.kind === "followup_question",
  );
  if (!questionMessage) {
    res.status(404).json({ error: "Follow-up question not found." });
    return;
  }
  if (questionMessage.questionStatus !== "pending_answer") {
    res.status(400).json({ error: "The follow-up question is not waiting for an answer." });
    return;
  }

  const result = answerFollowupQuestion({
    session,
    questionMessage,
    answer,
    scenario,
  });
  res.json(result);
});

app.post("/api/followups/answers", (req, res) => {
  const sessionId = asString(req.body?.sessionId);
  const scenario = parseScenarioPayload(req.body?.scenario);
  const answersRaw = Array.isArray(req.body?.answers) ? req.body.answers : null;

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required." });
    return;
  }
  if (!answersRaw || !answersRaw.length) {
    res.status(400).json({ error: "answers is required and must be a non-empty array." });
    return;
  }
  if (!scenario) {
    res.status(400).json({ error: "scenario is required." });
    return;
  }

  const session = getFollowupSessionById(sessionId);
  if (!session) {
    res.status(404).json({ error: "Follow-up session not found." });
    return;
  }
  if (session.closedAt) {
    res.status(400).json({ error: "Follow-up session has been closed." });
    return;
  }

  const normalizedAnswers = answersRaw.map((item) => ({
    questionMessageId: asString(item?.questionMessageId),
    answer: asString(item?.answer),
  }));
  if (normalizedAnswers.some((item) => !item.questionMessageId || !item.answer)) {
    res.status(400).json({
      error: "Each answers item must include questionMessageId and answer.",
    });
    return;
  }

  const uniqueQuestionIds = new Set(normalizedAnswers.map((item) => item.questionMessageId));
  if (uniqueQuestionIds.size !== normalizedAnswers.length) {
    res.status(400).json({ error: "answers contains duplicated questionMessageId." });
    return;
  }

  const items = [];
  for (const item of normalizedAnswers) {
    const questionMessage = store.messages.find(
      (message) =>
        message.id === item.questionMessageId &&
        message.sessionId === sessionId &&
        message.kind === "followup_question",
    );
    if (!questionMessage) {
      res.status(404).json({ error: `Follow-up question not found: ${item.questionMessageId}` });
      return;
    }
    if (questionMessage.questionStatus !== "pending_answer") {
      res.status(400).json({
        error: `The follow-up question is not waiting for an answer: ${item.questionMessageId}`,
      });
      return;
    }
    items.push({
      questionMessage,
      answer: item.answer,
    });
  }

  const result = answerFollowupQuestionsBatch({
    session,
    items,
    scenario,
  });
  res.json(result);
});

app.post("/api/intake", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const followupSessionId = asString(req.body?.followupSessionId);
  const submitScenario = parseScenarioPayload(req.body?.submitScenario);
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

  let followupSession = null;
  if (followupSessionId) {
    followupSession = getFollowupSessionById(followupSessionId);
    if (!followupSession) {
      res.status(404).json({ error: "Follow-up session not found." });
      return;
    }
    if (followupSession.projectId !== projectId) {
      res.status(400).json({ error: "Follow-up session does not belong to the project." });
      return;
    }
    if (followupSession.closedAt) {
      res.status(400).json({ error: "Follow-up session has been closed." });
      return;
    }
  }

  try {
    const result = await processIntake({ project, note, visitDate, followupSession, submitScenario });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process intake.",
    });
  }
});

app.post("/api/intake/preview", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const followupSessionId = asString(req.body?.followupSessionId);
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

  let followupSession = null;
  if (followupSessionId) {
    followupSession = getFollowupSessionById(followupSessionId);
    if (!followupSession) {
      res.status(404).json({ error: "Follow-up session not found." });
      return;
    }
    if (followupSession.projectId !== projectId) {
      res.status(400).json({ error: "Follow-up session does not belong to the project." });
      return;
    }
    if (followupSession.closedAt) {
      res.status(400).json({ error: "Follow-up session has been closed." });
      return;
    }
  }

  try {
    const extracted = await extractStructuredUpdate({ project, note, visitDate, followupSession });
    res.json({
      ok: true,
      generatedAt: nowIso(),
      extractionSource: extracted.source,
      extractionWarnings: extracted.warnings,
      extraction: extracted.extraction,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate intake preview.",
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
  const remarks = store.remarks
    .filter((remark) => remark.projectId === project.id)
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt))
    .map((remark) => buildProjectRemarkView(remark));
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
    remarks,
    tasks,
    updates,
    metrics: {
      openTaskCount: tasks.filter((task) => task.status !== "completed").length,
      overdueTaskCount: tasks.filter((task) => task.overdue).length,
      updateCount: updates.length,
      remarkCount: remarks.length,
      remarkRepliedCount: remarks.filter((item) => item.replyContent).length,
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

function buildProjectRemarkView(remark) {
  const fromUser = getUserById(remark.fromUserId);
  const toUser = getUserById(remark.toUserId);
  const replyByUser = getUserById(remark.replyByUserId);
  const readByUser = getUserById(remark.readByUserId);

  return {
    id: remark.id,
    projectId: remark.projectId,
    updateId: remark.updateId || null,
    fromUserId: remark.fromUserId,
    fromUserName: fromUser?.name || "未知上级",
    toUserId: remark.toUserId,
    toUserName: toUser?.name || "未知成员",
    content: remark.content,
    createdAt: remark.createdAt,
    replyContent: remark.replyContent || "",
    replyByUserId: remark.replyByUserId || "",
    replyByUserName: replyByUser?.name || "",
    repliedAt: remark.repliedAt || null,
    readByUserId: remark.readByUserId || "",
    readByUserName: readByUser?.name || "",
    readAt: remark.readAt || null,
    isRead: Boolean(remark.readAt),
    status: remark.replyContent ? "replied" : "pending",
  };
}

function createFollowupSession({ project, note, visitDate, scenario, source }) {
  const currentUser = getCurrentUser();
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "generate",
    project,
  });

  const session = {
    id: createId("session"),
    projectId: project.id,
    userId: currentUser?.id || "",
    source: source || "web-followup",
    sessionType: "followup",
    scenario: normalizedScenario,
    visitDate,
    closedAt: null,
    closedReason: "",
    linkedIntakeSessionId: null,
    createdAt: nowIso(),
  };
  store.sessions.push(session);

  store.messages.push({
    id: createId("message"),
    sessionId: session.id,
    senderType: "user",
    kind: "followup_seed",
    round: 0,
    questionStatus: null,
    relatedMessageId: null,
    scenarioSnapshot: normalizedScenario,
    content: note,
    createdAt: nowIso(),
  });

  return session;
}

async function createFollowupQuestions({
  session,
  project,
  note,
  visitDate,
  scenario,
  source,
  minQuestions = 1,
  maxQuestions = 3,
}) {
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "generate",
    project,
  });
  const history = session ? buildFollowupHistory(session.id) : [];
  const pendingQuestions = session ? findPendingFollowupQuestions(session.id) : [];
  const extracted = await extractFollowupQuestions({
    project,
    note,
    visitDate,
    history,
    minQuestions,
    maxQuestions,
  });

  const activeSession =
    session ||
    createFollowupSession({
      project,
      note,
      visitDate,
      scenario,
      source,
    });

  for (const pendingQuestion of pendingQuestions) {
    pendingQuestion.questionStatus = "unsatisfied";
  }

  let round =
    store.messages
      .filter((item) => item.sessionId === activeSession.id && item.kind === "followup_question")
      .reduce((max, item) => Math.max(max, Number(item.round) || 0), 0);
  const questionMessages = extracted.questions.map((item) => {
    round += 1;
    return {
      id: createId("message"),
      sessionId: activeSession.id,
      senderType: "assistant",
      kind: "followup_question",
      round,
      questionStatus: "pending_answer",
      relatedMessageId: null,
      scenarioSnapshot: normalizedScenario,
      content: item.question,
      intent: item.intent,
      createdAt: nowIso(),
    };
  });
  store.messages.push(...questionMessages);

  touchStore();
  persistStore();

  return {
    ok: true,
    sessionId: activeSession.id,
    questions: questionMessages.map((message) => buildFollowupQuestionView(message)),
    history: buildFollowupHistory(activeSession.id),
  };
}

function answerFollowupQuestion({ session, questionMessage, answer, scenario }) {
  const result = answerFollowupQuestionsBatch({
    session,
    items: [{ questionMessage, answer }],
    scenario,
  });
  return {
    ok: true,
    sessionId: session.id,
    question: buildFollowupQuestionView(questionMessage),
    answer: result.answers[0] || null,
    history: result.history,
  };
}

function answerFollowupQuestionsBatch({ session, items, scenario }) {
  const project = getProjectById(session.projectId);
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "answer",
    project,
  });
  const answerMessages = items.map((item) => ({
    id: createId("message"),
    sessionId: session.id,
    senderType: "user",
    kind: "followup_answer",
    round: item.questionMessage.round || 0,
    questionStatus: null,
    relatedMessageId: item.questionMessage.id,
    scenarioSnapshot: normalizedScenario,
    content: item.answer,
    createdAt: nowIso(),
  }));
  store.messages.push(...answerMessages);
  for (const item of items) {
    item.questionMessage.questionStatus = "answered";
  }

  touchStore();
  persistStore();

  return {
    ok: true,
    sessionId: session.id,
    answers: answerMessages.map((item) => ({
      id: item.id,
      content: item.content,
      round: item.round || 0,
      relatedMessageId: item.relatedMessageId,
      createdAt: item.createdAt,
      scenarioSnapshot: item.scenarioSnapshot || null,
    })),
    history: buildFollowupHistory(session.id),
  };
}

function closeFollowupSessionOnSubmit({ followupSession, intakeSessionId, scenario, project }) {
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "submit",
    project,
  });
  for (const message of store.messages) {
    if (
      message.sessionId === followupSession.id &&
      message.kind === "followup_question" &&
      message.questionStatus === "pending_answer"
    ) {
      message.questionStatus = "unanswered_on_submit";
      if (!message.scenarioSnapshot) {
        message.scenarioSnapshot = normalizedScenario;
      }
    }
  }
  followupSession.closedAt = nowIso();
  followupSession.closedReason = "intake_submitted";
  followupSession.linkedIntakeSessionId = intakeSessionId;
}

async function extractFollowupQuestions({
  project,
  note,
  visitDate,
  history,
  minQuestions = 1,
  maxQuestions = 3,
}) {
  const health = getResponsesApiHealth();
  if (!health.configured) {
    throw new Error(health.message);
  }

  const prompt = buildFollowupPrompt({ project, note, visitDate, history, minQuestions, maxQuestions });
  const parsed = await runResponsesSchemaExtraction({
    prompt,
    schema: FOLLOWUP_QUESTIONS_RESPONSE_SCHEMA,
    schemaName: "followup_questions",
    instructions:
      "Return only JSON. Produce 1 to 3 concise and answerable follow-up questions in the questions array.",
  });
  return normalizeFollowupQuestionsPayload(parsed, { minQuestions, maxQuestions });
}

function buildFollowupPrompt({ project, note, visitDate, history, minQuestions = 1, maxQuestions = 3 }) {
  const hospital = getHospitalById(project.hospitalId);
  const stage = getStageById(project.currentStageId);
  const historyText = history.length
    ? history
        .map((item, index) => {
          const answerText = item.answer?.content || "(未回答)";
          return `${index + 1}. 问题：${item.question}\n   状态：${item.status}\n   回答：${answerText}`;
        })
        .join("\n")
    : "暂无历史追问。";

  return [
    "你是医疗器械导入项目的追问助手。",
    `请根据原始纪要和历史问答，输出 ${minQuestions}-${maxQuestions} 个最有价值的追问问题，帮助完善结构化抽取信息。`,
    "每个问题都必须具体、可回答、与推进动作相关，不要泛泛而谈。",
    `医院：${hospital.name}`,
    `当前阶段：${stage.name}`,
    `拜访日期：${visitDate}`,
    "原始纪要：",
    note,
    "历史追问与回答：",
    historyText,
  ].join("\n");
}

function normalizeFollowupQuestionsPayload(raw, { minQuestions = 1, maxQuestions = 3 } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Responses API returned an invalid follow-up questions payload.");
  }

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : null;
  if (!rawQuestions) {
    throw new Error("Responses API returned follow-up questions without questions array.");
  }
  if (rawQuestions.length < minQuestions || rawQuestions.length > maxQuestions) {
    throw new Error(
      `Responses API returned ${rawQuestions.length} follow-up questions; expected ${minQuestions}-${maxQuestions}.`,
    );
  }

  const questions = rawQuestions.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Responses API returned invalid follow-up question item at index ${index}.`);
    }
    const question = clipText(asString(item.question), 180);
    if (!question) {
      throw new Error(`Responses API returned an empty follow-up question at index ${index}.`);
    }
    return {
      question,
      intent: clipText(asString(item.intent), 120),
    };
  });

  return { questions };
}

function buildFollowupHistory(sessionId) {
  const messages = store.messages
    .filter((item) => item.sessionId === sessionId)
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt));
  const answerByQuestionId = new Map(
    messages
      .filter((item) => item.kind === "followup_answer" && item.relatedMessageId)
      .map((item) => [item.relatedMessageId, item]),
  );

  return messages
    .filter((item) => item.kind === "followup_question")
    .map((item) => ({
      id: item.id,
      round: Number(item.round) || 0,
      question: item.content,
      status: item.questionStatus || "pending_answer",
      createdAt: item.createdAt,
      scenarioSnapshot: item.scenarioSnapshot || null,
      answer: answerByQuestionId.get(item.id)
        ? {
            id: answerByQuestionId.get(item.id).id,
            content: answerByQuestionId.get(item.id).content,
            createdAt: answerByQuestionId.get(item.id).createdAt,
            scenarioSnapshot: answerByQuestionId.get(item.id).scenarioSnapshot || null,
          }
        : null,
    }));
}

function buildFollowupQuestionView(message) {
  return {
    id: message.id,
    round: Number(message.round) || 0,
    question: message.content,
    status: message.questionStatus || "pending_answer",
    createdAt: message.createdAt,
    scenarioSnapshot: message.scenarioSnapshot || null,
  };
}

function findPendingFollowupQuestions(sessionId) {
  return store.messages
    .filter(
      (item) =>
        item.sessionId === sessionId &&
        item.kind === "followup_question" &&
        item.questionStatus === "pending_answer",
    )
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
}

function getFollowupSessionById(sessionId) {
  const session = store.sessions.find((item) => item.id === sessionId);
  return session && session.sessionType === "followup" ? session : null;
}

function parseScenarioPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input;
}

function normalizeScenarioForStorage({ scenario, operation, project }) {
  const stage = project ? getStageById(project.currentStageId) : null;
  return {
    operation: asString(operation),
    projectId: asString(scenario?.projectId) || project?.id || "",
    currentStageId: asString(scenario?.currentStageId) || project?.currentStageId || "",
    currentStageName: asString(scenario?.currentStageName) || stage?.name || "",
    activeTab: asString(scenario?.activeTab) || "entry",
    templateId: asString(scenario?.templateId),
    recordedAt: asString(scenario?.recordedAt) || nowIso(),
  };
}

async function processIntake({ project, note, visitDate, followupSession, submitScenario }) {
  const extracted = await extractStructuredUpdate({ project, note, visitDate, followupSession });
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
    sessionType: "intake",
    scenario: normalizeScenarioForStorage({
      scenario: submitScenario,
      operation: "submit",
      project,
    }),
    closedAt: null,
    closedReason: "",
    linkedIntakeSessionId: null,
    extractionSource: extracted.source,
    createdAt: nowIso(),
  };
  store.sessions.push(session);

  store.messages.push(
    {
      id: createId("message"),
      sessionId: session.id,
      senderType: "user",
      kind: "intake_note",
      round: 0,
      questionStatus: null,
      relatedMessageId: null,
      scenarioSnapshot: normalizeScenarioForStorage({
        scenario: submitScenario,
        operation: "submit",
        project,
      }),
      content: note,
      createdAt: nowIso(),
    },
    {
      id: createId("message"),
      sessionId: session.id,
      senderType: "assistant",
      kind: "intake_extraction",
      round: 0,
      questionStatus: null,
      relatedMessageId: null,
      scenarioSnapshot: normalizeScenarioForStorage({
        scenario: submitScenario,
        operation: "submit",
        project,
      }),
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

  if (followupSession) {
    closeFollowupSessionOnSubmit({
      followupSession,
      intakeSessionId: session.id,
      scenario: submitScenario,
      project,
    });
  }

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

async function extractStructuredUpdate({ project, note, visitDate, followupSession = null }) {
  const health = getResponsesApiHealth();
  if (!health.configured) {
    throw new Error(health.message);
  }

  const followupContext = followupSession ? buildFollowupContextForExtraction(followupSession.id) : [];
  const prompt = buildExtractionPrompt({ project, note, visitDate, followupContext });
  const parsed = await runResponsesStructuredExtraction(prompt);
  return {
    source: "responses-api",
    warnings: [],
    extraction: normalizeExtraction(parsed),
  };
}

function buildExtractionPrompt({ project, note, visitDate, followupContext = [] }) {
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
    "追问补充信息：",
    followupContext.length
      ? followupContext
          .map(
            (item, index) =>
              `${index + 1}. 问题：${item.question}\n   回答：${item.answer}\n   状态：${item.status}`,
          )
          .join("\n")
      : "无",
  ].join("\n");
}

function buildFollowupContextForExtraction(sessionId) {
  if (!sessionId) {
    return [];
  }
  return buildFollowupHistory(sessionId)
    .filter((item) => item.answer?.content)
    .map((item) => ({
      question: item.question,
      answer: item.answer?.content || "",
      status: item.status || "answered",
    }));
}

async function runResponsesStructuredExtraction(prompt) {
  return runResponsesSchemaExtraction({
    prompt,
    schema: INTAKE_RESPONSE_SCHEMA,
    schemaName: "intake_extraction",
    instructions: "Return only JSON that matches the provided schema.",
  });
}

async function runResponsesSchemaExtraction({ prompt, schema, schemaName, instructions }) {
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
        instructions: asString(instructions) || "Return only JSON that matches the provided schema.",
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: asString(schemaName) || "structured_response",
            strict: true,
            schema,
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
    remarks: Array.isArray(input.remarks) ? input.remarks : [],
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

function getRemarkById(id) {
  return store.remarks.find((item) => item.id === id);
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
