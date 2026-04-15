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
import {
  normalizeBackupPolicy as normalizeBackupPolicyWithDefaults,
  normalizeBackupScheduleInput as normalizeBackupScheduleInputWithDefaults,
  resolveNextBackupRunAt,
} from "./server/modules/backup-schedule-utils.js";
import {
  buildBackupItem as buildBackupItemInStorage,
  createStoreBackup as createStoreBackupInStorage,
  listBackupFileNames as listBackupFileNamesInStorage,
  listStoreBackups as listStoreBackupsInStorage,
  pruneBackups as pruneBackupsInStorage,
  resolveBackupFilePath as resolveBackupFilePathInStorage,
  resolveBackupTrigger as resolveBackupTriggerInStorage,
} from "./server/modules/backup-storage-utils.js";
import {
  restoreStoreBackupByDate as restoreStoreBackupByDateInModule,
  restoreStoreBackupFromId as restoreStoreBackupFromIdInModule,
} from "./server/modules/backup-restore-utils.js";
import {
  buildBackupPayload as buildBackupPayloadInModule,
  initializeBackupSystem as initializeBackupSystemInModule,
  runScheduledBackup as runScheduledBackupInModule,
  scheduleNextBackupRun as scheduleNextBackupRunInModule,
} from "./server/modules/backup-orchestrator-utils.js";
import { buildBootstrapPayloadView } from "./server/modules/bootstrap-payload-utils.js";
import {
  buildDashboardMetrics as buildDashboardMetricsInModule,
  buildSignalsPayload as buildSignalsPayloadInModule,
} from "./server/modules/dashboard-signal-utils.js";
import { buildHealthPayloadView } from "./server/modules/health-payload-utils.js";
import { buildManagementPayloadView } from "./server/modules/management-payload-utils.js";
import {
  buildProjectCollections as buildProjectCollectionsInModule,
  buildProjectMetrics as buildProjectMetricsInModule,
} from "./server/modules/project-view-aggregator-utils.js";
import {
  buildTaskViewEntity as buildTaskViewEntityInModule,
  buildUpdateViewEntity as buildUpdateViewEntityInModule,
} from "./server/modules/entity-view-utils.js";
import {
  buildContactViewEntity as buildContactViewEntityInModule,
  buildProjectRemarkViewEntity as buildProjectRemarkViewEntityInModule,
  buildUserViewEntity as buildUserViewEntityInModule,
} from "./server/modules/support-view-utils.js";
import {
  normalizeScenarioForStorageView as normalizeScenarioForStorageViewInModule,
  parseScenarioPayloadInput as parseScenarioPayloadInputInModule,
} from "./server/modules/scenario-utils.js";
import {
  buildFollowupHistoryPayloadView as buildFollowupHistoryPayloadInModule,
  buildFollowupHistoryDetailedView as buildFollowupHistoryDetailedViewInModule,
  buildFollowupHistorySessionsForProjectView as buildFollowupHistorySessionsForProjectInModule,
  buildFollowupHistorySessionSummary as buildFollowupHistorySessionSummaryInModule,
  buildFollowupHistoryView as buildFollowupHistoryViewInModule,
  buildFollowupQuestionViewModel as buildFollowupQuestionViewModelInModule,
  findPendingFollowupQuestionsForSession as findPendingFollowupQuestionsForSessionInModule,
} from "./server/modules/followup-history-view-utils.js";
import { handleFollowupHistoryRequestView as handleFollowupHistoryRequestInModule } from "./server/modules/followup-history-handler-utils.js";
import { handleFollowupQuestionRequestView as handleFollowupQuestionRequestInModule } from "./server/modules/followup-question-handler-utils.js";
import {
  buildFollowupPromptView as buildFollowupPromptInModule,
  normalizeFollowupQuestionsPayloadView as normalizeFollowupQuestionsPayloadInModule,
} from "./server/modules/followup-question-utils.js";
import { answerFollowupQuestionsBatchView as answerFollowupQuestionsBatchInModule } from "./server/modules/followup-answer-utils.js";
import { closeFollowupSessionOnSubmitView as closeFollowupSessionOnSubmitInModule } from "./server/modules/followup-session-utils.js";
import {
  createFollowupQuestionsView as createFollowupQuestionsInModule,
  createFollowupSessionView as createFollowupSessionInModule,
} from "./server/modules/followup-create-utils.js";
import { buildFollowupContextForExtractionView as buildFollowupContextForExtractionInModule } from "./server/modules/followup-context-utils.js";
import {
  normalizeFollowupAnswerItems as normalizeFollowupAnswerItemsInModule,
  parseFollowupBatchAnswerRouteInput as parseFollowupBatchAnswerRouteInputInModule,
  parseFollowupHistoryRouteInput as parseFollowupHistoryRouteInputInModule,
  parseFollowupQuestionRouteInput as parseFollowupQuestionRouteInputInModule,
  parseFollowupSingleAnswerRouteInput as parseFollowupSingleAnswerRouteInputInModule,
} from "./server/modules/followup-route-validation-utils.js";
import {
  buildFollowupItemsForBatchAnswer as buildFollowupItemsForBatchAnswerInModule,
  resolveFollowupQuestionForSingleAnswer as resolveFollowupQuestionForSingleAnswerInModule,
} from "./server/modules/followup-question-lookup-utils.js";
import {
  assertHistorySessionValidForQuestionRoute as assertHistorySessionValidForQuestionRouteInModule,
  resolveFollowupAnswerAccessContext as resolveFollowupAnswerAccessContextInModule,
  resolveFollowupProjectForQuestionRoute as resolveFollowupProjectForQuestionRouteInModule,
  resolveFollowupSessionForProjectAction as resolveFollowupSessionForProjectActionInModule,
  resolveFollowupSessionForQuestionRoute as resolveFollowupSessionForQuestionRouteInModule,
} from "./server/modules/followup-access-utils.js";
import { resolveIntakeRouteContextView as resolveIntakeRouteContextInModule } from "./server/modules/intake-route-utils.js";
import {
  collectAccessibleUserIdsByRole as collectAccessibleUserIdsByRoleInModule,
  buildProjectViewsForVisibleIds as buildProjectViewsForVisibleIdsInModule,
  buildTaskViewsForVisibleIds as buildTaskViewsForVisibleIdsInModule,
  canUserAccessProjectByRole as canUserAccessProjectByRoleInModule,
  collectVisibleProjectIdsByAccess as collectVisibleProjectIdsByAccessInModule,
} from "./server/modules/visibility-view-utils.js";

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
const simulationMode = isTruthyEnvValue(process.env.SIMULATION_MODE);
const simulationClockFile = simulationMode ? asString(process.env.SIMULATION_CLOCK_FILE).trim() : "";
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
const businessClock = createBusinessClock({
  simulationMode,
  clockFile: simulationClockFile,
});

businessClock.assertReady();

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
    supervisorUserId: resolveSupervisorAssignmentForUser({
      user: {
        id: "",
        role,
        regionId,
      },
      users: store.users,
      regionId,
      requestedSupervisorUserId: req.body?.supervisorUserId,
      allowImplicitRegionAssignment: true,
    }),
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
  const hasSupervisorUserId = Boolean(req.body && Object.prototype.hasOwnProperty.call(req.body, "supervisorUserId"));
  const supervisorUserId = hasSupervisorUserId ? asString(req.body?.supervisorUserId) : undefined;
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

  try {
    const nextSupervisorUserId = resolveSupervisorAssignmentForUser({
      user,
      users: store.users,
      regionId: region.id,
      requestedSupervisorUserId: supervisorUserId,
      allowImplicitRegionAssignment: false,
    });
    ensureSupervisorRegionChangeDoesNotBreakAssignments({
      user,
      users: store.users,
      regionId: region.id,
    });
    user.regionId = region.id;
    user.supervisorUserId = nextSupervisorUserId;
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "user payload is invalid." });
    return;
  }
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
  const allowed = new Set(["todo", "in_progress", "blocked", "completed"]);
  const hasTaskStatus = Boolean(req.body && Object.prototype.hasOwnProperty.call(req.body, "taskStatus"));
  const hasDueDate = Boolean(req.body && Object.prototype.hasOwnProperty.call(req.body, "dueDate"));
  const taskStatus = hasTaskStatus ? asString(req.body?.taskStatus) : "";
  const dueDate = hasDueDate ? normalizeDateOnly(req.body?.dueDate) : "";

  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  if (!hasTaskStatus && !hasDueDate) {
    res.status(400).json({ error: "At least one task update field is required." });
    return;
  }
  if (hasTaskStatus && !allowed.has(taskStatus)) {
    res.status(400).json({ error: "taskStatus is invalid." });
    return;
  }
  if (hasDueDate && !dueDate) {
    res.status(400).json({ error: "dueDate must be a valid YYYY-MM-DD string." });
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

  if (hasTaskStatus) {
    const previousStatus = task.status;
    task.status = taskStatus;
    if (taskStatus === "completed") {
      task.completedAt = previousStatus === "completed" && task.completedAt ? task.completedAt : nowIso();
    } else {
      task.completedAt = null;
    }
  }
  if (hasDueDate) {
    const previousDueAt = asString(task.dueAt) || null;
    const nextDueAt = buildTaskDueAtFromDateOnly(dueDate);
    if (previousDueAt !== nextDueAt) {
      ensureTaskDueDateHistory(task).push({
        id: createId("task-due"),
        previousDueAt,
        nextDueAt,
        changedAt: nowIso(),
        changedByUserId: req.currentUser.id,
      });
      if (!task.initialDueAt) {
        task.initialDueAt = nextDueAt;
      }
      task.dueAt = nextDueAt;
    } else if (!task.initialDueAt) {
      task.initialDueAt = nextDueAt;
    }
  }
  touchStore();
  persistStore();

  res.json({
    ok: true,
    task: buildTaskView(task),
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/tasks/:taskId/records", (req, res) => {
  const task = store.tasks.find((item) => item.id === req.params.taskId);
  const content = clipText(asString(req.body?.content), 1000);

  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (!content) {
    res.status(400).json({ error: "content is required." });
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

  ensureTaskRecords(task).push({
    id: createId("task-record"),
    content,
    createdAt: nowIso(),
    createdByUserId: req.currentUser.id,
  });
  touchStore();
  persistStore();

  res.json({
    ok: true,
    task: buildTaskView(task),
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.patch("/api/projects/:projectId/contacts", (req, res) => {
  const projectId = asString(req.params?.projectId);
  const rawContacts = req.body?.contacts;
  const rawOriginalContacts = req.body?.originalContacts;
  const rawMergeActions = req.body?.mergeActions;
  const project = getProjectById(projectId);

  if (!projectId) {
    res.status(400).json({ error: "projectId is required." });
    return;
  }
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (!canUserAccessProject(req.currentUser, project)) {
    res.status(403).json({ error: "Current user is not allowed to update contacts for this project." });
    return;
  }
  if (!Array.isArray(rawContacts)) {
    res.status(400).json({ error: "contacts must be an array." });
    return;
  }

  let contacts;
  let originalContacts;
  let mergeActions;
  try {
    contacts = normalizeEditableContacts(rawContacts);
    originalContacts = normalizeEditableOriginalContacts(rawOriginalContacts);
    mergeActions = normalizeEditableContactMergeActions(rawMergeActions);
    validateEditableContactMergeActions({
      mergeActions,
      contacts,
      originalContacts,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "contacts payload is invalid." });
    return;
  }

  const resolvedContacts = replaceHospitalContacts({
    hospitalId: project.hospitalId,
    contacts,
    touchedAt: nowIso(),
  });
  applyProjectContactPropagation({
    project,
    originalContacts,
    contacts: resolvedContacts,
    mergeActions,
  });
  touchStore();
  persistStore();

  res.json({
    ok: true,
    project: buildProjectView(project),
    bootstrap: buildBootstrapPayload(req.currentUser),
  });
});

app.post("/api/projects", (req, res) => {
  const hospitalName = clipText(asString(req.body?.hospitalName), 120);
  const departmentName = clipText(asString(req.body?.departmentName), 80);
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

  const initialDepartmentId = departmentName ? ensureDepartment(hospital.id, departmentName) : "";

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
    initialDepartmentId,
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
  const historySessionId = asString(req.body?.historySessionId);
  const historyQuestionId = asString(req.body?.historyQuestionId);
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
  if ((historySessionId && !historyQuestionId) || (!historySessionId && historyQuestionId)) {
    res.status(400).json({ error: "historySessionId and historyQuestionId must be provided together." });
    return;
  }

  if (historySessionId) {
    const historySession = getFollowupSessionById(historySessionId);
    if (!historySession || historySession.projectId !== project.id) {
      res.status(400).json({ error: "historySessionId is invalid for this project." });
      return;
    }
    const historyQuestionMessage = store.messages.find(
      (item) =>
        item.id === historyQuestionId && item.sessionId === historySession.id && item.kind === "followup_question",
    );
    if (!historyQuestionMessage) {
      res.status(400).json({ error: "historyQuestionId is invalid for this history session." });
      return;
    }
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
    historySessionId: historySessionId || null,
    historyQuestionId: historyQuestionId || null,
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
  const result = await handleFollowupQuestionRequest({ req, res });
  if (!result) {
    return;
  }
  res.json({
    ok: true,
    sessionId: result.sessionId,
    question: result.questions[0] || null,
    history: result.history,
  });
});

app.post("/api/followups/questions", async (req, res) => {
  const result = await handleFollowupQuestionRequest({ req, res });
  if (!result) {
    return;
  }
  res.json(result);
});

app.get("/api/followups/history", (req, res) => {
  const result = handleFollowupHistoryRequest({ req, res });
  if (!result) {
    return;
  }
  res.json(result);
});

app.post("/api/followups/answer", (req, res) => {
  const result = handleFollowupAnswerRequest({
    req,
    res,
    mode: "single",
  });
  if (!result) {
    return;
  }
  res.json(result);
});

app.post("/api/followups/answers", (req, res) => {
  const result = handleFollowupAnswerRequest({
    req,
    res,
    mode: "batch",
  });
  if (!result) {
    return;
  }
  res.json(result);
});

app.post("/api/intake", async (req, res) => {
  const reviewedSnapshotBody = req.body?.reviewedSnapshot;
  const submitScenario = parseScenarioPayload(req.body?.submitScenario);
  if (!reviewedSnapshotBody) {
    res.status(400).json({ error: "reviewedSnapshot is required." });
    return;
  }

  const intakeContext = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Intake request is invalid.",
    action: () =>
      resolveIntakeRouteContextInModule({
        body: req.body,
        currentUser: req.currentUser,
        asString,
        normalizeDateOnly,
        todayDateOnly,
        projects: store.projects,
        canUserAccessProject,
        resolveFollowupSessionForProjectAction: resolveFollowupSessionForProjectActionInModule,
        getFollowupSessionById,
        projectUnauthorizedMessage: "Current user is not allowed to submit intake for this project.",
        followupUnauthorizedMessage: "Current user is not allowed to submit this follow-up session.",
      }),
  });
  if (!intakeContext) {
    return;
  }
  const { project, note, visitDate, departmentName, followupSession } = intakeContext;

  const reviewedSnapshot = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "reviewedSnapshot is invalid.",
    action: () => normalizeReviewedIntakeSnapshot(reviewedSnapshotBody),
  });
  if (!reviewedSnapshot) {
    return;
  }

  const result = await executeRouteStepAsync({
    res,
    fallbackStatus: 500,
    fallbackMessage: "Failed to process intake.",
    action: () =>
      processIntake({
        project,
        note,
        visitDate,
        departmentName,
        followupSession,
        submitScenario,
        currentUser: req.currentUser,
        reviewedSnapshot,
      }),
  });
  if (!result) {
    return;
  }
  res.json(result);
});

app.post("/api/intake/preview", async (req, res) => {
  const intakeContext = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Intake preview request is invalid.",
    action: () =>
      resolveIntakeRouteContextInModule({
      body: req.body,
      currentUser: req.currentUser,
      asString,
      normalizeDateOnly,
      todayDateOnly,
      projects: store.projects,
      canUserAccessProject,
      resolveFollowupSessionForProjectAction: resolveFollowupSessionForProjectActionInModule,
      getFollowupSessionById,
      projectUnauthorizedMessage: "Current user is not allowed to preview intake for this project.",
      followupUnauthorizedMessage: "Current user is not allowed to preview with this follow-up session.",
    }),
  });
  if (!intakeContext) {
    return;
  }
  const { project, note, visitDate, followupSession } = intakeContext;

  const extracted = await executeRouteStepAsync({
    res,
    fallbackStatus: 500,
    fallbackMessage: "Failed to generate intake preview.",
    action: () => extractStructuredUpdate({ project, note, visitDate, followupSession }),
  });
  if (!extracted) {
    return;
  }
  res.json({
    ok: true,
    generatedAt: nowIso(),
    extractionSource: extracted.source,
    extractionWarnings: extracted.warnings,
    extraction: extracted.extraction,
  });
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
  const visibleUserIds = collectAccessibleUserIds(resolvedCurrentUser);
  const projects = buildProjectViews(resolvedCurrentUser, visibleProjectIds);
  const tasks = buildTaskViews(resolvedCurrentUser, visibleProjectIds);
  return buildBootstrapPayloadView({
    resolvedCurrentUser,
    nowIso,
    buildHealthPayload,
    buildUserView,
    stages: store.stages,
    issueTags: store.issueTags,
    users: store.users.filter((user) => visibleUserIds.has(asString(user?.id))),
    regions: store.regions,
    buildDashboard,
    buildSignals,
    buildManagementPayload,
    isBackupAdminUser,
    projects,
    tasks,
    visibleProjectIds,
  });
}

function buildHealthPayload() {
  const health = getResponsesApiHealth();
  const backupSchedule = getBackupSchedule();
  return buildHealthPayloadView({
    health,
    responsesModel,
    responsesBaseUrl,
    responsesMaxConcurrentRequests,
    activeRequests: responsesLimiterState.activeCount,
    queuedRequests: responsesRequestQueue.length,
    storePath: STORE_PATH,
    projectCount: store.projects.length,
    taskCount: store.tasks.length,
    simulation: businessClock.describe(),
    backupPath: BACKUP_DIR,
    backupMaxCount: getBackupMaxCount(),
    backupSchedule,
    backupSchedulerState,
  });
}

function buildBackupPayload() {
  return buildBackupPayloadInModule({
    listStoreBackups,
    nowIso,
    policy: store.backupPolicy,
    schedulerState: backupSchedulerState,
    uniqueStrings,
  });
}

function initializeBackupSystem() {
  initializeBackupSystemInModule({
    backupDir: BACKUP_DIR,
    mkdirSync,
    pruneBackups,
    getBackupMaxCount,
    scheduleNextBackupRun,
  });
}

function scheduleNextBackupRun(referenceDate) {
  scheduleNextBackupRunInModule({
    referenceDate,
    resolveNextBackupRunAt,
    getBackupSchedule,
    schedulerState: backupSchedulerState,
    runScheduledBackup,
  });
}

function runScheduledBackup() {
  runScheduledBackupInModule({
    schedulerState: backupSchedulerState,
    createStoreBackup,
    pruneBackups,
    getBackupMaxCount,
    nowIso,
    scheduleNextBackupRun,
    logError(error) {
      console.error("[backup] scheduled backup failed:", error instanceof Error ? error.message : error);
    },
  });
}

function createStoreBackup(trigger) {
  return createStoreBackupInStorage({
    trigger,
    backupDir: BACKUP_DIR,
    backupFilePrefix: BACKUP_FILE_PREFIX,
    backupFileSuffix: BACKUP_FILE_SUFFIX,
    storeSnapshot: store,
    createId,
    nowIso,
    asString,
  });
}

function listStoreBackups() {
  return listStoreBackupsInStorage({
    backupDir: BACKUP_DIR,
    backupFilePrefix: BACKUP_FILE_PREFIX,
    backupFileSuffix: BACKUP_FILE_SUFFIX,
    compareIsoDesc,
  });
}

function pruneBackups(maxCount) {
  return pruneBackupsInStorage({
    maxCount,
    getBackupMaxCount,
    backupDir: BACKUP_DIR,
    backupFilePrefix: BACKUP_FILE_PREFIX,
    backupFileSuffix: BACKUP_FILE_SUFFIX,
    compareIsoDesc,
  });
}

function restoreStoreBackup(backupId) {
  return restoreStoreBackupFromIdInModule({
    backupId,
    resolveBackupFilePath,
    normalizeStoreShape,
    nowIso,
    applyNormalizedStore(normalized) {
      store = normalized;
      touchStore();
      persistStore();
      initializeBackupSystem();
    },
  });
}

function restoreStoreBackupByDate(backupDate) {
  return restoreStoreBackupByDateInModule({
    backupDate,
    normalizeBackupDateInput,
    listStoreBackups,
    restoreStoreBackup,
  });
}

function listBackupFileNames() {
  return listBackupFileNamesInStorage({
    backupDir: BACKUP_DIR,
    backupFilePrefix: BACKUP_FILE_PREFIX,
    backupFileSuffix: BACKUP_FILE_SUFFIX,
  });
}

function buildBackupItem(fileName, stat) {
  return buildBackupItemInStorage({ fileName, stat });
}

function resolveBackupTrigger(fileName) {
  return resolveBackupTriggerInStorage(fileName);
}

function resolveBackupFilePath(backupId) {
  return resolveBackupFilePathInStorage({
    backupId,
    backupDir: BACKUP_DIR,
    backupFilePrefix: BACKUP_FILE_PREFIX,
    backupFileSuffix: BACKUP_FILE_SUFFIX,
    asString,
  });
}

function buildDashboard(projects, tasks) {
  return buildDashboardMetricsInModule({
    projects,
    tasks,
    mapCountEntries,
  });
}

function buildSignals(projects, tasks, visibleProjectIds) {
  return buildSignalsPayloadInModule({
    projects,
    tasks,
    updates: store.updates,
    visibleProjectIds,
    compareIsoDesc,
    buildUpdateView,
  });
}

function canUserAccessProject(currentUser, project) {
  return canUserAccessProjectByRoleInModule({
    currentUser,
    project,
    users: store.users,
    normalizeUserRole,
    asString,
  });
}

function isManagerUser(user) {
  return normalizeUserRole(asString(user?.role)) === "manager";
}

function isBackupAdminUser(user) {
  return Boolean(user?.isBackupAdmin) || normalizeAccount(user?.account) === BACKUP_ADMIN_ACCOUNT;
}

function buildManagementPayload(currentUser) {
  return buildManagementPayloadView({
    currentUser,
    roleDefinitions: ROLE_DEFINITIONS,
    users: store.users,
    normalizeUserRole,
    buildUserView,
    asString,
    isBackupAdminUser,
  });
}

function collectAccessibleUserIds(currentUser) {
  return collectAccessibleUserIdsByRoleInModule({
    currentUser,
    users: store.users,
    normalizeUserRole,
    asString,
  });
}

function collectVisibleProjectIds(currentUser) {
  return collectVisibleProjectIdsByAccessInModule({
    projects: store.projects,
    currentUser,
    canUserAccessProject,
  });
}

function buildProjectViews(currentUser, visibleProjectIds = collectVisibleProjectIds(currentUser)) {
  return buildProjectViewsForVisibleIdsInModule({
    projects: store.projects,
    visibleProjectIds,
    buildProjectView,
    compareProjectViews,
  });
}

function buildProjectView(project) {
  const hospital = getHospitalById(project.hospitalId);
  const region = getRegionById(project.regionId);
  const stage = getStageById(project.currentStageId);
  const { tasks, updates, contacts, remarks } = buildProjectCollectionsInModule({
    project,
    tasks: store.tasks,
    updates: store.updates,
    contacts: store.contacts,
    remarks: store.remarks,
    buildTaskView,
    buildUpdateView,
    buildContactView,
    buildProjectRemarkView,
    compareTaskViews,
    compareIsoDesc,
    compareIsoAsc,
  });
  const stalledDays = calculateStalledDays(project.lastFollowUpAt);
  const metrics = buildProjectMetricsInModule({ tasks, updates, remarks });
  const contactReferenceWarnings = buildProjectContactReferenceWarningMessages({
    project,
    updates,
    tasks,
  });

  const hasUpdates = updates.length > 0;
  const initialDepartmentName = !hasUpdates
    ? getDepartmentById(project.initialDepartmentId)?.name || ""
    : "";

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
    nextAction: renderStoredTextValue(project, "nextActionSegments", "nextAction"),
    nextActionDueAt: project.nextActionDueAt,
    latestSummary: renderStoredTextValue(project, "latestSummarySegments", "latestSummary"),
    departmentName: hasUpdates ? updates[0]?.departmentName || "" : initialDepartmentName,
    departmentSuggestions: listHospitalDepartmentNames(project.hospitalId),
    issueNames: (project.currentIssueTagIds || [])
      .map((id) => getIssueTagById(id)?.name)
      .filter(Boolean),
    blockers: updates[0]?.blockers || "",
    contacts,
    contactReferenceWarnings,
    remarks,
    tasks,
    updates,
    metrics,
    stalledDays,
    isStalled: stalledDays >= 10,
  };
}

function buildTaskViews(currentUser, visibleProjectIds = collectVisibleProjectIds(currentUser)) {
  return buildTaskViewsForVisibleIdsInModule({
    tasks: store.tasks,
    visibleProjectIds,
    buildTaskView,
    compareTaskViews,
  });
}
function buildTaskView(task) {
  return buildTaskViewEntityInModule({
    task: {
      ...task,
      title: renderStoredTextValue(task, "titleSegments", "title"),
      description: renderStoredTextValue(task, "descriptionSegments", "description"),
      relatedContactIds: resolveExistingContactIds(task.relatedContactIds),
      relatedContacts: resolveContactViewsByIds(task.relatedContactIds),
      contactReferenceWarnings: buildEntityContactReferenceWarningMessages(task, "待办事项"),
    },
    getProjectById,
    getHospitalById,
    getUserById,
    isDatePast,
  });
}

function buildUpdateView(update) {
  return buildUpdateViewEntityInModule({
    update: {
      ...update,
      contactEntries: buildRenderedContactEntries(update.contactEntries),
      feedbackSummary: renderStoredTextValue(update, "feedbackSummarySegments", "feedbackSummary"),
      blockers: renderStoredTextValue(update, "blockersSegments", "blockers"),
      opportunities: renderStoredTextValue(update, "opportunitiesSegments", "opportunities"),
      nextStep: renderStoredTextValue(update, "nextStepSegments", "nextStep"),
      relatedContactIds: resolveExistingContactIds((update.contactEntries || []).map((item) => item.contactId)),
      relatedContacts: resolveContactViewsByIds((update.contactEntries || []).map((item) => item.contactId)),
      contactReferenceWarnings: buildEntityContactReferenceWarningMessages(update, "历史时间线"),
    },
    getProjectById,
    getHospitalById,
    getUserById,
    getDepartmentById,
    getIssueTagById,
    getStageById,
  });
}

function buildContactView(contact) {
  return buildContactViewEntityInModule({
    contact,
    getDepartmentById,
  });
}

function buildUserView(user) {
  return buildUserViewEntityInModule({
    user,
    normalizeUserRole,
    roleDefinitions: ROLE_DEFINITIONS,
    getRegionById,
    getUserById,
    isBackupAdminUser,
  });
}

function buildProjectRemarkView(remark) {
  return buildProjectRemarkViewEntityInModule({
    remark,
    getUserById,
  });
}

function renderStoredTextValue(entity, segmentField, legacyField) {
  return renderStoredTextSegments(entity?.[segmentField], entity?.[legacyField]);
}

function renderStoredTextSegments(rawSegments, fallbackText = "") {
  return normalizeStoredTextSegments(rawSegments, fallbackText)
    .map((segment) => {
      if (segment.type === "contact") {
        return getContactById(segment.contactId)?.name || segment.fallbackText || "";
      }
      return asText(segment.text);
    })
    .join("");
}

function replaceStoredTextSegmentContactIds(rawSegments, changeBySourceId) {
  const normalizedSegments = normalizeStoredTextSegments(rawSegments);
  if (!(changeBySourceId instanceof Map) || !changeBySourceId.size) {
    return normalizedSegments;
  }
  return normalizedSegments.map((segment) => {
    if (segment.type !== "contact") {
      return segment;
    }
    const replacement = changeBySourceId.get(segment.contactId);
    if (!replacement?.to?.contactId) {
      return segment;
    }
    return {
      ...segment,
      contactId: replacement.to.contactId,
    };
  });
}

function resolveExistingContactIds(rawContactIds) {
  return normalizeStringIdArray(rawContactIds).filter((contactId) => Boolean(getContactById(contactId)));
}

function resolveContactViewsByIds(rawContactIds) {
  return resolveExistingContactIds(rawContactIds)
    .map((contactId) => getContactById(contactId))
    .filter(Boolean)
    .map((contact) => buildContactView(contact));
}

function buildRenderedContactEntries(rawEntries) {
  return normalizeStoredContactEntries(rawEntries).map((entry) => {
    const contact = getContactById(entry.contactId);
    return {
      contactId: entry.contactId,
      name: contact?.name || entry.name || "",
      role: contact?.roleTitle || entry.role || "",
      departmentName: "",
    };
  });
}

function buildEntityContactReferenceWarningMessages(entity, sourceLabel) {
  return normalizeStoredReferenceWarnings(entity?.contactReferenceWarnings).map((warning) =>
    formatContactReferenceWarningMessage(warning, sourceLabel),
  );
}

function buildProjectContactReferenceWarningMessages({ project, updates = [], tasks = [] }) {
  const messages = [
    ...buildEntityContactReferenceWarningMessages(project, "当前项目"),
    ...updates.flatMap((item) => asArray(item?.contactReferenceWarnings)),
    ...tasks.flatMap((item) => asArray(item?.contactReferenceWarnings)),
  ];
  return uniqueStrings(messages);
}

function formatContactReferenceWarningMessage(warning, sourceLabel) {
  const normalizedWarning = normalizeStoredReferenceWarnings([warning])[0];
  if (!normalizedWarning) {
    return "";
  }
  const label = sourceLabel || "当前内容";
  return `${label}中存在未解析联系人“${normalizedWarning.name}”，请先到关键联系人中确认后再关联。`;
}

function createStatusError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function respondRouteError({ res, error, fallbackStatus = 400, fallbackMessage = "Request is invalid." }) {
  const statusCode = Number(error?.statusCode) || fallbackStatus;
  res.status(statusCode).json({
    error: error instanceof Error ? error.message : fallbackMessage,
  });
}

function executeRouteStep({ res, fallbackStatus = 400, fallbackMessage = "Request is invalid.", action }) {
  try {
    return action();
  } catch (error) {
    respondRouteError({
      res,
      error,
      fallbackStatus,
      fallbackMessage,
    });
    return null;
  }
}

async function executeRouteStepAsync({ res, fallbackStatus = 500, fallbackMessage = "Request failed.", action }) {
  try {
    return await action();
  } catch (error) {
    respondRouteError({
      res,
      error,
      fallbackStatus,
      fallbackMessage,
    });
    return null;
  }
}

async function handleFollowupQuestionRequest({ req, res }) {
  return handleFollowupQuestionRequestInModule({
    req,
    res,
    executeRouteStep,
    executeRouteStepAsync,
    parseInput(body) {
      return parseFollowupQuestionRouteInputInModule({
        body,
        asString,
        normalizeDateOnly,
        todayDateOnly,
        parseScenarioPayload,
      });
    },
    resolveAccessContext({ projectId, sessionId, historySessionId, currentUser }) {
      const project = resolveFollowupProjectForQuestionRouteInModule({
        projectId,
        projects: store.projects,
        currentUser,
        canUserAccessProject,
      });
      const followupSession = resolveFollowupSessionForQuestionRouteInModule({
        sessionId,
        projectId,
        currentUser,
        getFollowupSessionById,
      });
      assertHistorySessionValidForQuestionRouteInModule({
        historySessionId,
        projectId,
        getFollowupSessionById,
      });
      return { project, followupSession };
    },
    createQuestions({ parsedInput, accessContext, currentUser }) {
      const { note, visitDate, historySessionId, scenario } = parsedInput;
      const { project, followupSession } = accessContext;
      return createFollowupQuestions({
        session: followupSession,
        project,
        note,
        visitDate,
        historySessionId: followupSession ? "" : historySessionId,
        scenario,
        source: "web-followup",
        currentUser,
        minQuestions: 1,
        maxQuestions: 1,
      });
    },
  });
}

function handleFollowupHistoryRequest({ req, res }) {
  return handleFollowupHistoryRequestInModule({
    req,
    res,
    executeRouteStep,
    parseInput(query) {
      return parseFollowupHistoryRouteInputInModule({
        query,
        asString,
      });
    },
    resolveProject({ projectId, currentUser }) {
      return resolveFollowupProjectForQuestionRouteInModule({
        projectId,
        projects: store.projects,
        currentUser,
        canUserAccessProject,
      });
    },
    buildSessions: buildFollowupHistorySessionsForProject,
    buildPayload: buildFollowupHistoryPayload,
  });
}

function handleFollowupAnswerRequest({ req, res, mode }) {
  if (mode !== "single" && mode !== "batch") {
    throw new Error("Follow-up answer mode is invalid.");
  }

  const parsedInput = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: mode === "single" ? "Follow-up answer request is invalid." : "Follow-up answers request is invalid.",
    action: () =>
      mode === "single"
        ? parseFollowupSingleAnswerRouteInputInModule({
            body: req.body,
            asString,
            parseScenarioPayload,
          })
        : parseFollowupBatchAnswerRouteInputInModule({
            body: req.body,
            asString,
            parseScenarioPayload,
          }),
  });
  if (!parsedInput) {
    return null;
  }

  const sessionId = parsedInput.sessionId;
  const session = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Follow-up answer access check failed.",
    action: () =>
      resolveFollowupAnswerAccessContextInModule({
        sessionId,
        currentUser: req.currentUser,
        getFollowupSessionById,
        getProjectById,
        canUserAccessProject,
      }).session,
  });
  if (!session) {
    return null;
  }

  if (mode === "single") {
    const { questionMessageId, answer, scenario } = parsedInput;
    const questionMessage = executeRouteStep({
      res,
      fallbackStatus: 400,
      fallbackMessage: "Follow-up question check failed.",
      action: () =>
        resolveFollowupQuestionForSingleAnswerInModule({
          messages: store.messages,
          sessionId,
          questionMessageId,
        }),
    });
    if (!questionMessage) {
      return null;
    }
    return answerFollowupQuestion({
      session,
      questionMessage,
      answer,
      scenario,
      actorUser: req.currentUser,
    });
  }

  const { answersRaw, scenario } = parsedInput;
  const normalizedAnswers = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "answers payload is invalid.",
    action: () =>
      normalizeFollowupAnswerItemsInModule({
        answersRaw,
        asString,
      }),
  });
  if (!normalizedAnswers) {
    return null;
  }

  const items = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Follow-up questions check failed.",
    action: () =>
      buildFollowupItemsForBatchAnswerInModule({
        messages: store.messages,
        sessionId,
        normalizedAnswers,
      }),
  });
  if (!items) {
    return null;
  }

  return answerFollowupQuestionsBatch({
    session,
    items,
    scenario,
    actorUser: req.currentUser,
  });
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
  return createFollowupSessionInModule({
    project,
    note,
    visitDate,
    scenario,
    source,
    currentUser,
    historySourceSessionId,
    normalizeScenarioForStorage,
    createId,
    asString,
    nowIso,
    sessions: store.sessions,
    messages: store.messages,
  });
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
  return createFollowupQuestionsInModule({
    session,
    project,
    note,
    visitDate,
    historySessionId,
    scenario,
    source,
    currentUser,
    minQuestions,
    maxQuestions,
    normalizeScenarioForStorage,
    asString,
    buildFollowupHistory,
    findPendingFollowupQuestions,
    extractFollowupQuestions,
    createFollowupSession,
    messages: store.messages,
    createId,
    nowIso,
    touchStore,
    persistStore,
    buildFollowupQuestionView,
  });
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
  return answerFollowupQuestionsBatchInModule({
    session,
    items,
    scenario,
    actorUser,
    getProjectById,
    asString,
    getUserById,
    normalizeScenarioForStorage,
    createId,
    nowIso,
    messages: store.messages,
    touchStore,
    persistStore,
    buildFollowupHistory,
  });
}

function closeFollowupSessionOnSubmit({ followupSession, intakeSessionId, scenario, project }) {
  closeFollowupSessionOnSubmitInModule({
    followupSession,
    intakeSessionId,
    scenario,
    project,
    messages: store.messages,
    normalizeScenarioForStorage,
    nowIso,
  });
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
  return buildFollowupPromptInModule({
    project,
    note,
    visitDate,
    history,
    minQuestions,
    maxQuestions,
    getHospitalById,
    getStageById,
  });
}

function normalizeFollowupQuestionsPayload(raw, { minQuestions = 1, maxQuestions = 3 } = {}) {
  return normalizeFollowupQuestionsPayloadInModule({
    raw,
    minQuestions,
    maxQuestions,
    clipText,
    asString,
  });
}

function buildFollowupHistorySessionView(session) {
  return buildFollowupHistorySessionSummaryInModule({
    session,
    messages: store.messages,
    compareIsoAsc,
    getUserById,
    buildFollowupHistoryDetailed,
  });
}

function buildFollowupHistoryDetailed(sessionId, session = null) {
  return buildFollowupHistoryDetailedViewInModule({
    sessionId,
    session,
    messages: store.messages,
    compareIsoAsc,
    asString,
    getUserById,
  });
}

function buildFollowupHistory(sessionId) {
  return buildFollowupHistoryViewInModule({
    sessionId,
    messages: store.messages,
    compareIsoAsc,
  });
}

function buildFollowupHistorySessionsForProject(projectId, limit) {
  return buildFollowupHistorySessionsForProjectInModule({
    sessions: store.sessions,
    projectId,
    limit,
    compareIsoDesc,
    buildFollowupHistorySessionView,
  });
}

function buildFollowupHistoryPayload(projectId, sessions) {
  return buildFollowupHistoryPayloadInModule({
    projectId,
    generatedAt: nowIso(),
    sessions,
  });
}

function buildFollowupQuestionView(message) {
  return buildFollowupQuestionViewModelInModule(message);
}

function findPendingFollowupQuestions(sessionId) {
  return findPendingFollowupQuestionsForSessionInModule({
    sessionId,
    messages: store.messages,
    compareIsoDesc,
  });
}

function getFollowupSessionById(sessionId) {
  const session = store.sessions.find((item) => item.id === sessionId);
  return session && session.sessionType === "followup" ? session : null;
}

function parseScenarioPayload(input) {
  return parseScenarioPayloadInputInModule(input);
}

function normalizeScenarioForStorage({ scenario, operation, project }) {
  return normalizeScenarioForStorageViewInModule({
    scenario,
    operation,
    project,
    asString,
    getStageById,
    nowIso,
  });
}

async function processIntake({
  project,
  note,
  visitDate,
  departmentName,
  followupSession,
  submitScenario,
  currentUser,
  reviewedSnapshot,
}) {
  const reviewedExtraction = reviewedSnapshot.extraction;
  const departmentId = ensureDepartment(project.hospitalId, departmentName);
  const stageBeforeId = project.currentStageId;
  const stageAfterId = resolveStageId(reviewedExtraction.stageAfterUpdate);
  if (!stageAfterId) {
    throw createStatusError(`Unknown stage returned by reviewed intake snapshot: ${reviewedExtraction.stageAfterUpdate}.`);
  }
  const issueTagIds = resolveIssueTagIds(reviewedExtraction.issues);
  const touchedAt = `${visitDate}T09:00:00.000Z`;
  const { resolvedContacts, contactResolutionByReviewId } = resolveReviewedContactSelections({
    project,
    reviewedContacts: reviewedExtraction.contacts,
    touchedAt,
  });
  const structuredContactEntries = dedupeRenderedContactEntries(
    resolvedContacts.map((item) => ({
      contactId: item.finalContact.id,
      name: item.finalContact.name,
      role: item.finalContact.roleTitle || "",
    })),
  );
  const mentionMatches = buildMentionMatchesFromResolvedContacts(resolvedContacts);
  const feedbackSummarySegments = buildTextSegmentsFromMentions({
    text: reviewedExtraction.feedbackSummary,
    matches: mentionMatches,
  }).segments;
  const blockersSegments = buildTextSegmentsFromMentions({
    text: reviewedExtraction.blockers,
    matches: mentionMatches,
  }).segments;
  const opportunitiesSegments = buildTextSegmentsFromMentions({
    text: reviewedExtraction.opportunities,
    matches: mentionMatches,
  }).segments;
  const nextStepSegments = buildTextSegmentsFromMentions({
    text: reviewedExtraction.nextStep,
    matches: mentionMatches,
  }).segments;

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
    contactEntries: structuredContactEntries,
    feedbackSummary: reviewedExtraction.feedbackSummary,
    blockers: reviewedExtraction.blockers,
    opportunities: reviewedExtraction.opportunities,
    nextStep: reviewedExtraction.nextStep,
    feedbackSummarySegments,
    blockersSegments,
    opportunitiesSegments,
    nextStepSegments,
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
    const resolvedRelatedContactIds = resolveReviewedTaskRelatedContactIds({
      rawRelatedContactIds: action.relatedContactIds,
      project,
      contactResolutionByReviewId,
    });
    const taskMentionMatches = buildMentionMatchesFromResolvedContacts(
      resolvedContacts,
      resolvedRelatedContactIds,
    );
    const task = {
      id: createId("task"),
      projectId: project.id,
      updateId: update.id,
      title: action.title,
      description: `来源于 ${getHospitalById(project.hospitalId)?.name || "医院项目"} 的 AI 录入纪要。`,
      titleSegments: buildTextSegmentsFromMentions({
        text: action.title,
        matches: taskMentionMatches,
      }).segments,
      descriptionSegments: buildTextSegmentsFromMentions({
        text: `来源于 ${getHospitalById(project.hospitalId)?.name || "医院项目"} 的 AI 录入纪要。`,
        matches: taskMentionMatches,
      }).segments,
      relatedContactIds: resolvedRelatedContactIds,
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
  project.lastFollowUpAt = touchedAt;
  project.nextAction = reviewedExtraction.nextStep || createdTasks[0]?.title || "";
  project.nextActionSegments = reviewedExtraction.nextStep
    ? nextStepSegments
    : normalizeStoredTextSegments(createdTasks[0]?.titleSegments, createdTasks[0]?.title || "");
  project.nextActionDueAt = createdTasks[0]?.dueAt || null;
  project.latestSummary = reviewedExtraction.feedbackSummary;
  project.latestSummarySegments = feedbackSummarySegments;
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
  const normalizedExtraction = normalizeExtraction(parsed);
  const previewResolved = buildPreviewResolvedExtraction({
    project,
    extraction: normalizedExtraction,
  });
  return {
    source: "responses-api",
    warnings: previewResolved.warnings,
    extraction: previewResolved.extraction,
  };
}

function buildPreviewResolvedExtraction({ project, extraction }) {
  const resolvedContacts = asArray(extraction?.contacts).map((contact, index) => {
    const matchedContacts = findHospitalContactsByExactName(project.hospitalId, contact.name);
    const reviewContactId = buildIntakeReviewContactId(index);
    if (matchedContacts.length === 1) {
      return {
        reviewContactId,
        name: contact.name,
        role: contact.role,
        matchedContactId: matchedContacts[0].id,
        resolutionStatus: "matched",
        candidateContactIds: [],
      };
    }
    if (!matchedContacts.length) {
      return {
        reviewContactId,
        name: contact.name,
        role: contact.role,
        matchedContactId: "",
        resolutionStatus: "new",
        candidateContactIds: [],
      };
    }
    return {
      reviewContactId,
      name: contact.name,
      role: contact.role,
      matchedContactId: "",
      resolutionStatus: "conflict",
      candidateContactIds: matchedContacts.map((item) => item.id),
    };
  });

  return {
    extraction: {
      ...extraction,
      contacts: resolvedContacts,
      nextActions: asArray(extraction?.nextActions).map((item) => ({
        ...item,
        relatedContactIds: buildDefaultNextActionRelatedContactIds(item.title, resolvedContacts),
      })),
    },
    warnings: resolvedContacts
      .filter((item) => item.resolutionStatus === "conflict")
      .map((item) => `联系人“${item.name}”命中多个同名关键联系人，提交前必须手动确认。`),
  };
}

function buildDefaultNextActionRelatedContactIds(title, contacts) {
  const normalizedTitle = asText(title);
  if (!normalizedTitle) {
    return [];
  }
  return uniqueStrings(
    asArray(contacts)
      .filter((item) => item?.name && normalizedTitle.includes(item.name))
      .map((item) => item.reviewContactId)
      .filter(Boolean),
  );
}

function resolveReviewedContactSelections({ project, reviewedContacts, touchedAt }) {
  const resolvedContacts = [];
  const resolutionByReviewId = new Map();
  const seenReviewContactIds = new Set();

  for (const reviewedContact of asArray(reviewedContacts)) {
    const reviewContactId = clipText(asString(reviewedContact.reviewContactId), 80);
    if (!reviewContactId) {
      throw createStatusError("reviewedSnapshot.extraction.contacts[].reviewContactId is required.");
    }
    if (seenReviewContactIds.has(reviewContactId)) {
      throw createStatusError(`Duplicate reviewed contact id: ${reviewContactId}.`);
    }
    seenReviewContactIds.add(reviewContactId);

    const matchedContactId = clipText(asString(reviewedContact.matchedContactId), 80);
    let finalContact;
    if (matchedContactId) {
      const existingContact = getContactById(matchedContactId);
      if (!existingContact) {
        throw createStatusError(`Selected contact not found: ${matchedContactId}. Please regenerate the preview.`);
      }
      if (existingContact.hospitalId !== project.hospitalId) {
        throw createStatusError(`Selected contact ${matchedContactId} does not belong to the current hospital.`);
      }
      finalContact = applyMatchedContactTouch({
        contact: existingContact,
        roleTitle: reviewedContact.role,
        touchedAt,
      });
    } else {
      if (reviewedContact.resolutionStatus === "conflict") {
        throw createStatusError(`联系人“${reviewedContact.name}”存在同名冲突，请先手动确认后再提交。`);
      }
      const exactMatchesNow = findHospitalContactsByExactName(project.hospitalId, reviewedContact.name);
      if (exactMatchesNow.length) {
        if (exactMatchesNow.length > 1 || reviewedContact.resolutionStatus === "conflict") {
          throw createStatusError(`联系人“${reviewedContact.name}”存在同名冲突，请重新生成纪要并手动确认。`);
        }
        throw createStatusError(`联系人“${reviewedContact.name}”的自动关联结果已变化，请重新生成纪要。`);
      }
      finalContact = createHospitalContactRecord({
        hospitalId: project.hospitalId,
        name: reviewedContact.name,
        roleTitle: reviewedContact.role,
        touchedAt,
      });
    }

    const resolvedItem = {
      reviewContactId,
      mentionName: reviewedContact.name,
      finalContact,
    };
    resolvedContacts.push(resolvedItem);
    resolutionByReviewId.set(reviewContactId, resolvedItem);
  }

  return {
    resolvedContacts,
    contactResolutionByReviewId: resolutionByReviewId,
  };
}

function resolveReviewedTaskRelatedContactIds({ rawRelatedContactIds, project, contactResolutionByReviewId }) {
  const resolved = [];
  for (const rawId of normalizeStringIdArray(rawRelatedContactIds)) {
    if (contactResolutionByReviewId instanceof Map && contactResolutionByReviewId.has(rawId)) {
      resolved.push(contactResolutionByReviewId.get(rawId).finalContact.id);
      continue;
    }
    const existingContact = getContactById(rawId);
    if (!existingContact) {
      throw createStatusError(`Task related contact not found: ${rawId}. Please regenerate the preview.`);
    }
    if (existingContact.hospitalId !== project.hospitalId) {
      throw createStatusError(`Task related contact ${rawId} does not belong to the current hospital.`);
    }
    resolved.push(existingContact.id);
  }
  return uniqueStrings(resolved);
}

function buildMentionMatchesFromResolvedContacts(resolvedContacts, extraContactIds = []) {
  const matches = [];
  for (const item of asArray(resolvedContacts)) {
    const contactId = clipText(asString(item?.finalContact?.id), 80);
    const mentionName = clipText(asString(item?.mentionName), 120);
    if (!contactId || !mentionName) {
      continue;
    }
    matches.push({
      contactId,
      matchText: mentionName,
      fallbackText: mentionName,
    });
  }
  for (const contactId of resolveExistingContactIds(extraContactIds)) {
    const contact = getContactById(contactId);
    if (!contact?.name) {
      continue;
    }
    matches.push({
      contactId: contact.id,
      matchText: contact.name,
      fallbackText: contact.name,
    });
  }
  return matches;
}

function applyMatchedContactTouch({ contact, roleTitle, touchedAt }) {
  contact.roleTitle = clipText(asString(roleTitle), 40) || contact.roleTitle || "";
  contact.lastContactAt = touchedAt || contact.lastContactAt || nowIso();
  return contact;
}

function createHospitalContactRecord({ hospitalId, name, roleTitle, touchedAt }) {
  const normalizedName = clipText(asString(name), 40);
  if (!normalizedName) {
    throw new Error("New contact name is required.");
  }
  const created = {
    id: createId("contact"),
    hospitalId,
    departmentId: null,
    name: normalizedName,
    roleTitle: clipText(asString(roleTitle), 40),
    lastContactAt: touchedAt || nowIso(),
  };
  store.contacts.push(created);
  return created;
}

function buildIntakeReviewContactId(index) {
  return `intake-contact-${index + 1}`;
}

function findHospitalContactsByExactName(hospitalId, name) {
  const normalizedName = asString(name).toLowerCase();
  if (!hospitalId || !normalizedName) {
    return [];
  }
  return store.contacts.filter(
    (item) => item.hospitalId === hospitalId && asString(item.name).toLowerCase() === normalizedName,
  );
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
  return buildFollowupContextForExtractionInModule({
    sessionId,
    buildFollowupHistory,
  });
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
    contacts: dedupeContactMentions(
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
      reviewContactId: clipText(asString(item.reviewContactId), 80),
      name: clipText(asString(item.name), 40),
      role: clipText(asString(item.role), 40),
      matchedContactId: clipText(asString(item.matchedContactId), 80),
      resolutionStatus: normalizeReviewedContactResolutionStatus(item.resolutionStatus),
      candidateContactIds: normalizeStringIdArray(item.candidateContactIds),
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
      relatedContactIds: normalizeStringIdArray(item.relatedContactIds),
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
    contacts: dedupeContactMentions(contacts).filter((item) => item.name && item.reviewContactId),
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

function listHospitalDepartmentNames(hospitalId) {
  const normalizedHospitalId = asString(hospitalId);
  if (!normalizedHospitalId) {
    return [];
  }

  const seen = new Set();
  const suggestions = [];
  for (const department of asArray(store.departments)) {
    if (asString(department?.hospitalId) !== normalizedHospitalId) {
      continue;
    }
    const name = clipText(asString(department?.name), 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    suggestions.push(name);
  }
  return suggestions;
}

function normalizeEditableContacts(rawContacts) {
  if (rawContacts.length > 100) {
    throw new Error("contacts cannot exceed 100 entries.");
  }

  const normalizedContacts = rawContacts.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`contacts[${index}] is invalid.`);
    }

    const id = clipText(asString(item.id), 80);
    const name = clipText(asString(item.name), 40);
    const roleTitle = clipText(asString(item.roleTitle || item.role), 40);
    if (!name) {
      throw new Error(`contacts[${index}].name is required.`);
    }

    return {
      id,
      name,
      roleTitle,
    };
  });
  validateDistinctEditableContacts(normalizedContacts, "contacts");
  return normalizedContacts;
}

function validateDistinctEditableContacts(contacts, pathLabel = "contacts") {
  const exactIdentitySeen = new Set();
  const duplicateNameBuckets = new Map();

  contacts.forEach((item, index) => {
    const nameKey = asString(item?.name).toLowerCase();
    const roleKey = asString(item?.roleTitle).toLowerCase();
    const identityKey = `${nameKey}::${roleKey}`;
    if (exactIdentitySeen.has(identityKey)) {
      throw new Error(
        `${pathLabel}[${index}] duplicates another contact with the same name and role.`,
      );
    }
    exactIdentitySeen.add(identityKey);
    if (!duplicateNameBuckets.has(nameKey)) {
      duplicateNameBuckets.set(nameKey, []);
    }
    duplicateNameBuckets.get(nameKey).push({
      index,
      roleTitle: asString(item?.roleTitle),
    });
  });

  for (const [nameKey, rows] of duplicateNameBuckets.entries()) {
    if (!nameKey || rows.length < 2) {
      continue;
    }
    for (const row of rows) {
      if (!row.roleTitle) {
        throw new Error(
          `${pathLabel}[${row.index}] must include roleTitle when the same hospital has duplicate contact names.`,
        );
      }
    }
  }
}

function dedupeRenderedContactEntries(rawEntries) {
  const deduped = [];
  const seen = new Set();
  for (const entry of normalizeStoredContactEntries(rawEntries)) {
    const key = entry.contactId || `${entry.name.toLowerCase()}::${entry.role.toLowerCase()}`;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

function normalizeEditableOriginalContacts(rawOriginalContacts) {
  if (rawOriginalContacts === undefined || rawOriginalContacts === null) {
    return [];
  }
  if (!Array.isArray(rawOriginalContacts)) {
    throw new Error("originalContacts must be an array.");
  }
  if (rawOriginalContacts.length > 200) {
    throw new Error("originalContacts cannot exceed 200 entries.");
  }
  return rawOriginalContacts
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`originalContacts[${index}] is invalid.`);
      }
      return {
        id: clipText(asString(item.id), 80),
        name: clipText(asString(item.name), 40),
        roleTitle: clipText(asString(item.roleTitle || item.role), 40),
      };
    })
    .filter((item) => item.id || item.name);
}

function normalizeEditableContactSnapshot(rawSnapshot, pathLabel) {
  if (!rawSnapshot || typeof rawSnapshot !== "object" || Array.isArray(rawSnapshot)) {
    if (rawSnapshot === undefined || rawSnapshot === null) {
      return {
        name: "",
        roleTitle: "",
      };
    }
    throw new Error(`${pathLabel} is invalid.`);
  }
  return {
    name: clipText(asString(rawSnapshot.name), 40),
    roleTitle: clipText(asString(rawSnapshot.roleTitle || rawSnapshot.role), 40),
  };
}

function normalizeEditableContactMergeActions(rawMergeActions) {
  if (rawMergeActions === undefined || rawMergeActions === null) {
    return [];
  }
  if (!Array.isArray(rawMergeActions)) {
    throw new Error("mergeActions must be an array.");
  }
  if (rawMergeActions.length > 200) {
    throw new Error("mergeActions cannot exceed 200 entries.");
  }
  return rawMergeActions.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`mergeActions[${index}] is invalid.`);
    }
    return {
      sourceContactId: clipText(asString(item.sourceContactId), 80),
      targetContactId: clipText(asString(item.targetContactId), 80),
      sourceSnapshot: normalizeEditableContactSnapshot(item.sourceSnapshot, `mergeActions[${index}].sourceSnapshot`),
      targetSnapshot: normalizeEditableContactSnapshot(item.targetSnapshot, `mergeActions[${index}].targetSnapshot`),
    };
  });
}

function validateEditableContactMergeActions({ mergeActions, contacts, originalContacts }) {
  const sourceIdSeen = new Set();
  const originalIds = new Set(
    originalContacts
      .map((item) => asString(item.id))
      .filter(Boolean),
  );
  const finalIds = new Set(
    contacts
      .map((item) => asString(item.id))
      .filter(Boolean),
  );

  mergeActions.forEach((action, index) => {
    const sourceContactId = asString(action.sourceContactId);
    const targetContactId = asString(action.targetContactId);
    const hasSourceSnapshotName = Boolean(asString(action.sourceSnapshot?.name));
    const hasTargetSnapshotName = Boolean(asString(action.targetSnapshot?.name));

    if (!sourceContactId && !targetContactId && !hasSourceSnapshotName && !hasTargetSnapshotName) {
      throw new Error(`mergeActions[${index}] is empty.`);
    }
    if (sourceContactId && sourceIdSeen.has(sourceContactId)) {
      throw new Error(`mergeActions[${index}].sourceContactId is duplicated.`);
    }
    if (sourceContactId) {
      sourceIdSeen.add(sourceContactId);
    }
    if (sourceContactId && targetContactId && sourceContactId === targetContactId) {
      throw new Error(`mergeActions[${index}] sourceContactId and targetContactId cannot be the same.`);
    }
    if (sourceContactId && !targetContactId) {
      throw new Error(`mergeActions[${index}].targetContactId is required when sourceContactId is provided.`);
    }
    if (targetContactId && !finalIds.has(targetContactId)) {
      throw new Error(`mergeActions[${index}].targetContactId does not exist in final contacts.`);
    }
    if (sourceContactId && originalIds.size && !originalIds.has(sourceContactId) && !sourceContactId.startsWith("draft-")) {
      throw new Error(`mergeActions[${index}].sourceContactId does not exist in originalContacts.`);
    }
  });
}

function replaceHospitalContacts({ hospitalId, contacts, touchedAt }) {
  const existingById = new Map();
  for (const contact of store.contacts) {
    if (contact.hospitalId !== hospitalId) {
      continue;
    }
    existingById.set(contact.id, contact);
  }

  const keepIds = new Set();
  const resolvedContacts = [];
  const resolvedTouchedAt = touchedAt || nowIso();
  for (const contactInput of contacts) {
    let existing = asString(contactInput.id) ? existingById.get(asString(contactInput.id)) : null;
    if (existing) {
      existing.name = contactInput.name;
      existing.roleTitle = contactInput.roleTitle;
      existing.departmentId = null;
      existing.lastContactAt = resolvedTouchedAt;
      keepIds.add(existing.id);
      resolvedContacts.push({
        id: existing.id,
        name: existing.name,
        roleTitle: existing.roleTitle || "",
      });
      continue;
    }

    const created = {
      id: createId("contact"),
      hospitalId,
      departmentId: null,
      name: contactInput.name,
      roleTitle: contactInput.roleTitle,
      lastContactAt: resolvedTouchedAt,
    };
    store.contacts.push(created);
    keepIds.add(created.id);
    resolvedContacts.push({
      id: created.id,
      name: created.name,
      roleTitle: created.roleTitle || "",
    });
  }

  store.contacts = store.contacts.filter((item) => item.hospitalId !== hospitalId || keepIds.has(item.id));
  return resolvedContacts;
}

function buildContactPropagationChanges({ originalContacts, contacts, mergeActions }) {
  const originalById = new Map();
  for (const item of originalContacts) {
    const id = asString(item.id);
    if (!id || originalById.has(id)) {
      continue;
    }
    originalById.set(id, {
      contactId: id,
      name: asString(item.name),
      roleTitle: asString(item.roleTitle),
    });
  }

  const finalById = new Map();
  for (const item of contacts) {
    const id = asString(item.id);
    if (!id || finalById.has(id)) {
      continue;
    }
    finalById.set(id, {
      contactId: id,
      name: asString(item.name),
      roleTitle: asString(item.roleTitle),
    });
  }

  const sourceToFinal = new Map();
  for (const sourceId of originalById.keys()) {
    const sameIdFinal = finalById.get(sourceId);
    if (sameIdFinal) {
      sourceToFinal.set(sourceId, sameIdFinal);
    }
  }
  for (const action of mergeActions) {
    const sourceId = asString(action.sourceContactId);
    const targetId = asString(action.targetContactId);
    if (!sourceId || !targetId) {
      continue;
    }
    const targetFinal = finalById.get(targetId);
    if (!targetFinal) {
      continue;
    }
    sourceToFinal.set(sourceId, targetFinal);
  }

  const changes = [];
  for (const [sourceContactId, toContact] of sourceToFinal.entries()) {
    const fromContact = originalById.get(sourceContactId);
    if (!fromContact || !toContact) {
      continue;
    }
    if (!toContact.contactId || sourceContactId === toContact.contactId) {
      continue;
    }
    changes.push({
      sourceContactId,
      from: fromContact,
      to: toContact,
    });
  }
  return changes;
}

function applyProjectContactPropagation({ project, originalContacts, contacts, mergeActions }) {
  const changes = buildContactPropagationChanges({
    originalContacts,
    contacts,
    mergeActions,
  });
  if (!changes.length) {
    return;
  }

  const changeBySourceId = new Map(changes.map((item) => [item.sourceContactId, item]));

  for (const update of store.updates) {
    if (update.projectId !== project.id) {
      continue;
    }
    if (Array.isArray(update.contactEntries)) {
      for (const entry of update.contactEntries) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          continue;
        }
        const entryContactId = asString(entry.contactId);
        const change = entryContactId ? changeBySourceId.get(entryContactId) || null : null;
        if (!change) {
          continue;
        }
        entry.contactId = change.to.contactId;
        entry.name = change.to.name;
        entry.role = change.to.roleTitle || "";
      }
      update.contactEntries = dedupeRenderedContactEntries(update.contactEntries);
    }

    update.feedbackSummarySegments = replaceStoredTextSegmentContactIds(update.feedbackSummarySegments, changeBySourceId);
    update.blockersSegments = replaceStoredTextSegmentContactIds(update.blockersSegments, changeBySourceId);
    update.opportunitiesSegments = replaceStoredTextSegmentContactIds(update.opportunitiesSegments, changeBySourceId);
    update.nextStepSegments = replaceStoredTextSegmentContactIds(update.nextStepSegments, changeBySourceId);
  }

  for (const task of store.tasks) {
    if (task.projectId !== project.id) {
      continue;
    }
    task.relatedContactIds = normalizeStringIdArray(
      normalizeStringIdArray(task.relatedContactIds).map((contactId) =>
        changeBySourceId.get(contactId)?.to?.contactId || contactId,
      ),
    );
    task.titleSegments = replaceStoredTextSegmentContactIds(task.titleSegments, changeBySourceId);
    task.descriptionSegments = replaceStoredTextSegmentContactIds(task.descriptionSegments, changeBySourceId);
  }

  project.latestSummarySegments = replaceStoredTextSegmentContactIds(project.latestSummarySegments, changeBySourceId);
  project.nextActionSegments = replaceStoredTextSegmentContactIds(project.nextActionSegments, changeBySourceId);
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
    const normalizedSeeded = normalizeStoreShape(seeded);
    writeFileSync(STORE_PATH, JSON.stringify(normalizedSeeded, null, 2), "utf8");
    return normalizedSeeded;
  }

  const rawStoreText = readFileSync(STORE_PATH, "utf8");
  const normalizedStore = normalizeStoreShape(JSON.parse(rawStoreText));
  const normalizedStoreText = JSON.stringify(normalizedStore, null, 2);
  if (normalizedStoreText !== rawStoreText) {
    writeFileSync(STORE_PATH, normalizedStoreText, "utf8");
  }
  return normalizedStore;
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

  const normalizedStore = {
    meta: input.meta || { version: "0.1.0", createdAt: nowIso(), updatedAt: nowIso() },
    currentUserId,
    regions,
    users: normalizedUsers,
    authSessions: normalizedAuthSessions,
    backupPolicy: normalizeBackupPolicy(input?.backupPolicy),
    hospitals: Array.isArray(input.hospitals) ? input.hospitals : [],
    departments: Array.isArray(input.departments) ? input.departments : [],
    contacts: normalizeStoredContacts(Array.isArray(input.contacts) ? input.contacts : []),
    stages: Array.isArray(input.stages) ? input.stages : [],
    issueTags: Array.isArray(input.issueTags) ? input.issueTags : [],
    projects: normalizeStoredProjects(Array.isArray(input.projects) ? input.projects : []),
    updates: normalizeStoredUpdates(Array.isArray(input.updates) ? input.updates : []),
    tasks: normalizeStoredTasks(Array.isArray(input.tasks) ? input.tasks : []),
    remarks: Array.isArray(input.remarks) ? input.remarks : [],
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    messages: Array.isArray(input.messages) ? input.messages : [],
  };
  migrateStoreContactReferences(normalizedStore);
  return normalizedStore;
}

function normalizeStoredContacts(records) {
  const usedIds = new Set();
  return asArray(records)
    .map((item) => {
      const normalized = {
        ...item,
        id: takeNormalizedRecordId(item?.id, usedIds, "contact"),
        hospitalId: clipText(asString(item?.hospitalId), 80),
        departmentId: clipText(asString(item?.departmentId), 80),
        name: clipText(asString(item?.name), 40),
        roleTitle: clipText(asString(item?.roleTitle || item?.role), 40),
        lastContactAt: asString(item?.lastContactAt) || nowIso(),
      };
      if (!normalized.hospitalId || !normalized.name) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeStoredProjects(records) {
  const usedIds = new Set();
  return asArray(records)
    .map((item) => {
      const normalized = {
        ...item,
        id: takeNormalizedRecordId(item?.id, usedIds, "project"),
        hospitalId: clipText(asString(item?.hospitalId), 80),
        regionId: clipText(asString(item?.regionId), 80),
        ownerUserId: clipText(asString(item?.ownerUserId), 80),
        currentStageId: clipText(asString(item?.currentStageId), 80),
        riskLevel: asString(item?.riskLevel) || "normal",
        managerAttentionNeeded: Boolean(item?.managerAttentionNeeded),
        lastFollowUpAt: asString(item?.lastFollowUpAt),
        nextAction: asText(item?.nextAction),
        nextActionDueAt: asString(item?.nextActionDueAt) || null,
        latestSummary: asText(item?.latestSummary),
        currentIssueTagIds: normalizeStringIdArray(item?.currentIssueTagIds),
        latestUpdateId: clipText(asString(item?.latestUpdateId), 80),
        initialDepartmentId: clipText(asString(item?.initialDepartmentId), 80),
        nextActionSegments: normalizeStoredTextSegments(item?.nextActionSegments, item?.nextAction),
        latestSummarySegments: normalizeStoredTextSegments(item?.latestSummarySegments, item?.latestSummary),
        contactReferenceWarnings: normalizeStoredReferenceWarnings(item?.contactReferenceWarnings),
      };
      if (!normalized.hospitalId) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeStoredUpdates(records) {
  const usedIds = new Set();
  return asArray(records)
    .map((item) => {
      const normalized = {
        ...item,
        id: takeNormalizedRecordId(item?.id, usedIds, "update"),
        projectId: clipText(asString(item?.projectId), 80),
        createdByUserId: clipText(asString(item?.createdByUserId), 80),
        sessionId: clipText(asString(item?.sessionId), 80),
        visitDate: normalizeDateOnly(item?.visitDate),
        departmentId: clipText(asString(item?.departmentId), 80),
        contactEntries: normalizeStoredContactEntries(item?.contactEntries),
        feedbackSummary: asText(item?.feedbackSummary),
        blockers: asText(item?.blockers),
        opportunities: asText(item?.opportunities),
        nextStep: asText(item?.nextStep),
        feedbackSummarySegments: normalizeStoredTextSegments(item?.feedbackSummarySegments, item?.feedbackSummary),
        blockersSegments: normalizeStoredTextSegments(item?.blockersSegments, item?.blockers),
        opportunitiesSegments: normalizeStoredTextSegments(item?.opportunitiesSegments, item?.opportunities),
        nextStepSegments: normalizeStoredTextSegments(item?.nextStepSegments, item?.nextStep),
        issueTagIds: normalizeStringIdArray(item?.issueTagIds),
        stageBeforeId: clipText(asString(item?.stageBeforeId), 80),
        stageAfterId: clipText(asString(item?.stageAfterId), 80),
        managerAttentionNeeded: Boolean(item?.managerAttentionNeeded),
        sourceNote: asText(item?.sourceNote),
        createdAt: asString(item?.createdAt) || nowIso(),
        contactReferenceWarnings: normalizeStoredReferenceWarnings(item?.contactReferenceWarnings),
      };
      if (!normalized.projectId) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeStoredTasks(records) {
  const usedIds = new Set();
  return asArray(records)
    .map((item) => {
      const dueAt = asString(item?.dueAt) || null;
      const normalized = {
        ...item,
        id: takeNormalizedRecordId(item?.id, usedIds, "task"),
        projectId: clipText(asString(item?.projectId), 80),
        updateId: clipText(asString(item?.updateId), 80),
        title: asText(item?.title),
        description: asText(item?.description),
        titleSegments: normalizeStoredTextSegments(item?.titleSegments, item?.title),
        descriptionSegments: normalizeStoredTextSegments(item?.descriptionSegments, item?.description),
        relatedContactIds: normalizeStringIdArray(item?.relatedContactIds),
        assigneeUserId: clipText(asString(item?.assigneeUserId), 80),
        dueAt,
        initialDueAt: asString(item?.initialDueAt) || dueAt,
        dueDateHistory: normalizeStoredTaskDueDateHistory(item?.dueDateHistory),
        records: normalizeStoredTaskRecords(item?.records),
        status: asString(item?.status) || "todo",
        priority: asString(item?.priority) || "medium",
        completedAt: asString(item?.completedAt) || null,
        createdAt: asString(item?.createdAt) || nowIso(),
        contactReferenceWarnings: normalizeStoredReferenceWarnings(item?.contactReferenceWarnings),
      };
      if (!normalized.projectId) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeStoredTaskDueDateHistory(records) {
  const usedIds = new Set();
  return asArray(records)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const normalized = {
        id: takeNormalizedRecordId(item?.id, usedIds, "task-due"),
        previousDueAt: asString(item?.previousDueAt) || null,
        nextDueAt: asString(item?.nextDueAt) || null,
        changedAt: asString(item?.changedAt) || nowIso(),
        changedByUserId: clipText(asString(item?.changedByUserId), 80),
      };
      if (!normalized.nextDueAt) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean)
    .sort((left, right) => compareIsoAsc(left.changedAt, right.changedAt));
}

function normalizeStoredTaskRecords(records) {
  const usedIds = new Set();
  return asArray(records)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const normalized = {
        id: takeNormalizedRecordId(item?.id, usedIds, "task-record"),
        content: clipText(asString(item?.content), 1000),
        createdAt: asString(item?.createdAt) || nowIso(),
        createdByUserId: clipText(asString(item?.createdByUserId), 80),
      };
      if (!normalized.content) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean)
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt));
}

function normalizeStoredContactEntries(rawEntries) {
  return asArray(rawEntries)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const normalized = {
        contactId: clipText(asString(item.contactId), 80),
        name: clipText(asString(item.name), 40),
        role: clipText(asString(item.role), 40),
      };
      if (!normalized.contactId && !normalized.name) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeStoredTextSegments(rawSegments, fallbackText = "") {
  if (!Array.isArray(rawSegments) || !rawSegments.length) {
    const text = asText(fallbackText);
    return text ? [{ type: "text", text }] : [];
  }

  const normalized = [];
  for (const item of rawSegments) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    if (item.type === "contact") {
      const contactId = clipText(asString(item.contactId), 80);
      const fallbackValue = clipText(asText(item.fallbackText || item.text || item.name), 120);
      if (!contactId && !fallbackValue) {
        continue;
      }
      normalized.push({
        type: "contact",
        contactId,
        fallbackText: fallbackValue,
      });
      continue;
    }

    const text = asText(item.text || item.value);
    if (!text) {
      continue;
    }
    normalized.push({ type: "text", text });
  }
  return coalesceStoredTextSegments(normalized);
}

function normalizeStoredReferenceWarnings(rawWarnings) {
  if (!Array.isArray(rawWarnings)) {
    return [];
  }
  const deduped = [];
  const seen = new Set();
  for (const item of rawWarnings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const normalized = {
      field: clipText(asString(item.field), 80),
      name: clipText(asString(item.name), 80),
      reason: clipText(asString(item.reason), 80) || "ambiguous-name",
      message: clipText(asText(item.message), 240),
    };
    if (!normalized.field || !normalized.name) {
      continue;
    }
    const key = `${normalized.field}::${normalized.name.toLowerCase()}::${normalized.reason}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
}

function takeNormalizedRecordId(rawId, usedIds, prefix) {
  let resolvedId = clipText(asString(rawId), 80) || createId(prefix);
  while (!resolvedId || usedIds.has(resolvedId)) {
    resolvedId = createId(prefix);
  }
  usedIds.add(resolvedId);
  return resolvedId;
}

function normalizeStringIdArray(rawValues) {
  return uniqueStrings(asArray(rawValues).map((item) => clipText(asString(item), 80)).filter(Boolean));
}

function coalesceStoredTextSegments(segments) {
  const normalized = [];
  for (const segment of asArray(segments)) {
    if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
      continue;
    }
    if (segment.type === "text") {
      const text = asText(segment.text);
      if (!text) {
        continue;
      }
      const previous = normalized[normalized.length - 1];
      if (previous?.type === "text") {
        previous.text += text;
      } else {
        normalized.push({ type: "text", text });
      }
      continue;
    }
    if (segment.type === "contact") {
      const contactId = clipText(asString(segment.contactId), 80);
      const fallbackText = clipText(asText(segment.fallbackText), 120);
      if (!contactId && !fallbackText) {
        continue;
      }
      normalized.push({
        type: "contact",
        contactId,
        fallbackText,
      });
    }
  }
  return normalized;
}

function migrateStoreContactReferences(targetStore) {
  const projectById = new Map(targetStore.projects.map((item) => [item.id, item]));
  const updatesByProjectId = new Map();
  const tasksByProjectId = new Map();
  const updatesById = new Map();

  for (const update of targetStore.updates) {
    update.contactEntries = normalizeStoredContactEntries(update.contactEntries);
    updatesById.set(update.id, update);
    if (!updatesByProjectId.has(update.projectId)) {
      updatesByProjectId.set(update.projectId, []);
    }
    updatesByProjectId.get(update.projectId).push(update);
  }

  for (const task of targetStore.tasks) {
    task.relatedContactIds = normalizeStringIdArray(task.relatedContactIds);
    if (!tasksByProjectId.has(task.projectId)) {
      tasksByProjectId.set(task.projectId, []);
    }
    tasksByProjectId.get(task.projectId).push(task);
  }

  for (const updates of updatesByProjectId.values()) {
    updates.sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
  }

  for (const update of targetStore.updates) {
    const project = projectById.get(update.projectId);
    const hospitalId = asString(project?.hospitalId);
    const preferredMentions = update.contactEntries.map((entry) => ({
      contactId: entry.contactId,
      matchText: entry.name,
    }));
    const warnings = [];
    warnings.push(
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: update,
        legacyField: "feedbackSummary",
        segmentField: "feedbackSummarySegments",
        hospitalId,
        preferredMentions,
      }),
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: update,
        legacyField: "blockers",
        segmentField: "blockersSegments",
        hospitalId,
        preferredMentions,
      }),
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: update,
        legacyField: "opportunities",
        segmentField: "opportunitiesSegments",
        hospitalId,
        preferredMentions,
      }),
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: update,
        legacyField: "nextStep",
        segmentField: "nextStepSegments",
        hospitalId,
        preferredMentions,
      }),
    );
    update.contactReferenceWarnings = mergeStoredReferenceWarnings(update.contactReferenceWarnings, warnings);
  }

  for (const task of targetStore.tasks) {
    const project = projectById.get(task.projectId);
    const hospitalId = asString(project?.hospitalId);
    const sourceUpdate = asString(task.updateId) ? updatesById.get(asString(task.updateId)) : null;
    const preferredMentions = sourceUpdate
      ? sourceUpdate.contactEntries.map((entry) => ({
          contactId: entry.contactId,
          matchText: entry.name,
        }))
      : [];
    const warnings = [];
    warnings.push(
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: task,
        legacyField: "title",
        segmentField: "titleSegments",
        hospitalId,
        preferredMentions,
      }),
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: task,
        legacyField: "description",
        segmentField: "descriptionSegments",
        hospitalId,
        preferredMentions,
      }),
    );
    const derivedRelatedContactIds = normalizeStringIdArray([
      ...task.relatedContactIds,
      ...extractContactIdsFromSegments(task.titleSegments),
      ...extractContactIdsFromSegments(task.descriptionSegments),
    ]);
    task.relatedContactIds = derivedRelatedContactIds;
    task.contactReferenceWarnings = mergeStoredReferenceWarnings(task.contactReferenceWarnings, warnings);
  }

  for (const project of targetStore.projects) {
    const projectUpdates = updatesByProjectId.get(project.id) || [];
    const projectTasks = tasksByProjectId.get(project.id) || [];
    const latestUpdate =
      (project.latestUpdateId && updatesById.get(project.latestUpdateId)) || projectUpdates[0] || null;
    const nextActionContactIds = normalizeStringIdArray(
      projectTasks.flatMap((task) => normalizeStringIdArray(task.relatedContactIds)),
    );
    const preferredSummaryMentions = latestUpdate
      ? latestUpdate.contactEntries.map((entry) => ({
          contactId: entry.contactId,
          matchText: entry.name,
        }))
      : [];
    const warnings = [];
    warnings.push(
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: project,
        legacyField: "latestSummary",
        segmentField: "latestSummarySegments",
        hospitalId: project.hospitalId,
        preferredMentions: preferredSummaryMentions,
      }),
      ...ensureStoredTextFieldReferences({
        targetStore,
        entity: project,
        legacyField: "nextAction",
        segmentField: "nextActionSegments",
        hospitalId: project.hospitalId,
        preferredMentions: nextActionContactIds.map((contactId) => ({
          contactId,
          matchText: getContactNameFromStore(targetStore, contactId),
        })),
      }),
    );
    project.contactReferenceWarnings = mergeStoredReferenceWarnings(project.contactReferenceWarnings, warnings);
  }
}

function ensureStoredTextFieldReferences({
  targetStore,
  entity,
  legacyField,
  segmentField,
  hospitalId,
  preferredMentions = [],
}) {
  const existingSegments = Array.isArray(entity?.[segmentField])
    ? normalizeStoredTextSegments(entity[segmentField], entity?.[legacyField])
    : null;
  const text = asText(entity?.[legacyField]) || renderStoredTextSegments(existingSegments, entity?.[legacyField]);
  const normalizedSegments = normalizeStoredTextSegments(existingSegments, text);
  const hasContactReferences = normalizedSegments.some(
    (segment) => segment.type === "contact" && asString(segment.contactId),
  );
  if (!text) {
    entity[segmentField] = normalizedSegments;
    return [];
  }
  if (hasContactReferences) {
    entity[segmentField] = normalizedSegments;
    return [];
  }

  const { matches, unresolvedNames } = buildMigrationMentionCandidates({
    targetStore,
    hospitalId,
    preferredMentions,
  });
  const built = buildTextSegmentsFromMentions({
    text,
    matches,
    unresolvedNames,
  });
  entity[segmentField] = built.segments;
  return built.warnings.map((warning) => ({
    field: legacyField,
    name: warning.name,
    reason: warning.reason,
  }));
}

function buildMigrationMentionCandidates({ targetStore, hospitalId, preferredMentions = [] }) {
  const hospitalContacts = asArray(targetStore?.contacts).filter((contact) => contact.hospitalId === hospitalId);
  const preferredByText = new Map();
  for (const mention of preferredMentions) {
    const contactId = clipText(asString(mention?.contactId), 80);
    const matchText = clipText(asString(mention?.matchText), 120);
    if (!contactId || !matchText) {
      continue;
    }
    const contact = hospitalContacts.find((item) => item.id === contactId);
    if (!contact) {
      continue;
    }
    const key = matchText.toLowerCase();
    if (!preferredByText.has(key)) {
      preferredByText.set(key, { matchText, contactIds: new Set(), fallbackText: matchText });
    }
    preferredByText.get(key).contactIds.add(contact.id);
  }

  const hospitalByName = new Map();
  for (const contact of hospitalContacts) {
    const name = clipText(asString(contact.name), 120);
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (!hospitalByName.has(key)) {
      hospitalByName.set(key, { matchText: name, contactIds: new Set() });
    }
    hospitalByName.get(key).contactIds.add(contact.id);
  }

  const matches = [];
  const unresolvedNames = [];

  for (const item of preferredByText.values()) {
    const contactIds = [...item.contactIds];
    if (contactIds.length === 1) {
      matches.push({
        contactId: contactIds[0],
        matchText: item.matchText,
        fallbackText: item.fallbackText || item.matchText,
      });
      continue;
    }
    unresolvedNames.push(item.matchText);
  }

  for (const [key, item] of hospitalByName.entries()) {
    if (preferredByText.has(key)) {
      continue;
    }
    const contactIds = [...item.contactIds];
    if (contactIds.length === 1) {
      matches.push({
        contactId: contactIds[0],
        matchText: item.matchText,
        fallbackText: item.matchText,
      });
      continue;
    }
    unresolvedNames.push(item.matchText);
  }

  return {
    matches,
    unresolvedNames: uniqueStrings(unresolvedNames),
  };
}

function buildTextSegmentsFromMentions({ text, matches = [], unresolvedNames = [] }) {
  const sourceText = asText(text);
  if (!sourceText) {
    return { segments: [], warnings: [] };
  }

  const uniqueMatches = [];
  const seenMatches = new Set();
  for (const item of asArray(matches)) {
    const contactId = clipText(asString(item?.contactId), 80);
    const matchText = clipText(asString(item?.matchText), 120);
    const fallbackText = clipText(asText(item?.fallbackText) || matchText, 120);
    if (!contactId || !matchText) {
      continue;
    }
    const key = `${contactId}::${matchText.toLowerCase()}`;
    if (seenMatches.has(key)) {
      continue;
    }
    seenMatches.add(key);
    uniqueMatches.push({
      contactId,
      matchText,
      fallbackText,
    });
  }

  const occurrences = [];
  for (const match of uniqueMatches) {
    let searchFrom = 0;
    while (searchFrom < sourceText.length) {
      const foundAt = sourceText.indexOf(match.matchText, searchFrom);
      if (foundAt < 0) {
        break;
      }
      occurrences.push({
        start: foundAt,
        end: foundAt + match.matchText.length,
        match,
      });
      searchFrom = foundAt + match.matchText.length;
    }
  }

  occurrences.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return right.match.matchText.length - left.match.matchText.length;
  });

  const segments = [];
  let cursor = 0;
  for (const occurrence of occurrences) {
    if (occurrence.start < cursor) {
      continue;
    }
    if (occurrence.start > cursor) {
      segments.push({
        type: "text",
        text: sourceText.slice(cursor, occurrence.start),
      });
    }
    segments.push({
      type: "contact",
      contactId: occurrence.match.contactId,
      fallbackText: occurrence.match.fallbackText,
    });
    cursor = occurrence.end;
  }

  if (cursor < sourceText.length) {
    segments.push({
      type: "text",
      text: sourceText.slice(cursor),
    });
  }

  const warnings = [];
  const seenWarnings = new Set();
  for (const unresolvedName of uniqueStrings(unresolvedNames)) {
    if (!unresolvedName || !sourceText.includes(unresolvedName)) {
      continue;
    }
    const key = unresolvedName.toLowerCase();
    if (seenWarnings.has(key)) {
      continue;
    }
    seenWarnings.add(key);
    warnings.push({
      name: unresolvedName,
      reason: "ambiguous-name",
    });
  }

  return {
    segments: coalesceStoredTextSegments(segments.length ? segments : [{ type: "text", text: sourceText }]),
    warnings,
  };
}

function mergeStoredReferenceWarnings(existingWarnings, nextWarnings) {
  return normalizeStoredReferenceWarnings([...(existingWarnings || []), ...(nextWarnings || [])]);
}

function extractContactIdsFromSegments(rawSegments) {
  return normalizeStringIdArray(
    normalizeStoredTextSegments(rawSegments).map((segment) =>
      segment.type === "contact" ? segment.contactId : "",
    ),
  );
}

function getContactNameFromStore(targetStore, contactId) {
  const normalizedContactId = clipText(asString(contactId), 80);
  if (!normalizedContactId) {
    return "";
  }
  return (
    asArray(targetStore?.contacts).find((item) => item.id === normalizedContactId)?.name || ""
  );
}

function normalizeUsers(users, regions) {
  const usedAccounts = new Set();
  const normalizedUsers = users.map((user, index) => normalizeUserRecord(user, index, usedAccounts));
  const normalizedWithBackup = ensureBackupAdminUser(normalizedUsers, usedAccounts, regions);
  applyNormalizedSupervisorAssignments(normalizedWithBackup);
  return normalizedWithBackup;
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
    supervisorUserId: clipText(asString(user?.supervisorUserId), 80),
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
      supervisorUserId: "",
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
  backupAdminUser.supervisorUserId = "";
  return users;
}

function applyNormalizedSupervisorAssignments(users) {
  const safeUsers = Array.isArray(users) ? users : [];
  for (const user of safeUsers) {
    user.supervisorUserId = resolveSupervisorAssignmentForUser({
      user,
      users: safeUsers,
      regionId: user.regionId,
      requestedSupervisorUserId: user.supervisorUserId,
      allowImplicitRegionAssignment: true,
    });
  }
}

function resolveSupervisorAssignmentForUser({
  user,
  users,
  regionId,
  requestedSupervisorUserId,
  allowImplicitRegionAssignment,
}) {
  const normalizedRole = normalizeUserRole(asString(user?.role));
  const normalizedRegionId = asString(regionId || user?.regionId);
  const normalizedRequestedSupervisorUserId =
    requestedSupervisorUserId === undefined ? asString(user?.supervisorUserId) : asString(requestedSupervisorUserId);

  if (normalizedRole !== "specialist") {
    if (normalizedRequestedSupervisorUserId) {
      throw new Error("Only specialists can be assigned to a supervisor.");
    }
    return "";
  }

  if (!normalizedRequestedSupervisorUserId) {
    if (!allowImplicitRegionAssignment) {
      return "";
    }
    return resolveImplicitSupervisorUserId({
      users,
      regionId: normalizedRegionId,
      excludeUserId: asString(user?.id),
    });
  }

  const supervisor = asArray(users).find((item) => asString(item?.id) === normalizedRequestedSupervisorUserId);
  if (!supervisor) {
    throw new Error("supervisorUserId is invalid.");
  }
  if (normalizeUserRole(supervisor.role) !== "supervisor") {
    throw new Error("supervisorUserId must belong to a supervisor.");
  }
  if (asString(supervisor.regionId) !== normalizedRegionId) {
    throw new Error("supervisorUserId must be in the same region as the specialist.");
  }
  return supervisor.id;
}

function resolveImplicitSupervisorUserId({ users, regionId, excludeUserId = "" }) {
  const supervisors = asArray(users).filter(
    (item) =>
      normalizeUserRole(item?.role) === "supervisor" &&
      asString(item?.regionId) === asString(regionId) &&
      asString(item?.id) !== asString(excludeUserId),
  );
  return supervisors.length === 1 ? asString(supervisors[0]?.id) : "";
}

function ensureSupervisorRegionChangeDoesNotBreakAssignments({ user, users, regionId }) {
  if (normalizeUserRole(asString(user?.role)) !== "supervisor") {
    return;
  }

  const normalizedRegionId = asString(regionId || user?.regionId);
  const mismatchedSpecialists = asArray(users).filter(
    (item) =>
      normalizeUserRole(item?.role) === "specialist" &&
      asString(item?.supervisorUserId) === asString(user?.id) &&
      asString(item?.regionId) !== normalizedRegionId,
  );
  if (mismatchedSpecialists.length) {
    throw new Error("Cannot move supervisor to a different region while assigned specialists remain in the old region.");
  }
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

function getContactById(id) {
  return store.contacts.find((item) => item.id === id);
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
  return businessClock.nowIso();
}

function todayDateOnly() {
  return businessClock.todayDateOnly();
}

function buildTaskDueAtFromDateOnly(dateOnly) {
  const normalized = normalizeDateOnly(dateOnly);
  return normalized ? `${normalized}T09:00:00.000Z` : null;
}

function ensureTaskDueDateHistory(task) {
  if (!Array.isArray(task.dueDateHistory)) {
    task.dueDateHistory = [];
  }
  return task.dueDateHistory;
}

function ensureTaskRecords(task) {
  if (!Array.isArray(task.records)) {
    task.records = [];
  }
  return task.records;
}

function calculateStalledDays(isoString) {
  if (!isoString) {
    return 999;
  }
  return Math.max(0, Math.floor((businessClock.nowMs() - new Date(isoString).getTime()) / 86400000));
}

function isDatePast(isoString) {
  return Boolean(isoString) && new Date(isoString).getTime() < businessClock.nowMs();
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

function normalizeBackupPolicy(policy) {
  return normalizeBackupPolicyWithDefaults(policy, {
    maxBackups: MAX_BACKUP_COUNT,
    dailyHour: DAILY_BACKUP_HOUR,
    dailyMinute: DAILY_BACKUP_MINUTE,
    defaultWeekday: DEFAULT_BACKUP_WEEKDAY,
  });
}

function createBusinessClock({ simulationMode: enabled, clockFile }) {
  const resolvedClockFile = enabled ? path.resolve(asString(clockFile).trim()) : "";
  const state = {
    lastEpochMs: null,
  };

  const resolveSnapshot = () => {
    if (!enabled) {
      const current = new Date();
      return {
        mode: "system",
        date: current,
        currentDate: current.toISOString().slice(0, 10),
      };
    }

    if (!resolvedClockFile) {
      throw new Error("SIMULATION_CLOCK_FILE is required when SIMULATION_MODE=true.");
    }
    if (!existsSync(resolvedClockFile)) {
      throw new Error(`Simulation clock file does not exist: ${resolvedClockFile}`);
    }

    let payload;
    try {
      payload = JSON.parse(readFileSync(resolvedClockFile, "utf8"));
    } catch (error) {
      throw new Error(
        `Failed to read simulation clock file ${resolvedClockFile}: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }

    const currentDate = normalizeDateOnly(payload?.currentDate);
    const currentDateTime = asString(payload?.currentDateTime).trim();
    if (!currentDate) {
      throw new Error(`Simulation clock file ${resolvedClockFile} is missing a valid currentDate.`);
    }
    if (!currentDateTime) {
      throw new Error(`Simulation clock file ${resolvedClockFile} is missing currentDateTime.`);
    }

    const date = new Date(currentDateTime);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Simulation clock file ${resolvedClockFile} has an invalid currentDateTime.`);
    }
    if (date.toISOString().slice(0, 10) !== currentDate) {
      throw new Error(
        `Simulation clock file ${resolvedClockFile} must keep currentDate and currentDateTime on the same day.`,
      );
    }
    if (state.lastEpochMs !== null && date.getTime() < state.lastEpochMs) {
      throw new Error(
        `Simulation clock file ${resolvedClockFile} moved backwards from ${new Date(state.lastEpochMs).toISOString()} to ${date.toISOString()}.`,
      );
    }

    state.lastEpochMs = date.getTime();
    return {
      mode: "simulation",
      date,
      currentDate,
    };
  };

  return {
    assertReady() {
      resolveSnapshot();
    },
    nowIso() {
      return resolveSnapshot().date.toISOString();
    },
    nowMs() {
      return resolveSnapshot().date.getTime();
    },
    todayDateOnly() {
      return resolveSnapshot().currentDate;
    },
    describe() {
      const snapshot = resolveSnapshot();
      return {
        enabled,
        mode: snapshot.mode,
        clockFile: enabled ? resolvedClockFile : null,
        currentDate: snapshot.currentDate,
        currentDateTime: snapshot.date.toISOString(),
      };
    },
  };
}

function normalizeBackupScheduleInput(input) {
  return normalizeBackupScheduleInputWithDefaults(input, {
    defaultWeekday: DEFAULT_BACKUP_WEEKDAY,
  });
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

function asText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isTruthyEnvValue(value) {
  const normalized = asString(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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

function dedupeContactMentions(items) {
  const seen = new Set();
  return asArray(items).filter((item) => {
    const reviewContactId = clipText(asString(item?.reviewContactId), 80);
    const nameKey = asString(item?.name).toLowerCase();
    const roleKey = asString(item?.role).toLowerCase();
    const matchedContactId = clipText(asString(item?.matchedContactId), 80);
    const key = reviewContactId || `${nameKey}::${roleKey}::${matchedContactId}`;
    if (!nameKey || !key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeReviewedContactResolutionStatus(rawStatus) {
  const normalized = asString(rawStatus);
  if (normalized === "matched" || normalized === "new" || normalized === "conflict") {
    return normalized;
  }
  return "new";
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
