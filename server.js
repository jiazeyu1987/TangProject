import crypto from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
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
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const INTAKE_SCHEMA_PATH = path.join(DATA_DIR, "intake-schema.json");
const FOLLOWUP_QUESTIONS_SCHEMA_PATH = path.join(DATA_DIR, "followup-questions-schema.json");
const INTAKE_RESPONSE_SCHEMA = readJsonFile(INTAKE_SCHEMA_PATH);
const FOLLOWUP_QUESTIONS_RESPONSE_SCHEMA = readJsonFile(FOLLOWUP_QUESTIONS_SCHEMA_PATH);
const MAX_BACKUP_COUNT = 30;
const DAILY_BACKUP_HOUR = 2;
const DAILY_BACKUP_MINUTE = 0;
const DEFAULT_BACKUP_WEEKDAY = 1;
const BACKUP_FILE_PREFIX = "store-backup-";
const BACKUP_FILE_SUFFIX = ".json";

const port = Number(process.env.PORT || 3000);
const responsesBaseUrl = normalizeResponsesBaseUrl(
  process.env.RESPONSES_BASE_URL?.trim() || "https://api.asxs.top/v1",
);
const responsesModel = process.env.RESPONSES_MODEL?.trim() || "gpt-5.4";
const responsesApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const responsesTimeoutMs = toPositiveInteger(process.env.RESPONSES_TIMEOUT_MS, 120000);
const responsesMaxConcurrentRequests = toPositiveInteger(
  process.env.RESPONSES_MAX_CONCURRENT_REQUESTS,
  2,
);
const ROLE_DEFINITIONS = {
  manager: { code: "manager", name: "经理", rank: 3 },
  supervisor: { code: "supervisor", name: "主管", rank: 2 },
  specialist: { code: "specialist", name: "专员", rank: 1 },
};
const SUPERVISOR_ROLES = new Set(["manager", "supervisor"]);
const DEFAULT_INITIAL_PASSWORD = process.env.DEFAULT_INITIAL_PASSWORD?.trim() || "123456";
const BACKUP_ADMIN_ACCOUNT = normalizeAccount(process.env.BACKUP_ADMIN_ACCOUNT) || "backup-admin";
const BACKUP_ADMIN_NAME = clipText(process.env.BACKUP_ADMIN_NAME?.trim() || "数据备份管理员", 40);
const PASSWORD_PBKDF2_ITERATIONS = toPositiveInteger(process.env.PASSWORD_PBKDF2_ITERATIONS, 120000);
const PASSWORD_PBKDF2_KEY_LENGTH = 64;
const PASSWORD_PBKDF2_DIGEST = "sha512";
const responsesRequestQueue = [];
const responsesLimiterState = {
  activeCount: 0,
};

let store = loadOrCreateStore();
const backupSchedulerState = {
  lastRunAt: "",
  nextRunAt: "",
  timer: null,
  running: false,
};
initializeBackupSystem();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json(buildHealthPayload());
});

app.get("/api/auth/options", (_req, res) => {
  res.json({
    ok: true,
    roles: Object.values(ROLE_DEFINITIONS).map((item) => ({
      code: item.code,
      name: item.name,
      rank: item.rank,
    })),
    regions: [...store.regions],
  });
});

app.post("/api/auth/register", (req, res) => {
  const name = clipText(asString(req.body?.name), 40);
  const account = normalizeAccount(req.body?.account);
  const password = asString(req.body?.password);
  const role = normalizeUserRole(asString(req.body?.role) || "specialist");
  const regionId = asString(req.body?.regionId) || store.regions[0]?.id || "";

  if (!name) {
    res.status(400).json({ error: "name is required." });
    return;
  }
  if (!account) {
    res.status(400).json({ error: "account is required." });
    return;
  }
  if (!isValidAccount(account)) {
    res.status(400).json({ error: "account format is invalid." });
    return;
  }
  if (account === BACKUP_ADMIN_ACCOUNT) {
    res.status(400).json({ error: "account is reserved." });
    return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: "password must be at least 6 characters." });
    return;
  }
  if (!role) {
    res.status(400).json({ error: "role is invalid." });
    return;
  }
  if (!regionId || !getRegionById(regionId)) {
    res.status(400).json({ error: "regionId is invalid." });
    return;
  }
  if (store.users.some((item) => normalizeAccount(item.account) === account)) {
    res.status(409).json({ error: "account already exists." });
    return;
  }

  const passwordSalt = createPasswordSalt();
  const user = {
    id: createId("user"),
    name,
    account,
    role,
    regionId,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    createdAt: nowIso(),
  };
  store.users.push(user);

  const session = createAuthSession(user.id);
  store.currentUserId = user.id;
  touchStore();
  persistStore();

  res.json({
    ok: true,
    token: session.token,
    user: buildUserView(user),
    bootstrap: buildBootstrapPayload(user),
  });
});

app.post("/api/auth/login", (req, res) => {
  const account = normalizeAccount(req.body?.account);
  const password = asString(req.body?.password);
  if (!account) {
    res.status(400).json({ error: "account is required." });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "password is required." });
    return;
  }

  const user = store.users.find((item) => normalizeAccount(item.account) === account);
  if (!user) {
    res.status(401).json({ error: "account or password is incorrect." });
    return;
  }
  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    res.status(401).json({ error: "account or password is incorrect." });
    return;
  }

  const session = createAuthSession(user.id);
  store.currentUserId = user.id;
  touchStore();
  persistStore();

  res.json({
    ok: true,
    token: session.token,
    user: buildUserView(user),
    bootstrap: buildBootstrapPayload(user),
  });
});

app.use("/api", (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const session = store.authSessions.find((item) => item.token === token);
  if (!session) {
    res.status(401).json({ error: "Authentication token is invalid." });
    return;
  }
  const user = getUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: "Authenticated user no longer exists." });
    return;
  }

  req.authToken = token;
  req.authSession = session;
  req.currentUser = user;
  session.lastUsedAt = nowIso();
  next();
});

app.post("/api/auth/logout", (req, res) => {
  const token = asString(req.authToken);
  const before = store.authSessions.length;
  store.authSessions = store.authSessions.filter((item) => item.token !== token);
  if (store.currentUserId === req.currentUser?.id) {
    store.currentUserId = "";
  }
  if (store.authSessions.length !== before) {
    touchStore();
    persistStore();
  }
  res.json({ ok: true });
});

app.get("/api/bootstrap", (req, res) => {
  res.json(buildBootstrapPayload(req.currentUser));
});

app.get("/api/backups", (req, res) => {
  if (!isBackupAdminUser(req.currentUser)) {
    res.status(403).json({ error: "Only the backup admin can view backups." });
    return;
  }
  try {
    res.json(buildBackupPayload());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list backups." });
  }
});

app.post("/api/backups/create", (req, res) => {
  if (!isBackupAdminUser(req.currentUser)) {
    res.status(403).json({ error: "Only the backup admin can create backups." });
    return;
  }
  try {
    createStoreBackup("manual");
    pruneBackups(getBackupMaxCount());
    res.json(buildBackupPayload());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create backup." });
  }
});

app.post("/api/backups/restore", (req, res) => {
  if (!isBackupAdminUser(req.currentUser)) {
    res.status(403).json({ error: "Only the backup admin can restore backups." });
    return;
  }
  const backupDate = asString(req.body?.backupDate);
  if (!backupDate) {
    res.status(400).json({ error: "backupDate is required." });
    return;
  }
  try {
    const restored = restoreStoreBackupByDate(backupDate);
    res.json({
      ok: true,
      restored,
      forcedLogout: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore backup.";
    if (message === "Backup date not found.") {
      res.status(404).json({ error: message });
      return;
    }
    if (
      message === "backupDate is invalid." ||
      message === "Backup JSON is invalid." ||
      message === "Backup store has no users."
    ) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

app.patch("/api/backups/schedule", (req, res) => {
  if (!isBackupAdminUser(req.currentUser)) {
    res.status(403).json({ error: "Only the backup admin can update backup schedule." });
    return;
  }
  try {
    const schedule = normalizeBackupScheduleInput(req.body);
    store.backupPolicy = {
      ...store.backupPolicy,
      maxBackups: getBackupMaxCount(),
      schedule,
    };
    touchStore();
    persistStore();
    scheduleNextBackupRun(new Date());
    res.json(buildBackupPayload());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update backup schedule.";
    if (
      message === "backup frequency is invalid." ||
      message === "backup hour is invalid." ||
      message === "backup minute is invalid." ||
      message === "backup weekday is invalid."
    ) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

app.patch("/api/users/:userId", (req, res) => {
  if (!isManagerUser(req.currentUser)) {
    res.status(403).json({ error: "Only managers can update users." });
    return;
  }
  const userId = asString(req.params?.userId);
  const regionId = asString(req.body?.regionId);
  if (!userId) {
    res.status(400).json({ error: "userId is required." });
    return;
  }
  if (!regionId) {
    res.status(400).json({ error: "regionId is required." });
    return;
  }
  const region = getRegionById(regionId);
  if (!region) {
    res.status(400).json({ error: "regionId is invalid." });
    return;
  }
  const user = getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  user.regionId = region.id;
  touchStore();
  persistStore();

  res.json({
    ok: true,
    user: buildUserView(user),
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
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
  const project = getProjectById(task.projectId);
  if (!project) {
    res.status(404).json({ error: "Project for task not found." });
    return;
  }
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to update this task." });
    return;
  }

  task.status = taskStatus;
  task.completedAt = taskStatus === "completed" ? nowIso() : null;
  touchStore();
  persistStore();

  res.json({
    ok: true,
    task: buildTaskView(task),
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/projects", (req, res) => {
  const hospitalName = clipText(asString(req.body?.hospitalName), 120);
  const city = clipText(asString(req.body?.city), 40);
  const hospitalLevel = clipText(asString(req.body?.hospitalLevel), 20) || "未知";
  const currentUser = req.currentUser;
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
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/projects/:projectId/remarks", (req, res) => {
  const projectId = asString(req.params?.projectId);
  const content = clipText(asString(req.body?.content), 300);
  const toUserId = asString(req.body?.toUserId);
  const updateId = asString(req.body?.updateId);
  const currentUser = req.currentUser;
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
  if (!canUserAccessProject(currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to leave remarks on this project." });
    return;
  }
  if (!SUPERVISOR_ROLES.has(asString(currentUser.role))) {
    res.status(403).json({ error: "Only managers or supervisors can leave project remarks." });
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
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/project-remarks/:remarkId/reply", (req, res) => {
  const remarkId = asString(req.params?.remarkId);
  const reply = clipText(asString(req.body?.reply), 300);
  const currentUser = req.currentUser;
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
  if (!canUserAccessProject(currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to reply this remark." });
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
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/project-remarks/:remarkId/read", (req, res) => {
  const remarkId = asString(req.params?.remarkId);
  const currentUser = req.currentUser;
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
  if (!canUserAccessProject(currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to read this remark." });
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
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/followups/question", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const sessionId = asString(req.body?.sessionId);
  const historySessionId = asString(req.body?.historySessionId);
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
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to access this project." });
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
    if (followupSession.userId && followupSession.userId !== req.currentUser.id) {
      res.status(403).json({ error: "Current user is not allowed to access this follow-up session." });
      return;
    }
  } else {
    followupSession = null;
  }

  if (historySessionId) {
    const historySourceSession = getFollowupSessionById(historySessionId);
    if (!historySourceSession) {
      res.status(404).json({ error: "History follow-up session not found." });
      return;
    }
    if (historySourceSession.projectId !== projectId) {
      res.status(400).json({ error: "History follow-up session does not belong to the project." });
      return;
    }
  }

  try {
    const result = await createFollowupQuestions({
      session: followupSession,
      project,
      note,
      visitDate,
      historySessionId: followupSession ? "" : historySessionId,
      scenario,
      source: "web-followup",
      currentUser: req.currentUser,
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
  const historySessionId = asString(req.body?.historySessionId);
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
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to access this project." });
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
    if (followupSession.userId && followupSession.userId !== req.currentUser.id) {
      res.status(403).json({ error: "Current user is not allowed to access this follow-up session." });
      return;
    }
  } else {
    followupSession = null;
  }

  if (historySessionId) {
    const historySourceSession = getFollowupSessionById(historySessionId);
    if (!historySourceSession) {
      res.status(404).json({ error: "History follow-up session not found." });
      return;
    }
    if (historySourceSession.projectId !== projectId) {
      res.status(400).json({ error: "History follow-up session does not belong to the project." });
      return;
    }
  }

  try {
    const result = await createFollowupQuestions({
      session: followupSession,
      project,
      note,
      visitDate,
      historySessionId: followupSession ? "" : historySessionId,
      scenario,
      source: "web-followup",
      currentUser: req.currentUser,
      minQuestions: 1,
      maxQuestions: 1,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate follow-up question.",
    });
  }
});

app.get("/api/followups/history", (req, res) => {
  const projectId = asString(req.query?.projectId);
  const limitRaw = Number.parseInt(asString(req.query?.limit), 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  if (!projectId) {
    res.status(400).json({ error: "projectId is required." });
    return;
  }
  const project = getProjectById(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to access this project." });
    return;
  }

  const sessions = store.sessions
    .filter((item) => item.sessionType === "followup" && item.projectId === projectId)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
    .slice(0, limit)
    .map((item) => buildFollowupHistorySessionView(item));

  res.json({
    ok: true,
    projectId,
    generatedAt: nowIso(),
    sessions,
  });
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
  if (session.userId && session.userId !== req.currentUser.id) {
    res.status(403).json({ error: "Current user is not allowed to answer this follow-up session." });
    return;
  }
  const followupProject = getProjectById(session.projectId);
  if (!followupProject || !canUserAccessProject(req.currentUser, followupProject)) {
    res.status(403).json({ error: "Current user is not allowed to access this follow-up project." });
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
    actorUser: req.currentUser,
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
  if (session.userId && session.userId !== req.currentUser.id) {
    res.status(403).json({ error: "Current user is not allowed to answer this follow-up session." });
    return;
  }
  const followupProject = getProjectById(session.projectId);
  if (!followupProject || !canUserAccessProject(req.currentUser, followupProject)) {
    res.status(403).json({ error: "Current user is not allowed to access this follow-up project." });
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
    actorUser: req.currentUser,
  });
  res.json(result);
});

app.post("/api/intake", async (req, res) => {
  const projectId = asString(req.body?.projectId);
  const note = asString(req.body?.note);
  const visitDate = normalizeDateOnly(req.body?.visitDate) || todayDateOnly();
  const followupSessionId = asString(req.body?.followupSessionId);
  const reviewedSnapshotBody = req.body?.reviewedSnapshot;
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
  if (!reviewedSnapshotBody) {
    res.status(400).json({ error: "reviewedSnapshot is required." });
    return;
  }

  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to submit intake for this project." });
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
    if (followupSession.userId && followupSession.userId !== req.currentUser.id) {
      res.status(403).json({ error: "Current user is not allowed to submit this follow-up session." });
      return;
    }
  }

  let reviewedSnapshot;
  try {
    reviewedSnapshot = normalizeReviewedIntakeSnapshot(reviewedSnapshotBody);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "reviewedSnapshot is invalid.",
    });
    return;
  }

  try {
    const result = await processIntake({
      project,
      note,
      visitDate,
      followupSession,
      submitScenario,
      currentUser: req.currentUser,
      reviewedSnapshot,
    });
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
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to preview intake for this project." });
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
    if (followupSession.userId && followupSession.userId !== req.currentUser.id) {
      res.status(403).json({ error: "Current user is not allowed to preview with this follow-up session." });
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

app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  }),
);

app.listen(port, () => {
  console.log(`AI clinical rollout MVP running at http://localhost:${port}`);
});

function buildBootstrapPayload(currentUser = null) {
  const resolvedCurrentUser = currentUser || getCurrentUser();
  const visibleProjectIds = collectVisibleProjectIds(resolvedCurrentUser);
  const projects = buildProjectViews(resolvedCurrentUser, visibleProjectIds);
  const tasks = buildTaskViews(resolvedCurrentUser, visibleProjectIds);

  return {
    ok: true,
    generatedAt: nowIso(),
    health: buildHealthPayload(),
    currentUser: buildUserView(resolvedCurrentUser),
    lookups: {
      stages: [...store.stages].sort((left, right) => left.sortOrder - right.sortOrder),
      issueTags: store.issueTags,
      users: store.users.map((user) => buildUserView(user)),
      regions: store.regions,
    },
    dashboard: buildDashboard(projects, tasks),
    signals: buildSignals(projects, tasks, visibleProjectIds),
    management: buildManagementPayload(resolvedCurrentUser),
    capabilities: {
      canManageBackups: isBackupAdminUser(resolvedCurrentUser),
    },
    projects,
    tasks,
  };
}

function buildHealthPayload() {
  const health = getResponsesApiHealth();
  const backupSchedule = getBackupSchedule();
  return {
    ok: health.configured,
    configured: health.configured,
    authStatus: health.message,
    extractionMode: health.configured ? "responses-api" : "unconfigured",
    model: responsesModel,
    baseUrl: responsesBaseUrl,
    responsesConcurrency: {
      maxConcurrentRequests: responsesMaxConcurrentRequests,
      activeRequests: responsesLimiterState.activeCount,
      queuedRequests: responsesRequestQueue.length,
    },
    dataStore: {
      path: STORE_PATH,
      projectCount: store.projects.length,
      taskCount: store.tasks.length,
    },
    backup: {
      path: BACKUP_DIR,
      maxCount: getBackupMaxCount(),
      frequency: backupSchedule.frequency,
      weekday: backupSchedule.frequency === "weekly" ? backupSchedule.weekday : null,
      scheduledAt: `${String(backupSchedule.hour).padStart(2, "0")}:${String(backupSchedule.minute).padStart(2, "0")}`,
      lastRunAt: backupSchedulerState.lastRunAt || null,
      nextRunAt: backupSchedulerState.nextRunAt || null,
    },
  };
}

function buildBackupPayload() {
  const backups = listStoreBackups();
  return {
    ok: true,
    generatedAt: nowIso(),
    policy: store.backupPolicy,
    scheduler: {
      running: backupSchedulerState.running,
      lastRunAt: backupSchedulerState.lastRunAt || null,
      nextRunAt: backupSchedulerState.nextRunAt || null,
    },
    availableDates: uniqueStrings(backups.map((item) => item.date)),
    backups,
  };
}

function initializeBackupSystem() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  pruneBackups(getBackupMaxCount());
  scheduleNextBackupRun(new Date());
}

function scheduleNextBackupRun(referenceDate) {
  const nextRunAt = resolveNextBackupRunAt(referenceDate, getBackupSchedule());
  backupSchedulerState.nextRunAt = nextRunAt.toISOString();
  if (backupSchedulerState.timer) {
    clearTimeout(backupSchedulerState.timer);
  }
  const delayMs = Math.max(1000, nextRunAt.getTime() - Date.now());
  backupSchedulerState.timer = setTimeout(() => {
    runScheduledBackup();
  }, delayMs);
}

function runScheduledBackup() {
  backupSchedulerState.running = true;
  try {
    createStoreBackup("auto");
    pruneBackups(getBackupMaxCount());
    backupSchedulerState.lastRunAt = nowIso();
  } catch (error) {
    console.error("[backup] scheduled backup failed:", error instanceof Error ? error.message : error);
  } finally {
    backupSchedulerState.running = false;
    scheduleNextBackupRun(new Date(Date.now() + 1000));
  }
}

function resolveNextDailyRunAt(referenceDate, hour, minute) {
  const reference = referenceDate instanceof Date ? referenceDate : new Date();
  const next = new Date(reference.getTime());
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= reference.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function resolveNextWeeklyRunAt(referenceDate, hour, minute, weekday) {
  const reference = referenceDate instanceof Date ? referenceDate : new Date();
  const next = new Date(reference.getTime());
  next.setHours(hour, minute, 0, 0);
  const currentWeekday = next.getDay();
  let dayDelta = weekday - currentWeekday;
  if (dayDelta < 0) {
    dayDelta += 7;
  }
  next.setDate(next.getDate() + dayDelta);
  if (next.getTime() <= reference.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

function resolveNextBackupRunAt(referenceDate, schedule) {
  if (schedule.frequency === "weekly") {
    return resolveNextWeeklyRunAt(referenceDate, schedule.hour, schedule.minute, schedule.weekday);
  }
  return resolveNextDailyRunAt(referenceDate, schedule.hour, schedule.minute);
}

function createStoreBackup(trigger) {
  const normalizedTrigger = asString(trigger).toLowerCase();
  if (!normalizedTrigger || (normalizedTrigger !== "auto" && normalizedTrigger !== "manual")) {
    throw new Error("backup trigger is invalid.");
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = nowIso().replace(/[-:.]/g, "");
  const backupId = `${BACKUP_FILE_PREFIX}${timestamp}-${createId("backup")}-${normalizedTrigger}${BACKUP_FILE_SUFFIX}`;
  const backupPath = path.join(BACKUP_DIR, backupId);
  writeFileSync(backupPath, JSON.stringify(store, null, 2), "utf8");
  const stat = statSync(backupPath);
  return buildBackupItem(backupId, stat);
}

function listStoreBackups() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  return listBackupFileNames()
    .map((fileName) => {
      const fullPath = path.join(BACKUP_DIR, fileName);
      try {
        const stat = statSync(fullPath);
        return buildBackupItem(fileName, stat);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
}

function pruneBackups(maxCount) {
  const limit = Number(maxCount) > 0 ? Number(maxCount) : getBackupMaxCount();
  const backups = listStoreBackups();
  if (backups.length <= limit) {
    return backups;
  }
  const overflowItems = backups.slice(limit);
  for (const item of overflowItems) {
    unlinkSync(path.join(BACKUP_DIR, item.fileName));
  }
  return listStoreBackups();
}

function restoreStoreBackup(backupId) {
  const backupPath = resolveBackupFilePath(backupId);
  if (!backupPath) {
    throw new Error("backupId is invalid.");
  }
  if (!existsSync(backupPath)) {
    throw new Error("Backup not found.");
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(backupPath, "utf8"));
  } catch {
    throw new Error("Backup JSON is invalid.");
  }

  const normalized = normalizeStoreShape(parsed);
  if (!Array.isArray(normalized.users) || !normalized.users.length) {
    throw new Error("Backup store has no users.");
  }
  const clearedSessionCount = Array.isArray(normalized.authSessions) ? normalized.authSessions.length : 0;
  normalized.authSessions = [];
  store = normalized;
  touchStore();
  persistStore();
  initializeBackupSystem();
  return {
    backupId,
    restoredAt: nowIso(),
    clearedSessionCount,
  };
}

function restoreStoreBackupByDate(backupDate) {
  const normalizedDate = normalizeBackupDateInput(backupDate);
  if (!normalizedDate) {
    throw new Error("backupDate is invalid.");
  }
  const targetBackup = listStoreBackups().find((item) => item.date === normalizedDate);
  if (!targetBackup) {
    throw new Error("Backup date not found.");
  }
  const restored = restoreStoreBackup(targetBackup.id);
  return {
    ...restored,
    backupDate: normalizedDate,
  };
}

function listBackupFileNames() {
  if (!existsSync(BACKUP_DIR)) {
    return [];
  }
  return readdirSync(BACKUP_DIR).filter(
    (fileName) => fileName.startsWith(BACKUP_FILE_PREFIX) && fileName.endsWith(BACKUP_FILE_SUFFIX),
  );
}

function buildBackupItem(fileName, stat) {
  const createdAt = new Date(stat.mtimeMs).toISOString();
  return {
    id: fileName,
    fileName,
    trigger: resolveBackupTrigger(fileName),
    createdAt,
    date: createdAt.slice(0, 10),
    sizeBytes: Number(stat.size) || 0,
  };
}

function resolveBackupTrigger(fileName) {
  const match = String(fileName || "").match(/-(auto|manual)\.json$/);
  return match ? match[1] : "manual";
}

function resolveBackupFilePath(backupId) {
  const normalized = asString(backupId);
  if (!normalized || normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    return "";
  }
  if (!normalized.startsWith(BACKUP_FILE_PREFIX) || !normalized.endsWith(BACKUP_FILE_SUFFIX)) {
    return "";
  }
  return path.join(BACKUP_DIR, normalized);
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

function buildSignals(projects, tasks, visibleProjectIds) {
  return {
    attentionProjects: projects.filter((project) => project.managerAttentionNeeded).slice(0, 4),
    stalledProjects: projects.filter((project) => project.isStalled).slice(0, 4),
    overdueTasks: tasks.filter((task) => task.overdue).slice(0, 4),
    recentUpdates: [...store.updates]
      .filter((update) => visibleProjectIds.has(update.projectId))
      .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
      .slice(0, 5)
      .map((update) => buildUpdateView(update)),
  };
}

function canUserAccessProject(currentUser, project) {
  if (!currentUser || !project) {
    return false;
  }
  const role = normalizeUserRole(currentUser.role);
  if (role === "manager") {
    return true;
  }
  if (role === "supervisor") {
    return project.regionId === currentUser.regionId;
  }
  return project.ownerUserId === currentUser.id;
}

function isManagerUser(user) {
  return normalizeUserRole(asString(user?.role)) === "manager";
}

function isBackupAdminUser(user) {
  return Boolean(user?.isBackupAdmin) || normalizeAccount(user?.account) === BACKUP_ADMIN_ACCOUNT;
}

function buildManagementPayload(currentUser) {
  const roleCounts = Object.keys(ROLE_DEFINITIONS).map((code) => ({
    code,
    name: ROLE_DEFINITIONS[code].name,
    rank: ROLE_DEFINITIONS[code].rank,
    count: store.users.filter((item) => normalizeUserRole(item.role) === code).length,
  }));
  const allUsers = [...store.users]
    .map((item) => buildUserView(item))
    .filter(Boolean)
    .sort((left, right) => {
      const roleRankDelta =
        (ROLE_DEFINITIONS[right.role]?.rank || 0) - (ROLE_DEFINITIONS[left.role]?.rank || 0);
      if (roleRankDelta) {
        return roleRankDelta;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  const role = normalizeUserRole(currentUser?.role);
  let visibleUsers = [];
  if (role === "manager") {
    visibleUsers = allUsers;
  } else if (role === "supervisor") {
    visibleUsers = allUsers.filter(
      (item) => item.role !== "manager" && item.regionId === asString(currentUser?.regionId),
    );
  } else if (currentUser?.id) {
    visibleUsers = allUsers.filter((item) => item.id === currentUser.id);
  }
  return {
    levels: roleCounts,
    visibleUsers,
    canManageUsers: role === "manager",
    canManageBackups: isBackupAdminUser(currentUser),
  };
}

function collectVisibleProjectIds(currentUser) {
  return new Set(
    store.projects
      .filter((project) => canUserAccessProject(currentUser, project))
      .map((project) => project.id),
  );
}

function buildProjectViews(currentUser, visibleProjectIds = collectVisibleProjectIds(currentUser)) {
  return [...store.projects]
    .filter((project) => visibleProjectIds.has(project.id))
    .map((project) => buildProjectView(project))
    .sort(compareProjectViews);
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

function buildTaskViews(currentUser, visibleProjectIds = collectVisibleProjectIds(currentUser)) {
  return [...store.tasks]
    .filter((task) => visibleProjectIds.has(task.projectId))
    .map((task) => buildTaskView(task))
    .sort(compareTaskViews);
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
  const project = getProjectById(update.projectId);
  const hospital = project ? getHospitalById(project.hospitalId) : null;

  return {
    id: update.id,
    projectId: update.projectId,
    hospitalName: hospital?.name || "",
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
  const role = normalizeUserRole(user.role);
  const roleMeta = ROLE_DEFINITIONS[role];

  return {
    id: user.id,
    name: user.name,
    account: user.account || "",
    role,
    roleName: roleMeta?.name || role,
    regionId: user.regionId || "",
    regionName: getRegionById(user.regionId)?.name || "",
    isBackupAdmin: isBackupAdminUser(user),
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

function createFollowupSession({
  project,
  note,
  visitDate,
  scenario,
  source,
  currentUser,
  historySourceSessionId = "",
}) {
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
    historySourceSessionId: asString(historySourceSessionId) || null,
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
  historySessionId = "",
  scenario,
  source,
  currentUser,
  minQuestions = 1,
  maxQuestions = 3,
}) {
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "generate",
    project,
  });
  const historyContextSessionId = session ? session.id : asString(historySessionId);
  const history = historyContextSessionId ? buildFollowupHistory(historyContextSessionId) : [];
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
      currentUser,
      historySourceSessionId: historySessionId,
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

function answerFollowupQuestion({ session, questionMessage, answer, scenario, actorUser = null }) {
  const result = answerFollowupQuestionsBatch({
    session,
    items: [{ questionMessage, answer }],
    scenario,
    actorUser,
  });
  return {
    ok: true,
    sessionId: session.id,
    question: buildFollowupQuestionView(questionMessage),
    answer: result.answers[0] || null,
    history: result.history,
  };
}

function answerFollowupQuestionsBatch({ session, items, scenario, actorUser = null }) {
  const project = getProjectById(session.projectId);
  const submittedByUserId = asString(actorUser?.id) || asString(session.userId);
  const submittedByUser = getUserById(submittedByUserId);
  const submittedByUserName = asString(actorUser?.name) || submittedByUser?.name || "";
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
    userId: submittedByUserId,
    submittedByUserId,
    submittedByUserName,
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
      submittedByUserId: item.submittedByUserId || "",
      submittedByUserName: item.submittedByUserName || "",
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

function buildFollowupHistorySessionView(session) {
  const sessionUser = getUserById(session.userId);
  const seedMessage = store.messages
    .filter((item) => item.sessionId === session.id && item.kind === "followup_seed")
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt))[0];
  return {
    sessionId: session.id,
    projectId: session.projectId,
    source: session.source || "",
    userId: session.userId || "",
    userName: sessionUser?.name || "",
    createdAt: session.createdAt,
    closedAt: session.closedAt || null,
    closedReason: session.closedReason || "",
    linkedIntakeSessionId: session.linkedIntakeSessionId || null,
    historySourceSessionId: session.historySourceSessionId || null,
    scenario: session.scenario || null,
    seedNote: seedMessage?.content || "",
    history: buildFollowupHistoryDetailed(session.id, session),
  };
}

function buildFollowupHistoryDetailed(sessionId, session = null) {
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
    .map((item) => {
      const answerMessage = answerByQuestionId.get(item.id);
      const submittedByUserId =
        asString(answerMessage?.submittedByUserId) ||
        asString(answerMessage?.userId) ||
        asString(session?.userId);
      const submittedByUser = getUserById(submittedByUserId);
      return {
        id: item.id,
        round: Number(item.round) || 0,
        question: item.content,
        status: item.questionStatus || "pending_answer",
        createdAt: item.createdAt,
        scenarioSnapshot: item.scenarioSnapshot || null,
        answer: answerMessage
          ? {
              id: answerMessage.id,
              content: answerMessage.content,
              createdAt: answerMessage.createdAt,
              submittedByUserId,
              submittedByUserName:
                asString(answerMessage.submittedByUserName) || submittedByUser?.name || "",
              submitScenario: answerMessage.scenarioSnapshot || null,
            }
          : null,
      };
    });
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

async function processIntake({ project, note, visitDate, followupSession, submitScenario, currentUser, reviewedSnapshot }) {
  const reviewedExtraction = reviewedSnapshot.extraction;
  const departmentId = ensureDepartment(project.hospitalId, reviewedExtraction.department);
  const stageBeforeId = project.currentStageId;
  const stageAfterId = resolveStageId(reviewedExtraction.stageAfterUpdate);
  if (!stageAfterId) {
    throw new Error(`Unknown stage returned by reviewed intake snapshot: ${reviewedExtraction.stageAfterUpdate}.`);
  }
  const issueTagIds = resolveIssueTagIds(reviewedExtraction.issues);
  const contacts = reviewedExtraction.contacts.map((contact) =>
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
      extractionSource: "reviewed-snapshot",
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
      content: JSON.stringify(reviewedExtraction),
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
    feedbackSummary: reviewedExtraction.feedbackSummary,
    blockers: reviewedExtraction.blockers,
    opportunities: reviewedExtraction.opportunities,
    nextStep: reviewedExtraction.nextStep,
    stageBeforeId,
    stageAfterId,
    managerAttentionNeeded: reviewedExtraction.managerAttentionNeeded,
    issueTagIds,
    sourceNote: note,
    createdAt: nowIso(),
  };
  store.updates.push(update);

  const createdTasks = reviewedExtraction.nextActions.map((action) => {
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
      priority: reviewedExtraction.managerAttentionNeeded ? "high" : "medium",
      completedAt: null,
      createdAt: nowIso(),
    };
    store.tasks.push(task);
    return task;
  });

  project.currentStageId = stageAfterId;
  project.lastFollowUpAt = `${visitDate}T09:00:00.000Z`;
  project.nextAction = reviewedExtraction.nextStep || createdTasks[0]?.title || "";
  project.nextActionDueAt = createdTasks[0]?.dueAt || null;
  project.latestSummary = reviewedExtraction.feedbackSummary;
  project.managerAttentionNeeded = reviewedExtraction.managerAttentionNeeded;
  project.latestUpdateId = update.id;
  project.currentIssueTagIds = issueTagIds;
  project.riskLevel = deriveRiskLevel({
    managerAttentionNeeded: project.managerAttentionNeeded,
    issueCount: project.currentIssueTagIds.length,
    blockers: reviewedExtraction.blockers,
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
    extractionSource: "reviewed-snapshot",
    extractionWarnings: [],
    extraction: reviewedExtraction,
    reviewedSnapshot,
    update: buildUpdateView(update),
    createdTasks: createdTasks.map((task) => buildTaskView(task)),
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(currentUser),
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
  return runWithResponsesConcurrencyLimit(async () => {
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
      return parseResponsesEventStreamStream(response.body);
    }

    if (contentType.includes("application/json")) {
      return parseResponsesJsonPayload(await response.json());
    }

    throw new Error(
      `Responses API returned unsupported content type: ${contentType || "unknown"}.`,
    );
  });
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

function normalizeReviewedIntakeSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("reviewedSnapshot is invalid.");
  }

  const normalizedExtraction = normalizeReviewedIntakeExtraction(raw.extraction);
  const normalizedReviewState = normalizeReviewedIntakeReviewState(raw.reviewState, normalizedExtraction.nextActions.length);
  return {
    extraction: applyReviewedIntakeReviewState(normalizedExtraction, normalizedReviewState),
    reviewState: normalizedReviewState,
  };
}

function normalizeReviewedIntakeExtraction(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("reviewedSnapshot.extraction is invalid.");
  }

  const contacts = asArray(raw.contacts).map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`reviewedSnapshot.extraction.contacts[${index}] is invalid.`);
    }
    return {
      name: clipText(asString(item.name), 40),
      role: clipText(asString(item.role), 40),
    };
  });

  const nextActions = asArray(raw.nextActions).map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`reviewedSnapshot.extraction.nextActions[${index}] is invalid.`);
    }

    const title = clipText(asString(item.title), 80);
    if (!title) {
      throw new Error(`reviewedSnapshot.extraction.nextActions[${index}] is missing a title.`);
    }

    return {
      title,
      assigneeName: clipText(asString(item.assigneeName), 40),
      dueDate: normalizeDateOnly(item.dueDate),
    };
  });

  const stageAfterUpdate = clipText(asString(raw.stageAfterUpdate), 80);
  if (!stageAfterUpdate) {
    throw new Error("reviewedSnapshot.extraction.stageAfterUpdate is required.");
  }

  const nextStep = clipText(asString(raw.nextStep), 120);
  const feedbackSummary = clipText(asString(raw.feedbackSummary), 260);
  const blockers = clipText(asString(raw.blockers), 180);
  const opportunities = clipText(asString(raw.opportunities), 180);
  const issues = uniqueStrings(
    asArray(raw.issues)
      .map((item) => clipText(asString(item), 80))
      .filter(Boolean),
  );

  return {
    department: clipText(asString(raw.department), 80),
    contacts: ensureUniqueByName(contacts).filter((item) => item.name),
    feedbackSummary,
    blockers,
    opportunities,
    issues,
    nextActions,
    stageAfterUpdate,
    managerAttentionNeeded: Boolean(raw.managerAttentionNeeded),
    nextStep,
  };
}

function normalizeReviewedIntakeReviewState(raw, nextActionCount) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("reviewedSnapshot.reviewState is invalid.");
  }

  const nextStepCancelled = Boolean(raw.nextStep?.cancelled);
  const nextActions = asArray(raw.nextActions);
  if (nextActions.length !== nextActionCount) {
    throw new Error("reviewedSnapshot.reviewState.nextActions length does not match extraction.nextActions length.");
  }

  return {
    nextStep: {
      cancelled: nextStepCancelled,
    },
    nextActions: nextActions.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`reviewedSnapshot.reviewState.nextActions[${index}] is invalid.`);
      }
      const itemId = clipText(asString(item.itemId), 80) || `next-action-${index}`;
      return {
        itemId,
        cancelled: Boolean(item.cancelled),
      };
    }),
  };
}

function applyReviewedIntakeReviewState(extraction, reviewState) {
  const keptActions = extraction.nextActions.filter((_, index) => !reviewState.nextActions[index]?.cancelled);
  return {
    ...extraction,
    nextStep: reviewState.nextStep.cancelled ? "" : extraction.nextStep,
    nextActions: keptActions,
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
  const regions = Array.isArray(input.regions) ? input.regions : [];
  const normalizedUsers = normalizeUsers(Array.isArray(input.users) ? input.users : [], regions);
  const userIds = new Set(normalizedUsers.map((item) => item.id));
  const normalizedAuthSessions = normalizeAuthSessions(
    Array.isArray(input.authSessions) ? input.authSessions : [],
    userIds,
  );
  const currentUserId =
    asString(input.currentUserId) && userIds.has(asString(input.currentUserId))
      ? asString(input.currentUserId)
      : normalizedUsers[0]?.id || "";

  return {
    meta: input.meta || { version: "0.1.0", createdAt: nowIso(), updatedAt: nowIso() },
    currentUserId,
    regions,
    users: normalizedUsers,
    authSessions: normalizedAuthSessions,
    backupPolicy: normalizeBackupPolicy(input?.backupPolicy),
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

function normalizeUsers(users, regions) {
  const usedAccounts = new Set();
  const normalizedUsers = users.map((user, index) => normalizeUserRecord(user, index, usedAccounts));
  return ensureBackupAdminUser(normalizedUsers, usedAccounts, regions);
}

function normalizeUserRecord(user, index, usedAccounts) {
  const normalizedRole = normalizeUserRole(asString(user?.role));
  if (!normalizedRole) {
    throw new Error(`Unsupported user role in data store: ${asString(user?.role) || "(empty)"}.`);
  }
  const baseName = clipText(asString(user?.name), 40) || `用户${index + 1}`;
  const account = toUniqueAccount(normalizeAccount(user?.account) || normalizeAccount(user?.id), usedAccounts);
  const passwordSalt = asString(user?.passwordSalt) || createPasswordSalt();
  const passwordHash =
    asString(user?.passwordHash) || hashPassword(DEFAULT_INITIAL_PASSWORD, passwordSalt);

  return {
    id: asString(user?.id) || createId("user"),
    name: baseName,
    role: normalizedRole,
    regionId: asString(user?.regionId),
    account,
    passwordSalt,
    passwordHash,
    createdAt: asString(user?.createdAt) || nowIso(),
    isBackupAdmin: normalizeBoolean(user?.isBackupAdmin),
  };
}

function ensureBackupAdminUser(users, usedAccounts, regions) {
  let backupAdminUser = users.find((item) => normalizeAccount(item.account) === BACKUP_ADMIN_ACCOUNT);
  if (!backupAdminUser) {
    backupAdminUser = users.find((item) => item.isBackupAdmin);
  }
  if (!backupAdminUser) {
    const passwordSalt = createPasswordSalt();
    backupAdminUser = {
      id: createId("user"),
      name: BACKUP_ADMIN_NAME || "Backup Admin",
      role: "manager",
      regionId: asString(regions[0]?.id) || asString(users[0]?.regionId),
      account: toUniqueAccount(BACKUP_ADMIN_ACCOUNT, usedAccounts),
      passwordSalt,
      passwordHash: hashPassword(DEFAULT_INITIAL_PASSWORD, passwordSalt),
      createdAt: nowIso(),
      isBackupAdmin: true,
    };
    users.push(backupAdminUser);
  }
  for (const user of users) {
    user.isBackupAdmin = user.id === backupAdminUser.id;
  }
  backupAdminUser.role = "manager";
  if (!backupAdminUser.account) {
    backupAdminUser.account = toUniqueAccount(BACKUP_ADMIN_ACCOUNT, usedAccounts);
  }
  if (!backupAdminUser.regionId) {
    backupAdminUser.regionId = asString(regions[0]?.id) || asString(users[0]?.regionId);
  }
  return users;
}

function normalizeAuthSessions(authSessions, userIds) {
  return authSessions
    .map((item) => ({
      id: asString(item?.id),
      userId: asString(item?.userId),
      token: asString(item?.token),
      createdAt: asString(item?.createdAt) || nowIso(),
      lastUsedAt: asString(item?.lastUsedAt) || asString(item?.createdAt) || nowIso(),
    }))
    .filter((item) => item.id && item.userId && item.token && userIds.has(item.userId));
}

function createAuthSession(userId) {
  const session = {
    id: createId("auth"),
    userId,
    token: createAuthToken(),
    createdAt: nowIso(),
    lastUsedAt: nowIso(),
  };
  store.authSessions.push(session);
  return session;
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

function normalizeBackupDateInput(value) {
  const normalized = normalizeDateOnly(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeBackupFrequency(value) {
  const normalized = asString(value).toLowerCase();
  return normalized === "weekly" ? "weekly" : normalized === "daily" ? "daily" : "";
}

function normalizeBackupPolicy(policy) {
  const schedule = policy && typeof policy === "object" ? policy.schedule : null;
  const normalizedSchedule = {
    frequency: normalizeBackupFrequency(schedule?.frequency) || "daily",
    hour: normalizeHourValue(schedule?.hour, DAILY_BACKUP_HOUR),
    minute: normalizeMinuteValue(schedule?.minute, DAILY_BACKUP_MINUTE),
    weekday: normalizeWeekdayValue(schedule?.weekday, DEFAULT_BACKUP_WEEKDAY),
  };
  return {
    maxBackups: MAX_BACKUP_COUNT,
    schedule: normalizedSchedule,
  };
}

function normalizeBackupScheduleInput(input) {
  const frequency = normalizeBackupFrequency(input?.frequency);
  if (!frequency) {
    throw new Error("backup frequency is invalid.");
  }
  const hour = normalizeHourValue(input?.hour, NaN);
  if (!Number.isInteger(hour)) {
    throw new Error("backup hour is invalid.");
  }
  const minute = normalizeMinuteValue(input?.minute, NaN);
  if (!Number.isInteger(minute)) {
    throw new Error("backup minute is invalid.");
  }
  const weekday = frequency === "weekly" ? normalizeWeekdayValue(input?.weekday, NaN) : DEFAULT_BACKUP_WEEKDAY;
  if (frequency === "weekly" && !Number.isInteger(weekday)) {
    throw new Error("backup weekday is invalid.");
  }
  return {
    frequency,
    hour,
    minute,
    weekday,
  };
}

function normalizeHourValue(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallbackValue;
}

function normalizeMinuteValue(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 59 ? parsed : fallbackValue;
}

function normalizeWeekdayValue(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : fallbackValue;
}

function getBackupPolicy() {
  return normalizeBackupPolicy(store?.backupPolicy);
}

function getBackupSchedule() {
  return getBackupPolicy().schedule;
}

function getBackupMaxCount() {
  return getBackupPolicy().maxBackups;
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

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeUserRole(rawRole) {
  const role = asString(rawRole).toLowerCase();
  if (!role) {
    return "";
  }
  if (ROLE_DEFINITIONS[role]) {
    return role;
  }
  if (role === "regional_manager" || role === "district_manager" || role === "director" || role === "vp") {
    return "manager";
  }
  if (role === "supervisor") {
    return "supervisor";
  }
  if (role === "field_staff") {
    return "specialist";
  }
  return "";
}

function normalizeAccount(value) {
  return asString(value).toLowerCase();
}

function isValidAccount(account) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(asString(account));
}

function toUniqueAccount(rawAccount, usedAccounts) {
  const cleaned = normalizeAccount(rawAccount).replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  const base = cleaned.length >= 3 ? cleaned : `user${usedAccounts.size + 1}`;
  let account = base;
  let cursor = 2;
  while (!isValidAccount(account) || usedAccounts.has(account)) {
    const suffix = String(cursor);
    const head = base.slice(0, Math.max(3, 40 - suffix.length));
    account = `${head}${suffix}`;
    cursor += 1;
  }
  usedAccounts.add(account);
  return account;
}

function createPasswordSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, PASSWORD_PBKDF2_ITERATIONS, PASSWORD_PBKDF2_KEY_LENGTH, PASSWORD_PBKDF2_DIGEST)
    .toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  const normalizedSalt = asString(salt);
  const normalizedHash = asString(expectedHash);
  if (!normalizedSalt || !normalizedHash || !password) {
    return false;
  }
  const actual = Buffer.from(hashPassword(password, normalizedSalt), "hex");
  const expected = Buffer.from(normalizedHash, "hex");
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

function createAuthToken() {
  return crypto.randomBytes(24).toString("hex");
}

function extractBearerToken(req) {
  const header = asString(req.headers?.authorization);
  if (header.toLowerCase().startsWith("bearer ")) {
    return asString(header.slice(7));
  }
  return asString(req.headers?.["x-auth-token"]);
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

function runWithResponsesConcurrencyLimit(task) {
  return new Promise((resolve, reject) => {
    const startTask = () => {
      responsesLimiterState.activeCount += 1;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          responsesLimiterState.activeCount = Math.max(0, responsesLimiterState.activeCount - 1);
          flushResponsesRequestQueue();
        });
    };

    if (responsesLimiterState.activeCount < responsesMaxConcurrentRequests) {
      startTask();
      return;
    }

    responsesRequestQueue.push(startTask);
  });
}

function flushResponsesRequestQueue() {
  while (
    responsesLimiterState.activeCount < responsesMaxConcurrentRequests &&
    responsesRequestQueue.length
  ) {
    const nextTask = responsesRequestQueue.shift();
    if (typeof nextTask === "function") {
      nextTask();
    }
  }
}

async function parseResponsesEventStreamStream(body) {
  if (!body || typeof body.getReader !== "function") {
    throw new Error("Responses API stream body is unavailable.");
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
      throw new Error("Responses API returned malformed SSE data.");
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
        if (completed) {
          break;
        }
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      const consumed = consumeSseBlocks(`${buffer}\n\n`);
      for (const entry of consumed.entries) {
        processEntry(entry);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore reader cancellation errors after the completion event.
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
