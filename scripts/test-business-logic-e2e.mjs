import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const storePath = path.join(projectRoot, "data", "store.json");
const backupsDir = path.join(projectRoot, "data", "backups");
const runId = `${Date.now()}`;
const outputRoot = path.join(projectRoot, "output", "playwright", `business-logic-e2e-${runId}`);
const logsDir = path.join(outputRoot, "logs");
const progressPath = path.join(outputRoot, "progress.log");
const originalStoreBackupPath = path.join(outputRoot, "original-store.json");
const originalBackupsSnapshotDir = path.join(outputRoot, "original-backups");

function fail(message) {
  throw new Error(String(message || "Unknown error."));
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function logStep(message) {
  ensureDir(path.dirname(progressPath));
  fs.appendFileSync(progressPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing prerequisite file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeAccount(value) {
  return String(value || "").trim().toLowerCase();
}

function snapshotDirectory(sourceDir, snapshotDir) {
  if (!fs.existsSync(sourceDir)) {
    return false;
  }
  fs.rmSync(snapshotDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, snapshotDir, { recursive: true });
  return true;
}

function restoreDirectory(snapshotDir, targetDir, hadOriginal) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  if (hadOriginal) {
    fs.cpSync(snapshotDir, targetDir, { recursive: true });
    return;
  }
  ensureDir(targetDir);
}

function clearDirectory(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 40000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Server is still booting.
    }
    await delay(250);
  }
  fail(`Timed out waiting for ${baseUrl}/api/health.`);
}

function startServer(port, responsesBaseUrl) {
  ensureDir(logsDir);
  const stdoutPath = path.join(logsDir, "app.out.log");
  const stderrPath = path.join(logsDir, "app.err.log");
  const stdout = fs.createWriteStream(stdoutPath, { flags: "a" });
  const stderr = fs.createWriteStream(stderrPath, { flags: "a" });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      RESPONSES_BASE_URL: responsesBaseUrl,
      RESPONSES_MODEL: "fake-gpt-5.4",
      RESPONSES_TIMEOUT_MS: "15000",
      OPENAI_API_KEY: "fake-test-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  return {
    child,
    stdoutPath,
    stderrPath,
  };
}

async function stopServer(serverHandle) {
  if (!serverHandle?.child || serverHandle.child.exitCode !== null) {
    return;
  }
  serverHandle.child.kill();
  await Promise.race([
    new Promise((resolve) => serverHandle.child.once("exit", resolve)),
    delay(2000),
  ]);
  if (serverHandle.child.exitCode === null) {
    if (process.platform === "win32") {
      await new Promise((resolve) => {
        const killer = spawn("taskkill", ["/PID", String(serverHandle.child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.once("exit", () => resolve());
        killer.once("error", () => resolve());
      });
    } else {
      serverHandle.child.kill("SIGKILL");
    }
    await Promise.race([
      new Promise((resolve) => serverHandle.child.once("exit", resolve)),
      delay(3000),
    ]);
  }
}

function createFakeResponsesServer(config) {
  const requestLog = [];
  const counters = {
    followup: 0,
    intake: 0,
  };
  const sockets = new Set();

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/responses") {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    const bodyChunks = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.concat(bodyChunks).toString("utf8"));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` }));
      return;
    }

    const schemaName = String(payload?.text?.format?.name || "").trim();
    const prompt = String(payload?.input?.[0]?.content?.[0]?.text || "").trim();
    requestLog.push({
      schemaName,
      prompt,
      requestedAt: new Date().toISOString(),
    });

    let structuredOutput;
    if (schemaName === "followup_questions") {
      counters.followup += 1;
      structuredOutput = {
        questions: [
          {
            question: `What is the blocker owner for round ${counters.followup}?`,
            intent: "confirm owner",
          },
        ],
      };
    } else if (schemaName === "intake_extraction") {
      counters.intake += 1;
      structuredOutput = {
        contacts: [
          {
            name: config.contactName,
            role: config.contactRole,
          },
        ],
        feedback_summary: `Round ${counters.intake} confirmed pilot scope, owner, and training window.`,
        blockers: "Procurement sign-off is still pending.",
        opportunities: "If sign-off lands this week, the pilot can start next week.",
        issues: [config.issueName],
        next_actions: [
          {
            title: `${config.contactName} training schedule review`,
            assignee_name: config.specialistName,
            due_date: config.firstTaskDueDate,
          },
          {
            title: "Prepare hospital launch materials",
            assignee_name: config.specialistName,
            due_date: config.secondTaskDueDate,
          },
        ],
        stage_after_update: config.stageName,
        manager_attention_needed: true,
        next_step: "Lock the pilot schedule and procurement owner.",
      };
    } else {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: `Unsupported schemaName: ${schemaName || "(empty)"}` }));
      return;
    }

    const text = JSON.stringify(structuredOutput);
    const splitIndex = Math.max(1, Math.floor(text.length / 2));
    const firstChunk = text.slice(0, splitIndex);
    const secondChunk = text.slice(splitIndex);

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: firstChunk })}\n\n`);
    if (secondChunk) {
      res.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: secondChunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: "response.output_text.done", text })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: "response.completed", response: { error: null } })}\n\n`);
    res.end();
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  return {
    requestLog,
    async listen(port) {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      });
    },
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function requestJson({
  baseUrl,
  pathname,
  method = "GET",
  token = "",
  body,
  expectedStatuses = [200],
}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const rawText = await response.text();
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      fail(
        `Expected JSON from ${method} ${pathname}, received: ${rawText.slice(0, 300)}. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const suffix = payload?.error ? ` ${payload.error}` : rawText ? ` ${rawText}` : "";
    fail(`Unexpected HTTP ${response.status} from ${method} ${pathname}.${suffix}`);
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

function buildScenario(project) {
  return {
    projectId: project.id,
    currentStageId: project.stage?.id || "",
    currentStageName: project.stage?.name || "",
    activeTab: "entry",
    templateId: "business-logic-e2e",
    recordedAt: new Date().toISOString(),
  };
}

function buildReviewState(extraction) {
  const contacts = Array.isArray(extraction?.contacts) ? extraction.contacts : [];
  const nextActions = Array.isArray(extraction?.nextActions) ? extraction.nextActions : [];
  return {
    nextStep: {
      cancelled: false,
    },
    contacts: contacts.map((item, index) => ({
      itemId: String(item?.reviewContactId || `intake-contact-${index + 1}`),
      selectedContactId: String(item?.matchedContactId || "").trim(),
    })),
    nextActions: nextActions.map((item, index) => ({
      cancelled: false,
      itemId: `next-action-${index}`,
      relatedContactIds: Array.isArray(item?.relatedContactIds)
        ? [...new Set(item.relatedContactIds.map((entry) => String(entry || "").trim()).filter(Boolean))]
        : [],
    })),
  };
}

function prepareStore(rawStore) {
  const store = structuredClone(rawStore);
  store.currentUserId = "";
  store.authSessions = [];
  store.users = (Array.isArray(store.users) ? store.users : []).filter(
    (user) => normalizeAccount(user?.account) !== "backup-admin",
  );
  return store;
}

function findRoleByCode(options, code) {
  return (options?.roles || []).find((item) => item.code === code);
}

function findRegionById(options, id) {
  return (options?.regions || []).find((item) => item.id === id);
}

async function registerUser(baseUrl, spec) {
  const result = await requestJson({
    baseUrl,
    pathname: "/api/auth/register",
    method: "POST",
    body: {
      name: spec.name,
      account: spec.account,
      password: spec.password,
      role: spec.role,
      regionId: spec.regionId,
    },
  });
  assert(result.payload?.token, `Registration did not return a token for ${spec.account}.`);
  assert(result.payload?.user?.id, `Registration did not return a user for ${spec.account}.`);
  return result.payload;
}

async function loginUser(baseUrl, account, password) {
  const result = await requestJson({
    baseUrl,
    pathname: "/api/auth/login",
    method: "POST",
    body: {
      account,
      password,
    },
  });
  assert(result.payload?.token, `Login did not return a token for ${account}.`);
  return result.payload;
}

async function main() {
  const runStartedAtMs = Date.now();
  const runStartedAt = new Date(runStartedAtMs).toISOString();
  ensureDir(outputRoot);
  ensureDir(logsDir);
  logStep("start");

  const originalStoreText = fs.readFileSync(storePath, "utf8");
  fs.writeFileSync(originalStoreBackupPath, originalStoreText, "utf8");
  const hadOriginalBackups = snapshotDirectory(backupsDir, originalBackupsSnapshotDir);

  let appServer = null;
  let fakeResponses = null;
  let summary = null;

  try {
    const rawStore = JSON.parse(originalStoreText);
    const preparedStore = prepareStore(rawStore);
    writeJson(storePath, preparedStore);
    clearDirectory(backupsDir);
    logStep("store and backups prepared");

    const availableStage = Array.isArray(preparedStore.stages) ? preparedStore.stages[1] || preparedStore.stages[0] : null;
    const availableIssue = Array.isArray(preparedStore.issueTags) ? preparedStore.issueTags[0] : null;
    assert(availableStage?.name, "Missing prerequisite stage for intake extraction.");
    assert(availableIssue?.name, "Missing prerequisite issue tag for intake extraction.");

    const appPort = await getFreePort();
    const fakePort = await getFreePort();
    const baseUrl = `http://127.0.0.1:${appPort}`;
    const responsesBaseUrl = `http://127.0.0.1:${fakePort}/v1`;
    const password = `E2EFlow!${runId}`;
    const eastRegionId = "region-east";

    fakeResponses = createFakeResponsesServer({
      contactName: `Flow Contact ${runId}`,
      contactRole: "Pilot owner",
      issueName: availableIssue.name,
      stageName: availableStage.name,
      specialistName: `E2E Specialist ${runId}`,
      firstTaskDueDate: "2026-04-20",
      secondTaskDueDate: "2026-04-22",
    });
    await fakeResponses.listen(fakePort);
    logStep(`fake responses ready ${responsesBaseUrl}`);

    appServer = startServer(appPort, responsesBaseUrl);
    const health = await waitForHealth(baseUrl);
    assert(health?.ok === true, "Health check did not return ok=true.");
    assert(health?.configured === true, "Health check reported configured=false.");
    logStep("app server ready");

    const authOptions = await requestJson({
      baseUrl,
      pathname: "/api/auth/options",
    });
    assert(findRoleByCode(authOptions.payload, "manager"), "Missing manager role in auth options.");
    assert(findRoleByCode(authOptions.payload, "supervisor"), "Missing supervisor role in auth options.");
    assert(findRoleByCode(authOptions.payload, "specialist"), "Missing specialist role in auth options.");
    assert(findRegionById(authOptions.payload, eastRegionId), "Missing region-east in auth options.");
    logStep("auth options verified");

    const accounts = {
      manager: {
        account: `biz-mgr-${runId}`,
        name: `E2E Manager ${runId}`,
        password,
        role: "manager",
        regionId: eastRegionId,
      },
      supervisor: {
        account: `biz-sup-${runId}`,
        name: `E2E Supervisor ${runId}`,
        password,
        role: "supervisor",
        regionId: eastRegionId,
      },
      specialist: {
        account: `biz-sp-${runId}`,
        name: `E2E Specialist ${runId}`,
        password,
        role: "specialist",
        regionId: eastRegionId,
      },
    };

    const managerRegistration = await registerUser(baseUrl, accounts.manager);
    const supervisorRegistration = await registerUser(baseUrl, accounts.supervisor);
    const specialistRegistration = await registerUser(baseUrl, accounts.specialist);
    logStep("test users registered");

    await requestJson({
      baseUrl,
      pathname: "/api/backups",
      token: specialistRegistration.token,
      expectedStatuses: [403],
    });
    await requestJson({
      baseUrl,
      pathname: `/api/users/${encodeURIComponent(supervisorRegistration.user.id)}`,
      method: "PATCH",
      token: specialistRegistration.token,
      body: {
        regionId: eastRegionId,
        supervisorUserId: "",
      },
      expectedStatuses: [403],
    });
    logStep("permission checks verified");

    const managerUserUpdate = await requestJson({
      baseUrl,
      pathname: `/api/users/${encodeURIComponent(specialistRegistration.user.id)}`,
      method: "PATCH",
      token: managerRegistration.token,
      body: {
        regionId: eastRegionId,
        supervisorUserId: supervisorRegistration.user.id,
      },
    });
    assert(
      managerUserUpdate.payload?.user?.supervisorUserId === supervisorRegistration.user.id,
      "Manager user update did not persist the specialist supervisor assignment.",
    );
    logStep("manager user update verified");

    await requestJson({
      baseUrl,
      pathname: "/api/auth/logout",
      method: "POST",
      token: managerRegistration.token,
    });
    await requestJson({
      baseUrl,
      pathname: "/api/bootstrap",
      token: managerRegistration.token,
      expectedStatuses: [401],
    });
    const managerLogin = await loginUser(baseUrl, accounts.manager.account, accounts.manager.password);
    logStep("logout and re-login verified");

    const projectCreation = await requestJson({
      baseUrl,
      pathname: "/api/projects",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        hospitalName: `Business Flow Hospital ${runId}`,
        city: "Shanghai",
        departmentName: "Pain Center",
      },
    });
    const project = projectCreation.payload?.project;
    assert(project?.id, "Project creation did not return a project.");
    logStep(`project created ${project.id}`);

    const supervisorBootstrap = await requestJson({
      baseUrl,
      pathname: "/api/bootstrap",
      token: supervisorRegistration.token,
    });
    assert(
      (supervisorBootstrap.payload?.projects || []).some((item) => item.id === project.id),
      "Supervisor bootstrap did not include the specialist project.",
    );
    logStep("supervisor visibility verified");

    const singleFollowup = await requestJson({
      baseUrl,
      pathname: "/api/followups/question",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        projectId: project.id,
        note: "Pilot note for single follow-up generation.",
        visitDate: "2026-04-15",
        scenario: buildScenario(project),
      },
    });
    const singleSessionId = singleFollowup.payload?.sessionId;
    const singleQuestionId = singleFollowup.payload?.question?.id;
    assert(singleSessionId, "Single follow-up generation did not return sessionId.");
    assert(singleQuestionId, "Single follow-up generation did not return question id.");
    logStep(`single follow-up generated ${singleSessionId}`);

    const singleAnswer = await requestJson({
      baseUrl,
      pathname: "/api/followups/answer",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        sessionId: singleSessionId,
        questionMessageId: singleQuestionId,
        answer: "The procurement owner is the hospital operations lead.",
        scenario: buildScenario(project),
      },
    });
    assert(
      (singleAnswer.payload?.history || []).some((item) => item.id === singleQuestionId && item.answer?.content),
      "Single follow-up answer did not appear in history.",
    );
    logStep("single follow-up answer verified");

    const batchFollowup = await requestJson({
      baseUrl,
      pathname: "/api/followups/questions",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        projectId: project.id,
        note: "Pilot note for batch follow-up generation.",
        visitDate: "2026-04-15",
        historySessionId: singleSessionId,
        scenario: buildScenario(project),
      },
    });
    const batchSessionId = batchFollowup.payload?.sessionId;
    const batchQuestions = Array.isArray(batchFollowup.payload?.questions) ? batchFollowup.payload.questions : [];
    assert(batchSessionId, "Batch follow-up generation did not return sessionId.");
    assert(batchQuestions.length === 1, `Expected 1 batch follow-up question, got ${batchQuestions.length}.`);
    logStep(`batch follow-up generated ${batchSessionId}`);

    const batchAnswer = await requestJson({
      baseUrl,
      pathname: "/api/followups/answers",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        sessionId: batchSessionId,
        answers: [
          {
            questionMessageId: batchQuestions[0].id,
            answer: "The training window is confirmed for next Tuesday.",
          },
        ],
        scenario: buildScenario(project),
      },
    });
    assert(
      (batchAnswer.payload?.history || []).some((item) => item.id === batchQuestions[0].id && item.answer?.content),
      "Batch follow-up answer did not appear in history.",
    );
    logStep("batch follow-up answer verified");

    const historyBeforeSubmit = await requestJson({
      baseUrl,
      pathname: `/api/followups/history?projectId=${encodeURIComponent(project.id)}&limit=50`,
      token: specialistRegistration.token,
    });
    assert(
      (historyBeforeSubmit.payload?.sessions || []).some((session) => session.sessionId === singleSessionId),
      "Follow-up history did not include the single session.",
    );
    assert(
      (historyBeforeSubmit.payload?.sessions || []).some((session) => session.sessionId === batchSessionId),
      "Follow-up history did not include the batch session.",
    );
    logStep("follow-up history verified");

    const linkedRemark = await requestJson({
      baseUrl,
      pathname: `/api/projects/${encodeURIComponent(project.id)}/remarks`,
      method: "POST",
      token: supervisorRegistration.token,
      body: {
        content: "Please keep the owner alignment visible in the next summary.",
        toUserId: specialistRegistration.user.id,
        historySessionId: singleSessionId,
        historyQuestionId: singleQuestionId,
      },
    });
    const remarkId = linkedRemark.payload?.remark?.id;
    assert(remarkId, "Linked remark creation did not return a remark id.");
    assert(
      linkedRemark.payload?.remark?.historySessionId === singleSessionId,
      "Linked remark did not retain historySessionId.",
    );
    logStep(`remark created ${remarkId}`);

    const readRemark = await requestJson({
      baseUrl,
      pathname: `/api/project-remarks/${encodeURIComponent(remarkId)}/read`,
      method: "POST",
      token: specialistRegistration.token,
    });
    assert(readRemark.payload?.remark?.isRead === true, "Remark was not marked as read.");

    const repliedRemark = await requestJson({
      baseUrl,
      pathname: `/api/project-remarks/${encodeURIComponent(remarkId)}/reply`,
      method: "POST",
      token: specialistRegistration.token,
      body: {
        reply: "The owner alignment is already captured and will be carried into the summary.",
      },
    });
    assert(
      repliedRemark.payload?.remark?.replyContent,
      "Remark reply did not return replyContent.",
    );
    logStep("remark read and reply verified");

    const intakePreview = await requestJson({
      baseUrl,
      pathname: "/api/intake/preview",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        projectId: project.id,
        note: "Visited the pilot team and aligned the owner, training, and procurement timing.",
        visitDate: "2026-04-15",
        departmentName: "Pain Center",
        followupSessionId: singleSessionId,
      },
    });
    assert(
      intakePreview.payload?.extractionSource === "responses-api",
      `Unexpected intake preview source: ${intakePreview.payload?.extractionSource || "(empty)"}.`,
    );
    assert(
      Array.isArray(intakePreview.payload?.extraction?.nextActions) &&
        intakePreview.payload.extraction.nextActions.length === 2,
      "Intake preview did not return the expected nextActions.",
    );
    logStep("intake preview verified");

    const reviewedSnapshot = {
      extraction: intakePreview.payload.extraction,
      reviewState: buildReviewState(intakePreview.payload.extraction),
    };

    const intakeCommit = await requestJson({
      baseUrl,
      pathname: "/api/intake",
      method: "POST",
      token: specialistRegistration.token,
      body: {
        projectId: project.id,
        note: "Visited the pilot team and aligned the owner, training, and procurement timing.",
        visitDate: "2026-04-15",
        departmentName: "Pain Center",
        followupSessionId: singleSessionId,
        reviewedSnapshot,
        submitScenario: buildScenario(project),
      },
    });
    const createdTasks = Array.isArray(intakeCommit.payload?.createdTasks) ? intakeCommit.payload.createdTasks : [];
    assert(createdTasks.length === 2, `Expected 2 created tasks from intake, got ${createdTasks.length}.`);
    assert(intakeCommit.payload?.update?.id, "Intake commit did not return the created update.");
    logStep("intake commit verified");

    const firstTaskId = createdTasks[0]?.id;
    assert(firstTaskId, "Missing first task id after intake commit.");

    const taskDueDateUpdate = await requestJson({
      baseUrl,
      pathname: `/api/tasks/${encodeURIComponent(firstTaskId)}`,
      method: "PATCH",
      token: specialistRegistration.token,
      body: {
        dueDate: "2026-04-25",
      },
    });
    assert(
      taskDueDateUpdate.payload?.task?.dueAt?.startsWith("2026-04-25"),
      `Task due date update did not persist correctly: ${taskDueDateUpdate.payload?.task?.dueAt || "(empty)"}.`,
    );
    assert(
      Array.isArray(taskDueDateUpdate.payload?.task?.dueDateHistory) &&
        taskDueDateUpdate.payload.task.dueDateHistory.length >= 1,
      "Task due date update did not append dueDateHistory.",
    );

    const taskStatusUpdate = await requestJson({
      baseUrl,
      pathname: `/api/tasks/${encodeURIComponent(firstTaskId)}`,
      method: "PATCH",
      token: specialistRegistration.token,
      body: {
        taskStatus: "completed",
      },
    });
    assert(
      taskStatusUpdate.payload?.task?.status === "completed",
      "Task status update did not persist completed status.",
    );
    assert(taskStatusUpdate.payload?.task?.completedAt, "Task completion did not set completedAt.");

    const taskRecord = await requestJson({
      baseUrl,
      pathname: `/api/tasks/${encodeURIComponent(firstTaskId)}/records`,
      method: "POST",
      token: specialistRegistration.token,
      body: {
        content: "Confirmed the training window and the procurement owner in the meeting notes.",
      },
    });
    assert(
      taskRecord.payload?.task?.recordCount === 1,
      `Task record count mismatch after recording progress: ${taskRecord.payload?.task?.recordCount || 0}.`,
    );
    assert(
      Array.isArray(taskRecord.payload?.task?.records) &&
        taskRecord.payload.task.records.some(
          (item) => item.content === "Confirmed the training window and the procurement owner in the meeting notes.",
        ),
      "Task record content was not persisted.",
    );
    logStep("task update and task record verified");

    const historyAfterSubmit = await requestJson({
      baseUrl,
      pathname: `/api/followups/history?projectId=${encodeURIComponent(project.id)}&limit=50`,
      token: specialistRegistration.token,
    });
    const submittedSession = (historyAfterSubmit.payload?.sessions || []).find((item) => item.sessionId === singleSessionId);
    assert(submittedSession?.closedAt, "Submitting intake did not close the linked follow-up session.");
    assert(
      submittedSession?.linkedIntakeSessionId,
      "Submitting intake did not link the follow-up session to an intake session.",
    );
    logStep("follow-up session close-on-submit verified");

    await requestJson({
      baseUrl,
      pathname: "/api/backups",
      token: managerLogin.token,
      expectedStatuses: [403],
    });

    const backupAdminLogin = await loginUser(baseUrl, "backup-admin", "123456");
    const backupsBefore = await requestJson({
      baseUrl,
      pathname: "/api/backups",
      token: backupAdminLogin.token,
    });
    const baselineBackupCount = Array.isArray(backupsBefore.payload?.backups) ? backupsBefore.payload.backups.length : 0;

    const weeklySchedule = await requestJson({
      baseUrl,
      pathname: "/api/backups/schedule",
      method: "PATCH",
      token: backupAdminLogin.token,
      body: {
        frequency: "weekly",
        hour: 6,
        minute: 15,
        weekday: 2,
      },
    });
    assert(
      weeklySchedule.payload?.policy?.schedule?.frequency === "weekly",
      "Backup weekly schedule update did not persist.",
    );

    const manualBackup = await requestJson({
      baseUrl,
      pathname: "/api/backups/create",
      method: "POST",
      token: backupAdminLogin.token,
      body: {},
    });
    const createdBackupCount = Array.isArray(manualBackup.payload?.backups) ? manualBackup.payload.backups.length : 0;
    assert(
      createdBackupCount === baselineBackupCount + 1,
      `Backup create did not increase backup count. Before=${baselineBackupCount} After=${createdBackupCount}.`,
    );
    const backupDate = manualBackup.payload?.backups?.[0]?.date;
    assert(backupDate, "Backup create did not return a backup date.");

    const dailySchedule = await requestJson({
      baseUrl,
      pathname: "/api/backups/schedule",
      method: "PATCH",
      token: backupAdminLogin.token,
      body: {
        frequency: "daily",
        hour: 5,
        minute: 30,
      },
    });
    assert(
      dailySchedule.payload?.policy?.schedule?.frequency === "daily",
      "Backup daily schedule update did not persist.",
    );

    const restoreBackup = await requestJson({
      baseUrl,
      pathname: "/api/backups/restore",
      method: "POST",
      token: backupAdminLogin.token,
      body: {
        backupDate,
      },
    });
    assert(restoreBackup.payload?.forcedLogout === true, "Backup restore did not return forcedLogout=true.");

    await requestJson({
      baseUrl,
      pathname: "/api/backups",
      token: backupAdminLogin.token,
      expectedStatuses: [401],
    });

    const backupAdminRelogin = await loginUser(baseUrl, "backup-admin", "123456");
    const backupsAfterRestore = await requestJson({
      baseUrl,
      pathname: "/api/backups",
      token: backupAdminRelogin.token,
    });
    assert(
      backupsAfterRestore.payload?.policy?.schedule?.frequency === "weekly",
      "Backup restore did not restore the saved backup policy.",
    );
    logStep("backup flows verified");

    const schemaCounts = fakeResponses.requestLog.reduce((accumulator, entry) => {
      const key = entry.schemaName || "(empty)";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
    assert(schemaCounts.followup_questions === 2, `Expected 2 followup_questions upstream calls, got ${schemaCounts.followup_questions || 0}.`);
    assert(schemaCounts.intake_extraction === 1, `Expected 1 intake_extraction upstream call, got ${schemaCounts.intake_extraction || 0}.`);

    summary = {
      ok: true,
      runId,
      baseUrl,
      responsesBaseUrl,
      coveredRoutes: [
        "GET /api/health",
        "GET /api/auth/options",
        "POST /api/auth/register",
        "POST /api/auth/login",
        "POST /api/auth/logout",
        "GET /api/bootstrap",
        "PATCH /api/users/:userId",
        "POST /api/projects",
        "POST /api/followups/question",
        "POST /api/followups/questions",
        "GET /api/followups/history",
        "POST /api/followups/answer",
        "POST /api/followups/answers",
        "POST /api/projects/:projectId/remarks",
        "POST /api/project-remarks/:remarkId/read",
        "POST /api/project-remarks/:remarkId/reply",
        "POST /api/intake/preview",
        "POST /api/intake",
        "PATCH /api/tasks/:taskId",
        "POST /api/tasks/:taskId/records",
        "GET /api/backups",
        "PATCH /api/backups/schedule",
        "POST /api/backups/create",
        "POST /api/backups/restore",
      ],
      artifacts: {
        outputRoot,
        progressPath,
        appStdout: appServer.stdoutPath,
        appStderr: appServer.stderrPath,
      },
      upstreamRequests: fakeResponses.requestLog,
      entities: {
        projectId: project.id,
        singleSessionId,
        batchSessionId,
        remarkId,
        taskId: firstTaskId,
      },
      backup: {
        restoredDate: backupDate,
      },
    };
  } finally {
    logStep("cleanup stopServer start");
    await stopServer(appServer).catch(() => {});
    logStep("cleanup stopServer done");
    if (fakeResponses) {
      logStep("cleanup fakeResponses close start");
      await fakeResponses.close().catch(() => {});
      logStep("cleanup fakeResponses close done");
    }
    logStep("cleanup restore store start");
    fs.writeFileSync(storePath, originalStoreText, "utf8");
    logStep("cleanup restore store done");
    logStep("cleanup restore backups start");
    restoreDirectory(originalBackupsSnapshotDir, backupsDir, hadOriginalBackups);
    logStep("cleanup restore backups done");
    logStep("store and backups restored");
    if (summary) {
      const runFinishedAtMs = Date.now();
      summary.timing = {
        startedAt: runStartedAt,
        finishedAt: new Date(runFinishedAtMs).toISOString(),
        durationMs: runFinishedAtMs - runStartedAtMs,
        durationSeconds: Number(((runFinishedAtMs - runStartedAtMs) / 1000).toFixed(3)),
      };
      writeJson(path.join(outputRoot, "summary.json"), summary);
      logStep(`summary written duration=${summary.timing.durationMs}ms`);
      console.log(JSON.stringify(summary, null, 2));
    }
  }
}

main().catch((error) => {
  try {
    ensureDir(outputRoot);
    fs.writeFileSync(
      path.join(outputRoot, "error.log"),
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`,
      "utf8",
    );
  } catch {
    // Ignore secondary logging errors.
  }
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
