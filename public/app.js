const STORAGE_KEY = "clinical-rollout-selected-project";
const ACTIVE_TAB_KEY = "clinical-rollout-active-tab";
const AUTH_TOKEN_KEY = "clinical-rollout-auth-token";
const INSIGHT_SUBTAB_KEY = "clinical-rollout-insight-subtab";
const LEDGER_SUBTAB_KEY = "clinical-rollout-ledger-subtab";

const elements = {
  appShell: document.querySelector("#appShell"),
  toast: document.querySelector("#toast"),
  sessionUserName: document.querySelector("#sessionUserName"),
  sessionUserRole: document.querySelector("#sessionUserRole"),
  logoutButton: document.querySelector("#logoutButton"),
  tabBar: document.querySelector("#tabBar"),
  entryCard: document.querySelector("#entryCard"),
  entryEyebrow: document.querySelector("#entryEyebrow"),
  entryTitle: document.querySelector("#entryTitle"),
  entryCopy: document.querySelector("#entryCopy"),
  replySourceCard: document.querySelector("#replySourceCard"),
  replySourceTitle: document.querySelector("#replySourceTitle"),
  replySourceMeta: document.querySelector("#replySourceMeta"),
  replySourceText: document.querySelector("#replySourceText"),
  intakeForm: document.querySelector("#intakeForm"),
  projectSelect: document.querySelector("#projectSelect"),
  visitDatePreset: document.querySelector("#visitDatePreset"),
  visitDateLabel: document.querySelector("#visitDateLabel"),
  projectSearchWrap: document.querySelector("#projectSearchWrap"),
  projectSearchInput: document.querySelector("#projectSearchInput"),
  projectAddButton: document.querySelector("#projectAddButton"),
  projectSearchButton: document.querySelector("#projectSearchButton"),
  projectStageText: document.querySelector("#projectStageText"),
  projectModal: document.querySelector("#projectModal"),
  projectModalForm: document.querySelector("#projectModalForm"),
  projectModalCloseButton: document.querySelector("#projectModalCloseButton"),
  newHospitalNameInput: document.querySelector("#newHospitalNameInput"),
  newHospitalCityInput: document.querySelector("#newHospitalCityInput"),
  newProjectSubmitButton: document.querySelector("#newProjectSubmitButton"),
  noteInput: document.querySelector("#noteInput"),
  noteLabel: document.querySelector("#noteLabel"),
  entryHint: document.querySelector("#entryHint"),
  supplementButton: document.querySelector("#supplementButton"),
  submitButton: document.querySelector("#submitButton"),
  intakeResult: document.querySelector("#intakeResult"),
  signalPanel: document.querySelector("#signalPanel"),
  projectList: document.querySelector("#projectList"),
  projectDetail: document.querySelector("#projectDetail"),
  taskBoard: document.querySelector("#taskBoard"),
  insightPanel: document.querySelector("#insightPanel"),
  aiFollowupButton: document.querySelector("#aiFollowupButton"),
  historyInfoButton: document.querySelector("#historyInfoButton"),
  followupDialog: document.querySelector("#followupDialog"),
  followupDialogForm: document.querySelector("#followupDialogForm"),
  followupDialogCloseButton: document.querySelector("#followupDialogCloseButton"),
  followupDialogCancelButton: document.querySelector("#followupDialogCancelButton"),
  followupDialogQuestionList: document.querySelector("#followupDialogQuestionList"),
  followupDialogSubmitButton: document.querySelector("#followupDialogSubmitButton"),
  supplementDialog: document.querySelector("#supplementDialog"),
  supplementDialogForm: document.querySelector("#supplementDialogForm"),
  supplementDialogTitle: document.querySelector("#supplementDialogTitle"),
  supplementDialogCopy: document.querySelector("#supplementDialogCopy"),
  supplementDialogCloseButton: document.querySelector("#supplementDialogCloseButton"),
  supplementDialogCancelButton: document.querySelector("#supplementDialogCancelButton"),
  supplementDialogTextarea: document.querySelector("#supplementDialogTextarea"),
  supplementDialogSubmitButton: document.querySelector("#supplementDialogSubmitButton"),
  historyInfoDialog: document.querySelector("#historyInfoDialog"),
  historyInfoDialogCloseButton: document.querySelector("#historyInfoDialogCloseButton"),
  historyInfoDialogRefreshButton: document.querySelector("#historyInfoDialogRefreshButton"),
  historyInfoDialogList: document.querySelector("#historyInfoDialogList"),
  authDialog: document.querySelector("#authDialog"),
  authDialogTitle: document.querySelector("#authDialogTitle"),
  authDialogCopy: document.querySelector("#authDialogCopy"),
  authDialogCloseButton: document.querySelector("#authDialogCloseButton"),
  authFeedback: document.querySelector("#authFeedback"),
  authModeLoginButton: document.querySelector("#authModeLoginButton"),
  authModeRegisterButton: document.querySelector("#authModeRegisterButton"),
  authLoginForm: document.querySelector("#authLoginForm"),
  authLoginAccountInput: document.querySelector("#authLoginAccountInput"),
  authLoginPasswordInput: document.querySelector("#authLoginPasswordInput"),
  authLoginSubmitButton: document.querySelector("#authLoginSubmitButton"),
  authRegisterForm: document.querySelector("#authRegisterForm"),
  authRegisterNameInput: document.querySelector("#authRegisterNameInput"),
  authRegisterAccountInput: document.querySelector("#authRegisterAccountInput"),
  authRegisterPasswordInput: document.querySelector("#authRegisterPasswordInput"),
  authRegisterRoleSelect: document.querySelector("#authRegisterRoleSelect"),
  authRegisterRegionSelect: document.querySelector("#authRegisterRegionSelect"),
  authRegisterSubmitButton: document.querySelector("#authRegisterSubmitButton"),
  authLogoutInsideButton: document.querySelector("#authLogoutInsideButton"),
};

const state = {
  authToken: localStorage.getItem(AUTH_TOKEN_KEY) || "",
  auth: {
    busy: false,
    mode: "login",
    dialogOpen: false,
    feedback: {
      tone: "",
      message: "",
    },
  },
  authOptions: {
    regions: [],
  },
  bootstrap: null,
  selectedProjectId: localStorage.getItem(STORAGE_KEY) || "",
  activeTab: localStorage.getItem(ACTIVE_TAB_KEY) || "entry",
  insightSubTab: localStorage.getItem(INSIGHT_SUBTAB_KEY) || "summary",
  ledgerSubTab: localStorage.getItem(LEDGER_SUBTAB_KEY) || "list",
  projectKeyword: "",
  projectSearchOpen: false,
  projectModalOpen: false,
  intakePreviewFingerprint: "",
  remarkCursorByProject: {},
  activeRemarkId: "",
  supplement: {
    remarkId: "",
    updateId: "",
    sourceText: "",
    sourceDate: "",
    sourceDepartment: "",
    savedText: "",
    draftText: "",
    savedAt: "",
    dialogOpen: false,
    syncedReplyText: "",
    replySynced: false,
  },
  lastResult: null,
  busy: false,
  backups: {
    busy: false,
    loaded: false,
    error: "",
    list: [],
    availableDates: [],
    selectedDate: "",
    maxBackups: 30,
    policy: {
      schedule: {
        frequency: "daily",
        hour: 2,
        minute: 0,
        weekday: 1,
      },
    },
    scheduler: {
      running: false,
      lastRunAt: "",
      nextRunAt: "",
    },
  },
  followup: {
    sessionId: "",
    history: [],
    busy: false,
    lastTemplateId: "",
    dialogOpen: false,
    pendingQuestions: [],
    draftAnswers: {},
  },
  historyInfo: {
    dialogOpen: false,
    busy: false,
    error: "",
    projectId: "",
    sessions: [],
  },
  projectDetailTaskListExpandedProjectId: "",
};

const VISIT_DATE_OFFSETS = {
  today: 0,
  yesterday: 1,
  day_before_yesterday: 2,
};

const ENTRY_MODE_COPY = {
  default: {
    eyebrow: "ENTRY",
    title: "纪要录入",
    copy: "录入一线医院推进纪要，系统自动提取科室、联系人、问题标签、阶段变化与任务建议",
    visitDateLabel: "拜访日期",
    noteLabel: "原始推进记录",
    notePlaceholder: "请描述本次医院推进情况，例如：拜访科室、关键接触人、反馈意见、阻塞点、下一步计划及是否需要管理支持",
    hint: "建议记录完整业务信息，以便系统准确生成项目更新与任务动作",
  },
  reply: {
    eyebrow: "ENTRY",
    title: "纪要录入（回复）",
    copy: "围绕指定留言补充回复信息，系统会先同步原始回复记录，再继续生成结构化纪要",
    visitDateLabel: "回复日期",
    noteLabel: "原始回复记录",
    notePlaceholder: "请填写对该条留言的回复记录，例如：沟通对象、处理结果、最新结论和后续动作",
    hint: "建议补全留言处理过程，以便系统准确生成后续纪要与任务动作",
  },
};

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const requestInit = { ...init };
  const headers = new Headers(requestInit.headers || {});
  const url = typeof input === "string" ? input : input?.url || "";
  const isApi = String(url).startsWith("/api/");
  const authTokenForRequest = isApi && state.authToken ? String(state.authToken) : "";
  if (authTokenForRequest) {
    headers.set("Authorization", `Bearer ${authTokenForRequest}`);
  }
  requestInit.headers = headers;
  const response = await nativeFetch(input, requestInit);
  const isPublicAuth = String(url).startsWith("/api/auth/login") || String(url).startsWith("/api/auth/register");
  if (
    response.status === 401 &&
    isApi &&
    !isPublicAuth &&
    authTokenForRequest &&
    authTokenForRequest === String(state.authToken || "")
  ) {
    handleUnauthorized();
  }
  return response;
};

boot();

elements.projectSelect.addEventListener("change", () => {
  invalidateIntakePreview();
  state.selectedProjectId = elements.projectSelect.value;
  state.activeRemarkId = "";
  clearSupplementContext();
  persistSelection();
  resetFollowupState();
  resetHistoryInfoState();
  renderAll();
});

elements.tabBar.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) {
    return;
  }

  state.activeTab = button.dataset.tab;
  persistActiveTab();
  renderTabs();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-ledger-subtab]");
  if (!button) {
    return;
  }

  const nextTab = normalizeLedgerSubTab(button.dataset.ledgerSubtab);
  if (nextTab === state.ledgerSubTab) {
    return;
  }

  state.ledgerSubTab = nextTab;
  persistLedgerSubTab();
  renderLedgerSubTabs();
});

elements.intakeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await generateIntakePreviewFromForm();
});

elements.intakeResult.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-intake-action]");
  if (!button || state.busy) {
    return;
  }

  const action = String(button.dataset.intakeAction || "");
  if (action === "supplement") {
    openSupplementDialog();
    return;
  }
  if (action === "toggle-review-item") {
    const reviewSection = String(button.dataset.intakeReviewSection || "");
    const reviewItemId = String(button.dataset.intakeReviewId || "");
    toggleIntakeReviewItem(reviewSection, reviewItemId);
    return;
  }
  if (action === "submit") {
    await commitIntake();
  }
});

elements.supplementButton?.addEventListener("click", () => {
  openSupplementDialog();
});

elements.visitDatePreset.addEventListener("change", () => {
  invalidateIntakePreview();
  renderIntakeSubmitButton();
});

elements.noteInput.addEventListener("input", () => {
  if (state.supplement.remarkId) {
    const rawReply = getVisibleReplyText();
    state.supplement.replySynced = Boolean(rawReply) && rawReply === state.supplement.syncedReplyText;
  }
  invalidateIntakePreview();
  renderIntakeSubmitButton();
});

elements.supplementDialogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveSupplementDraft();
});

elements.supplementDialogCloseButton.addEventListener("click", () => {
  closeSupplementDialog();
});

elements.supplementDialogCancelButton.addEventListener("click", () => {
  closeSupplementDialog();
});

elements.supplementDialogTextarea.addEventListener("input", () => {
  state.supplement.draftText = elements.supplementDialogTextarea.value;
});

elements.supplementDialog.addEventListener("click", (event) => {
  if (event.target === elements.supplementDialog) {
    closeSupplementDialog();
  }
});

elements.projectSearchInput.addEventListener("input", () => {
  state.projectKeyword = elements.projectSearchInput.value.trim();
  renderProjectSelect();
});

elements.projectSearchButton.addEventListener("click", () => {
  toggleProjectSearch();
});

elements.projectAddButton.addEventListener("click", async () => {
  openProjectModal();
});

elements.projectModalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createProjectQuickly();
});

elements.projectModalCloseButton.addEventListener("click", () => {
  closeProjectModal();
});

elements.projectModal.addEventListener("click", (event) => {
  if (event.target === elements.projectModal) {
    closeProjectModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (state.auth.dialogOpen) {
    return;
  }
  if (state.projectModalOpen) {
    closeProjectModal();
  }
  if (state.supplement.dialogOpen) {
    closeSupplementDialog();
  }
  if (state.followup.dialogOpen) {
    closeFollowupDialog();
  }
  if (state.historyInfo.dialogOpen) {
    closeHistoryInfoDialog();
  }
});

elements.aiFollowupButton.addEventListener("click", async () => {
  await openFollowupDialogByGeneratingQuestions();
});

elements.historyInfoButton?.addEventListener("click", async () => {
  await openHistoryInfoDialog();
});

elements.followupDialog.addEventListener("click", (event) => {
  if (event.target === elements.followupDialog) {
    closeFollowupDialog();
  }
});

elements.followupDialogCloseButton.addEventListener("click", () => {
  closeFollowupDialog();
});

elements.followupDialogCancelButton.addEventListener("click", () => {
  closeFollowupDialog();
});

elements.historyInfoDialog?.addEventListener("click", (event) => {
  if (event.target === elements.historyInfoDialog) {
    closeHistoryInfoDialog();
  }
});

elements.historyInfoDialogCloseButton?.addEventListener("click", () => {
  closeHistoryInfoDialog();
});

elements.historyInfoDialogRefreshButton?.addEventListener("click", async () => {
  await loadHistoryInfo(true);
});

elements.historyInfoDialogList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-history-action='continue'][data-history-session-id]");
  if (!button) {
    return;
  }
  const historySessionId = String(button.dataset.historySessionId || "").trim();
  if (!historySessionId || state.historyInfo.busy || state.followup.busy || state.busy) {
    return;
  }
  const matchedSession = (state.historyInfo.sessions || []).find((item) => item.sessionId === historySessionId);
  if (!matchedSession) {
    showToast("历史信息已变化，请刷新后重试", "warn");
    return;
  }
  if (!String(elements.noteInput.value || "").trim() && matchedSession.seedNote) {
    elements.noteInput.value = matchedSession.seedNote;
    invalidateIntakePreview();
    renderIntakeSubmitButton();
  }
  closeHistoryInfoDialog();
  await openFollowupDialogByGeneratingQuestions({ historySessionId });
});

elements.logoutButton.addEventListener("click", async () => {
  await logout();
});

elements.authDialogCloseButton.addEventListener("click", () => {
  if (!state.authToken) {
    setAuthFeedback("请先登录后继续使用系统", "warn");
    return;
  }
  closeAuthDialog();
});

elements.authDialog.addEventListener("click", (event) => {
  if (event.target !== elements.authDialog) {
    return;
  }
  if (!state.authToken) {
    setAuthFeedback("请先登录后继续使用系统", "warn");
    return;
  }
  closeAuthDialog();
});

elements.authModeLoginButton.addEventListener("click", () => {
  switchAuthMode("login");
});

elements.authModeRegisterButton.addEventListener("click", () => {
  switchAuthMode("register");
});

elements.authLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitLogin();
});

elements.authRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitRegister();
});

elements.authLogoutInsideButton.addEventListener("click", async () => {
  await logout();
});

elements.followupDialogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitFollowupAnswers();
});

elements.followupDialogQuestionList.addEventListener("input", (event) => {
  const input = event.target.closest("textarea[data-question-id]");
  if (!input) {
    return;
  }
  const questionId = String(input.dataset.questionId || "");
  state.followup.draftAnswers[questionId] = input.value;
  syncFollowupDialogControls();
});

elements.projectList.addEventListener("click", (event) => {
  const remarkTrigger = event.target.closest("[data-remark-focus-project]");
  if (remarkTrigger) {
    event.preventDefault();
    event.stopPropagation();
    focusNextProjectRemark(remarkTrigger.dataset.remarkFocusProject);
    return;
  }

  const card = event.target.closest("[data-project-id]");
  if (!card) {
    return;
  }

  state.selectedProjectId = card.dataset.projectId;
  state.activeRemarkId = "";
  state.ledgerSubTab = "detail";
  clearSupplementContext();
  persistSelection();
  persistLedgerSubTab();
  resetFollowupState();
  resetHistoryInfoState();
  renderAll();
});

elements.projectDetail.addEventListener("click", async (event) => {
  const taskToggleButton = event.target.closest("button[data-project-task-toggle][data-project-id]");
  if (taskToggleButton) {
    event.preventDefault();
    event.stopPropagation();

    const projectId = String(taskToggleButton.dataset.projectId || "");
    if (!projectId) {
      return;
    }
    state.projectDetailTaskListExpandedProjectId =
      state.projectDetailTaskListExpandedProjectId === projectId ? "" : projectId;
    renderProjectDetail();
    return;
  }

  const actionButton = event.target.closest("button[data-remark-action][data-remark-id]");
  if (actionButton) {
    event.preventDefault();

    const action = String(actionButton.dataset.remarkAction || "");
    const remarkId = String(actionButton.dataset.remarkId || "");
    if (!remarkId || state.busy) {
      return;
    }

    if (action === "read") {
      await markProjectRemarkAsRead(remarkId);
      return;
    }
    if (action === "reply") {
      startSupplementFromRemark(remarkId);
    }
    return;
  }

  const createRemarkButton = event.target.closest("button[data-create-project-remark]");
  if (!createRemarkButton) {
    return;
  }
  event.preventDefault();

  const projectId = String(createRemarkButton.dataset.createProjectRemark || "");
  if (!projectId || state.busy) {
    return;
  }

  await createProjectRemark(projectId);
});

elements.signalPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-focus-project]");
  if (!button) {
    return;
  }

  openProjectLedgerDetail(button.dataset.focusProject);
});

elements.taskBoard.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-task-id][data-task-status]");
  if (!button || state.busy) {
    return;
  }

  await updateTaskStatus(button.dataset.taskId, button.dataset.taskStatus);
});

elements.insightPanel.addEventListener("click", async (event) => {
  const subTabButton = event.target.closest("button[data-insight-subtab]");
  if (subTabButton) {
    const nextTab = normalizeInsightSubTab(subTabButton.dataset.insightSubtab);
    if (nextTab !== state.insightSubTab) {
      state.insightSubTab = nextTab;
      persistInsightSubTab();
      renderInsights();
      if (nextTab === "management" && isCurrentUserBackupAdmin()) {
        await loadBackups(false);
      }
    }
    return;
  }

  const projectButton = event.target.closest("[data-focus-project]");
  if (projectButton) {
    openProjectLedgerDetail(projectButton.dataset.focusProject);
    return;
  }

  const createBackupButton = event.target.closest("button[data-backup-action='create']");
  if (createBackupButton) {
    await createBackupNow();
    return;
  }

  const saveBackupScheduleButton = event.target.closest("button[data-backup-action='save-schedule']");
  if (saveBackupScheduleButton) {
    await saveBackupSchedule();
    return;
  }

  const restoreBackupButton = event.target.closest("button[data-backup-action='restore-date']");
  if (restoreBackupButton) {
    const backupDate = String(state.backups.selectedDate || "").trim();
    if (!backupDate) {
      return;
    }
    const confirmedRestore = window.confirm(`确认恢复 ${backupDate} 的最新备份吗？恢复后所有用户会被强制下线。`);
    if (!confirmedRestore) {
      return;
    }
    await restoreBackupByDate(backupDate);
    return;
  }

  const button = event.target.closest("button[data-management-action='save-region'][data-user-id]");
  if (!button || state.busy || state.auth.busy) {
    return;
  }
  const userId = String(button.dataset.userId || "");
  if (!userId) {
    return;
  }
  const select = elements.insightPanel.querySelector(`select[data-management-region-select="${escapeSelectorValue(userId)}"]`);
  const regionId = String(select?.value || "").trim();
  if (!regionId) {
    showToast("请选择区域后再保存", "warn");
    return;
  }
  await updateUserRegion(userId, regionId);
});

elements.insightPanel.addEventListener("change", (event) => {
  const dateSelect = event.target.closest("select[data-backup-date-select]");
  if (dateSelect) {
    state.backups.selectedDate = String(dateSelect.value || "").trim();
    renderInsights();
    return;
  }

  const frequencySelect = event.target.closest("select[data-backup-frequency]");
  if (!frequencySelect) {
    return;
  }
  const weekdaySelect = elements.insightPanel.querySelector("select[data-backup-weekday]");
  if (!weekdaySelect) {
    return;
  }
  weekdaySelect.disabled =
    state.backups.busy || state.busy || state.auth.busy || String(frequencySelect.value || "") !== "weekly";
});

async function boot() {
  elements.visitDatePreset.value = "today";
  await loadAuthOptions();
  renderAuthState();
  if (!state.authToken) {
    openAuthDialog("login");
    return;
  }
  await loadBootstrap(false);
}

async function loadAuthOptions() {
  try {
    const response = await fetch("/api/auth/options");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.authOptions.regions = Array.isArray(payload.regions) ? payload.regions : [];
    renderAuthRegionOptions();
  } catch (error) {
    state.authOptions.regions = [];
    renderAuthRegionOptions();
    showToast(error instanceof Error ? error.message : "加载注册选项失败", "error");
  }
}

async function loadBootstrap(preserveResult) {
  if (!state.authToken) {
    openAuthDialog("login");
    return;
  }
  setBusy(true);

  try {
    const response = await fetch("/api/bootstrap");
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.bootstrap = payload;
    ensureSelection();
    if (!preserveResult) {
      state.lastResult = null;
    }
    renderAll();
    applyHealthState(payload.health);
    closeAuthDialog();
  } catch (_error) {
    showToast("系统后端连接失败", "error");
  } finally {
    setBusy(false);
  }
}

async function createProjectQuickly() {
  if (state.busy || state.followup.busy) {
    return;
  }

  const hospitalName = elements.newHospitalNameInput.value.trim();
  const city = elements.newHospitalCityInput.value.trim();
  if (!hospitalName) {
    showToast("请先填写医院名称", "warn");
    elements.newHospitalNameInput.focus();
    return;
  }

  setBusy(true);
  showToast("正在新增医院项目", "busy");
  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalName,
        city,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.bootstrap = payload.bootstrap;
    state.selectedProjectId = payload.project.id;
    state.projectKeyword = "";
    elements.projectSearchInput.value = "";
    state.projectSearchOpen = false;
    persistSelection();
    resetFollowupState();
    closeProjectModal({ force: true });
    renderAll();
    showToast("医院项目已新增", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "新增医院项目失败", "error");
  } finally {
    setBusy(false);
  }
}

function toggleProjectSearch(forceOpen = null) {
  const open = forceOpen === null ? !state.projectSearchOpen : Boolean(forceOpen);
  state.projectSearchOpen = open;
  if (!open && state.projectKeyword) {
    state.projectKeyword = "";
    elements.projectSearchInput.value = "";
    renderProjectSelect();
  }
  renderProjectSearchState();
  if (open) {
    elements.projectSearchInput.focus();
    elements.projectSearchInput.select();
  }
}

function renderProjectSearchState() {
  if (!elements.projectSearchWrap) {
    return;
  }
  elements.projectSearchWrap.classList.toggle("is-hidden", !state.projectSearchOpen);
}

function openProjectModal() {
  if (state.busy || state.followup.busy) {
    return;
  }
  state.projectModalOpen = true;
  elements.projectModal.hidden = false;
  elements.newHospitalNameInput.value = "";
  elements.newHospitalCityInput.value = "";
  elements.newHospitalNameInput.focus();
}

function closeProjectModal(options = {}) {
  if (!options.force && state.busy) {
    return;
  }
  state.projectModalOpen = false;
  elements.projectModal.hidden = true;
}

function buildIntakeFingerprint({ projectId, note, visitDate }) {
  const followupSessionId = state.followup.sessionId || "";
  const followupAnswerSignature = buildFollowupAnswerSignature();
  const supplementRemarkId = state.supplement.remarkId || "";
  return `${projectId}::${visitDate}::${followupSessionId}::${followupAnswerSignature}::${supplementRemarkId}::${note}`;
}

function buildFollowupAnswerSignature() {
  return [...state.followup.history]
    .filter((item) => item.answer?.content)
    .map((item) => `${item.id}:${item.answer.content}`)
    .join("|");
}

function getVisibleReplyText() {
  return String(elements.noteInput.value || "").trim();
}

function buildReplyModeIntakeNote(rawReply, visitDate) {
  const replyText = String(rawReply || "").trim();
  if (!replyText) {
    return "";
  }

  const normalizedVisitDate = String(visitDate || "").trim() || state.supplement.sourceDate || "--";
  const departmentName = String(state.supplement.sourceDepartment || "").trim() || "未填写";
  const sourceText = String(state.supplement.sourceText || "").trim() || "未找到原始留言内容";
  return [
    "【留言回复纪要】",
    `关联日期：${normalizedVisitDate}`,
    `关联科室：${departmentName}`,
    `上级留言：${sourceText}`,
    "回复内容：",
    replyText,
  ].join("\n");
}

function getSavedSupplementText() {
  return String(state.supplement.savedText || "").trim();
}

function buildSupplementedIntakeNote(baseNote, supplementText) {
  const normalizedBase = String(baseNote || "").trim();
  const normalizedSupplement = String(supplementText || "").trim();
  if (!normalizedSupplement) {
    return normalizedBase;
  }
  if (!normalizedBase) {
    return [
      "【补充编辑】",
      normalizedSupplement,
    ].join("\n");
  }
  return [
    normalizedBase,
    "【补充编辑】",
    normalizedSupplement,
  ].join("\n\n");
}

function getCurrentIntakeContext() {
  const projectId = elements.projectSelect.value;
  const visitDate = resolveVisitDate();
  const rawNote = getVisibleReplyText();
  const baseNote = state.supplement.remarkId ? buildReplyModeIntakeNote(rawNote, visitDate) : rawNote;
  const supplementText = getSavedSupplementText();
  const note = buildSupplementedIntakeNote(baseNote, supplementText);
  return {
    projectId,
    rawNote,
    baseNote,
    supplementText,
    note,
    visitDate,
  };
}

function invalidateIntakePreview(options = {}) {
  const { preserveResult = false } = options;
  if (!state.intakePreviewFingerprint) {
    if (!preserveResult) {
      state.lastResult = null;
    }
    return;
  }
  state.intakePreviewFingerprint = "";
  if (!preserveResult) {
    state.lastResult = null;
  }
  renderIntakeResult();
}

function buildIntakeReviewState(extraction = {}) {
  const nextActions = Array.isArray(extraction.nextActions) ? extraction.nextActions : [];
  return {
    nextStep: {
      cancelled: false,
    },
    nextActions: nextActions.map((_, index) => ({
      cancelled: false,
      itemId: `next-action-${index}`,
    })),
  };
}

function cloneIntakeReviewState(reviewState) {
  if (!reviewState) {
    return null;
  }

  return {
    nextStep: {
      cancelled: Boolean(reviewState.nextStep?.cancelled),
    },
    nextActions: Array.isArray(reviewState.nextActions)
      ? reviewState.nextActions.map((item, index) => ({
          cancelled: Boolean(item?.cancelled),
          itemId: String(item?.itemId || `next-action-${index}`),
        }))
      : [],
  };
}

function ensureIntakeReviewState(result) {
  if (!result?.extraction) {
    return null;
  }

  if (!result.reviewState) {
    result.reviewState = buildIntakeReviewState(result.extraction);
  }

  const nextActions = Array.isArray(result.extraction.nextActions) ? result.extraction.nextActions : [];
  if (!Array.isArray(result.reviewState.nextActions) || result.reviewState.nextActions.length !== nextActions.length) {
    result.reviewState = buildIntakeReviewState(result.extraction);
    return result.reviewState;
  }

  if (!result.reviewState.nextStep) {
    result.reviewState.nextStep = { cancelled: false };
  }

  result.reviewState.nextActions = result.reviewState.nextActions.map((item, index) => ({
    cancelled: Boolean(item?.cancelled),
    itemId: String(item?.itemId || `next-action-${index}`),
  }));

  return result.reviewState;
}

function renderIntakeReviewItem({ label, title, meta, cancelled, section, itemId }) {
  return `
    <li class="result-review-item ${cancelled ? "is-cancelled" : ""}" data-intake-review-section="${section}" data-intake-review-id="${itemId}">
      <div class="result-review-item-main">
        <div class="result-review-item-head">
          <span class="result-review-item-label">${escapeHtml(label)}</span>
          <span class="result-review-item-status ${cancelled ? "is-cancelled" : ""}">${cancelled ? "已取消" : "待审阅"}</span>
        </div>
        <strong>${escapeHtml(title || "未填写")}</strong>
        ${meta ? `<p class="result-review-item-meta">${escapeHtml(meta)}</p>` : ""}
      </div>
      <button class="chip result-review-toggle" type="button" data-intake-action="toggle-review-item" data-intake-review-section="${section}" data-intake-review-id="${itemId}">
        ${cancelled ? "恢复" : "取消"}
      </button>
    </li>
  `;
}

function toggleIntakeReviewItem(section, itemId) {
  const reviewState = ensureIntakeReviewState(state.lastResult);
  if (!reviewState) {
    return;
  }

  if (section === "next-step") {
    reviewState.nextStep.cancelled = !reviewState.nextStep.cancelled;
    renderIntakeResult();
    return;
  }

  if (section !== "next-action") {
    return;
  }

  const nextAction = reviewState.nextActions.find((item) => item.itemId === itemId);
  if (!nextAction) {
    return;
  }

  nextAction.cancelled = !nextAction.cancelled;
  renderIntakeResult();
}

function buildReviewedIntakeSnapshot() {
  const reviewState = ensureIntakeReviewState(state.lastResult);
  if (!state.lastResult?.extraction || !reviewState) {
    return null;
  }

  return {
    extraction: {
      department: state.lastResult.extraction.department,
      contacts: Array.isArray(state.lastResult.extraction.contacts)
        ? state.lastResult.extraction.contacts.map((item) => ({ ...item }))
        : [],
      feedbackSummary: state.lastResult.extraction.feedbackSummary,
      blockers: state.lastResult.extraction.blockers,
      opportunities: state.lastResult.extraction.opportunities,
      issues: Array.isArray(state.lastResult.extraction.issues) ? [...state.lastResult.extraction.issues] : [],
      nextStep: state.lastResult.extraction.nextStep,
      nextActions: Array.isArray(state.lastResult.extraction.nextActions)
        ? state.lastResult.extraction.nextActions.map((item) => ({ ...item }))
        : [],
      stageAfterUpdate: state.lastResult.extraction.stageAfterUpdate,
      managerAttentionNeeded: Boolean(state.lastResult.extraction.managerAttentionNeeded),
    },
    reviewState: cloneIntakeReviewState(reviewState),
  };
}

function renderIntakeSubmitButton() {
  if (!elements.submitButton) {
    return;
  }

  const { projectId, rawNote, note, visitDate } = getCurrentIntakeContext();
  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  const isSupplementMode = Boolean(state.supplement.remarkId);
  const hasGeneratedOnce = Boolean(state.lastResult);
  const hasInput = Boolean(projectId && rawNote);
  const useRegenerateLabel = hasGeneratedOnce;
  elements.submitButton.textContent = useRegenerateLabel
    ? isSupplementMode
      ? "再次生成回复纪要"
      : "再次生成纪要"
    : isSupplementMode
      ? "生成回复纪要"
      : "生成纪要";
  elements.submitButton.disabled = state.busy || state.followup.busy || !hasInput;

  if (elements.aiFollowupButton) {
    const hasFollowupSession = Boolean(state.followup.sessionId);
    elements.aiFollowupButton.disabled = !(
      !state.busy &&
      !state.followup.busy &&
      !state.followup.dialogOpen &&
      Boolean(projectId && rawNote) &&
      (previewReady || hasFollowupSession)
    );
  }
  if (elements.historyInfoButton) {
    elements.historyInfoButton.disabled = !(
      !state.busy &&
      !state.followup.busy &&
      !state.historyInfo.busy &&
      Boolean(projectId)
    );
  }

  const resultSubmitButton = elements.intakeResult?.querySelector("[data-intake-action='submit']");
  if (resultSubmitButton) {
    resultSubmitButton.disabled = !(previewReady && !state.busy && !state.followup.busy);
  }
  if (elements.supplementButton) {
    elements.supplementButton.disabled = state.busy || state.followup.busy;
  }
}

function isPreviewReadyForCurrentInput({ projectId, note, visitDate } = getCurrentIntakeContext()) {
  const currentFingerprint = buildIntakeFingerprint({ projectId, note, visitDate });
  return Boolean(
    state.intakePreviewFingerprint &&
      currentFingerprint &&
      state.intakePreviewFingerprint === currentFingerprint,
  );
}

async function generateIntakePreview({ projectId, note, visitDate, fingerprint }) {
  setBusy(true);
  showToast("正在生成纪要", "busy");
  try {
    const response = await fetch("/api/intake/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        note,
        visitDate,
        followupSessionId: state.followup.sessionId || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.lastResult = { ...payload, reviewState: buildIntakeReviewState(payload.extraction) };
    state.intakePreviewFingerprint = fingerprint;
    renderIntakeResult();
    renderIntakeSubmitButton();
    showToast("纪要已生成，请确认后提交", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "纪要生成失败", "error");
  } finally {
    setBusy(false);
  }
}

async function generateIntakePreviewFromForm() {
  const { projectId, rawNote, note, visitDate } = getCurrentIntakeContext();

  if (!projectId || !rawNote || state.busy || state.followup.busy) {
    return;
  }

  const fingerprint = buildIntakeFingerprint({ projectId, note, visitDate });
  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  if (!previewReady) {
    await generateIntakePreview({ projectId, note, visitDate, fingerprint });
    return;
  }

  await generateIntakePreview({ projectId, note, visitDate, fingerprint });
}

async function commitIntake() {
  const { projectId, rawNote, note, visitDate } = getCurrentIntakeContext();

  if (!projectId || !rawNote || state.busy || state.followup.busy) {
    return;
  }

  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  if (!previewReady) {
    showToast("请先生成纪要，再提交", "warn");
    return;
  }

  setBusy(true);
  showToast("正在提交纪要", "busy");

  try {
    await ensureSupplementRemarkReply(rawNote);

    const reviewedSnapshot = buildReviewedIntakeSnapshot();
    if (!reviewedSnapshot) {
      throw new Error("Reviewed intake snapshot is required before submit.");
    }

    const body = {
      projectId,
      note,
      visitDate,
      followupSessionId: state.followup.sessionId || undefined,
      reviewedSnapshot,
      submitScenario: buildFollowupScenario("submit"),
    };
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.bootstrap = payload.bootstrap;
    state.intakePreviewFingerprint = "";
    state.selectedProjectId = payload.project.id;
    clearSupplementContext();
    persistSelection();
    elements.noteInput.value = "";
    resetFollowupState();
    resetHistoryInfoState();
    renderAll();
    showToast("纪要已提交并同步台账", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "纪要提交失败", "error");
  } finally {
    setBusy(false);
  }
}

async function openFollowupDialogByGeneratingQuestions(options = {}) {
  const { projectId, rawNote, note, visitDate } = getCurrentIntakeContext();
  const historySessionId = String(options?.historySessionId || "").trim();
  if (!projectId || !rawNote || state.busy || state.followup.busy) {
    return;
  }

  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  const hasFollowupSession = Boolean(state.followup.sessionId);
  if (!previewReady && !hasFollowupSession && !historySessionId) {
    showToast("请先生成纪要，再使用 AI追问", "warn");
    return;
  }

  setFollowupBusy(true);
  showToast("正在生成 AI追问", "busy");
  try {
    const response = await fetch("/api/followups/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        note,
        visitDate,
        sessionId: historySessionId ? undefined : state.followup.sessionId || undefined,
        historySessionId: historySessionId || undefined,
        scenario: buildFollowupScenario("generate"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.followup.sessionId = payload.sessionId;
    state.followup.history = normalizeFollowupHistory(payload.history);
    const pendingFromPayload = payload.question ? normalizeFollowupQuestions([payload.question]) : [];
    const pendingFromHistory = getPendingFollowupQuestionsFromHistory();
    state.followup.pendingQuestions = pendingFromPayload.length
      ? pendingFromPayload
      : pendingFromHistory.length
        ? [pendingFromHistory[pendingFromHistory.length - 1]]
        : [];
    state.followup.draftAnswers = Object.fromEntries(
      state.followup.pendingQuestions.map((item) => [item.id, ""]),
    );
    openFollowupDialog();
    renderIntakeSubmitButton();
    showToast("已生成 1 条 AI追问", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "AI追问生成失败", "error");
  } finally {
    setFollowupBusy(false);
  }
}

function openFollowupDialog() {
  state.followup.dialogOpen = true;
  elements.followupDialog.hidden = false;
  renderFollowupDialog();
  renderIntakeSubmitButton();
}

function closeFollowupDialog(options = {}) {
  if (!options.force && state.followup.busy) {
    return;
  }
  state.followup.dialogOpen = false;
  elements.followupDialog.hidden = true;
  renderFollowupDialog();
  renderIntakeSubmitButton();
}

function normalizeHistoryInfoSessions(sessions) {
  if (!Array.isArray(sessions)) {
    return [];
  }
  return sessions
    .map((session) => ({
      sessionId: String(session?.sessionId || ""),
      projectId: String(session?.projectId || ""),
      createdAt: String(session?.createdAt || ""),
      closedAt: String(session?.closedAt || ""),
      closedReason: String(session?.closedReason || ""),
      source: String(session?.source || ""),
      userId: String(session?.userId || ""),
      userName: String(session?.userName || ""),
      seedNote: String(session?.seedNote || ""),
      scenario: session?.scenario && typeof session.scenario === "object" ? session.scenario : null,
      history: Array.isArray(session?.history)
        ? session.history.map((item) => ({
            id: String(item?.id || ""),
            round: Number(item?.round) || 0,
            question: String(item?.question || ""),
            status: String(item?.status || ""),
            createdAt: String(item?.createdAt || ""),
            scenarioSnapshot:
              item?.scenarioSnapshot && typeof item.scenarioSnapshot === "object" ? item.scenarioSnapshot : null,
            answer: item?.answer
              ? {
                  id: String(item.answer.id || ""),
                  content: String(item.answer.content || ""),
                  createdAt: String(item.answer.createdAt || ""),
                  submittedByUserId: String(item.answer.submittedByUserId || ""),
                  submittedByUserName: String(item.answer.submittedByUserName || ""),
                  submitScenario:
                    item.answer.submitScenario && typeof item.answer.submitScenario === "object"
                      ? item.answer.submitScenario
                      : null,
                }
              : null,
          }))
        : [],
    }))
    .filter((item) => item.sessionId);
}

function closeHistoryInfoDialog() {
  state.historyInfo.dialogOpen = false;
  renderHistoryInfoDialog();
}

function resetHistoryInfoState() {
  state.historyInfo.dialogOpen = false;
  state.historyInfo.busy = false;
  state.historyInfo.error = "";
  state.historyInfo.projectId = "";
  state.historyInfo.sessions = [];
  renderHistoryInfoDialog();
}

function formatScenarioSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "--";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "--";
  }
}

function renderHistoryInfoDialog() {
  if (!elements.historyInfoDialog || !elements.historyInfoDialogList) {
    return;
  }
  elements.historyInfoDialog.hidden = !state.historyInfo.dialogOpen;
  if (!state.historyInfo.dialogOpen) {
    return;
  }
  if (elements.historyInfoDialogCloseButton) {
    elements.historyInfoDialogCloseButton.disabled = state.historyInfo.busy;
  }
  if (elements.historyInfoDialogRefreshButton) {
    elements.historyInfoDialogRefreshButton.disabled = state.historyInfo.busy;
  }

  const sessions = Array.isArray(state.historyInfo.sessions) ? state.historyInfo.sessions : [];
  if (state.historyInfo.busy && !sessions.length) {
    elements.historyInfoDialogList.innerHTML = '<p class="empty-copy">历史信息加载中...</p>';
    return;
  }
  if (state.historyInfo.error && !sessions.length) {
    elements.historyInfoDialogList.innerHTML = `<p class="backup-error">${escapeHtml(state.historyInfo.error)}</p>`;
    return;
  }
  if (!sessions.length) {
    elements.historyInfoDialogList.innerHTML = '<p class="empty-copy">暂无历史信息</p>';
    return;
  }

  elements.historyInfoDialogList.innerHTML = sessions
    .map((session) => {
      const answerCount = session.history.filter((item) => item.answer && item.answer.content).length;
      const totalCount = session.history.length;
      const scenarioText = formatScenarioSnapshot(session.scenario);
      const qaHtml = session.history.length
        ? session.history
            .map((item) => {
              const answer = item.answer;
              const submitter = answer?.submittedByUserName || session.userName || "--";
              const submitAt = answer?.createdAt ? formatDateTime(answer.createdAt) : "--";
              const submitScenario = formatScenarioSnapshot(answer?.submitScenario || item.scenarioSnapshot);
              return `
                <article class="history-qa-item">
                  <p class="history-question"><strong>问题 ${item.round || "--"}：</strong>${escapeHtml(item.question || "--")}</p>
                  <p class="history-answer"><strong>回答：</strong>${escapeHtml(answer?.content || "（未回答）")}</p>
                  <p class="history-meta-line">提交人：${escapeHtml(submitter)} · 提交时间：${escapeHtml(submitAt)}</p>
                  <details class="history-params">
                    <summary>提交参数</summary>
                    <pre>${escapeHtml(submitScenario)}</pre>
                  </details>
                </article>
              `;
            })
            .join("")
        : '<p class="empty-copy">该会话暂无问题记录。</p>';
      return `
        <article class="history-session-card">
          <div class="history-session-head">
            <div>
              <strong>历史信息会话 ${escapeHtml(session.sessionId)}</strong>
              <p class="history-meta-line">
                创建人：${escapeHtml(session.userName || "--")} · 创建时间：${escapeHtml(
                  session.createdAt ? formatDateTime(session.createdAt) : "--",
                )} · 回答进度：${answerCount}/${totalCount}
              </p>
              <p class="history-meta-line">
                状态：${session.closedAt ? `已关闭（${escapeHtml(formatDateTime(session.closedAt))}）` : "进行中"}
              </p>
            </div>
            <button
              class="chip"
              type="button"
              data-history-action="continue"
              data-history-session-id="${escapeHtml(session.sessionId)}"
              ${state.historyInfo.busy || state.followup.busy || state.busy ? "disabled" : ""}
            >
              基于该会话继续追问
            </button>
          </div>
          <details class="history-params">
            <summary>会话参数</summary>
            <pre>${escapeHtml(scenarioText)}</pre>
          </details>
          <div class="history-qa-list">${qaHtml}</div>
        </article>
      `;
    })
    .join("");
}

async function loadHistoryInfo(forceRefresh = false) {
  const projectId = String(elements.projectSelect?.value || "").trim();
  if (!projectId || state.historyInfo.busy) {
    return;
  }
  if (!forceRefresh && state.historyInfo.projectId === projectId && state.historyInfo.sessions.length) {
    renderHistoryInfoDialog();
    return;
  }
  state.historyInfo.busy = true;
  state.historyInfo.error = "";
  state.historyInfo.projectId = projectId;
  renderHistoryInfoDialog();
  try {
    const response = await fetch(`/api/followups/history?projectId=${encodeURIComponent(projectId)}&limit=50`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.historyInfo.sessions = normalizeHistoryInfoSessions(payload.sessions);
  } catch (error) {
    state.historyInfo.error = error instanceof Error ? error.message : "历史信息加载失败";
    showToast(state.historyInfo.error, "error");
  } finally {
    state.historyInfo.busy = false;
    renderHistoryInfoDialog();
    renderIntakeSubmitButton();
  }
}

async function openHistoryInfoDialog() {
  const projectId = String(elements.projectSelect?.value || "").trim();
  if (!projectId) {
    showToast("请先选择医院项目", "warn");
    return;
  }
  state.historyInfo.dialogOpen = true;
  renderHistoryInfoDialog();
  await loadHistoryInfo(false);
}

async function submitFollowupAnswers() {
  if (state.busy || state.followup.busy) {
    return;
  }
  const sessionId = state.followup.sessionId;
  const pendingQuestions = state.followup.pendingQuestions.length
    ? [...state.followup.pendingQuestions]
    : getPendingFollowupQuestionsFromHistory();
  if (!sessionId || !pendingQuestions.length) {
    return;
  }

  const latestQuestion = pendingQuestions[pendingQuestions.length - 1];
  const activeTextarea = elements.followupDialogQuestionList?.querySelector(
    `textarea[data-question-id="${escapeSelectorValue(latestQuestion.id)}"]`,
  );
  const latestAnswer = String(activeTextarea?.value ?? state.followup.draftAnswers[latestQuestion.id] ?? "").trim();
  state.followup.draftAnswers[latestQuestion.id] = latestAnswer;
  if (!latestAnswer) {
    showToast("请先填写追问回答", "warn");
    return;
  }

  setFollowupBusy(true);
  showToast("正在保存追问回答", "busy");
  try {
    const response = await fetch("/api/followups/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        questionMessageId: latestQuestion.id,
        answer: latestAnswer,
        scenario: buildFollowupScenario("answer"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.followup.history = normalizeFollowupHistory(payload.history);
    state.followup.pendingQuestions = [];
    state.followup.draftAnswers = {};
    closeFollowupDialog({ force: true });
    invalidateIntakePreview();
    renderIntakeSubmitButton();
    showToast("追问回答已保存，请再次生成纪要", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "追问回答提交失败", "error");
  } finally {
    setFollowupBusy(false);
  }
}

function buildFollowupScenario(operation) {

  const project = getSelectedProject();
  return {
    operation,
    projectId: project?.id || "",
    currentStageId: project?.stage?.id || "",
    currentStageName: project?.stage?.name || "",
    activeTab: state.activeTab || "entry",
    templateId: state.followup.lastTemplateId || "",
    recordedAt: new Date().toISOString(),
  };
}

function normalizeFollowupHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .map((item) => ({
      id: item?.id || "",
      round: Number(item?.round) || 0,
      question: item?.question || "",
      status: item?.status || "pending_answer",
      createdAt: item?.createdAt || "",
      answer: item?.answer
        ? {
            id: item.answer.id || "",
            content: item.answer.content || "",
            createdAt: item.answer.createdAt || "",
          }
        : null,
    }))
    .filter((item) => item.id && item.question);
}

function normalizeFollowupQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }
  return questions
    .map((item) => ({
      id: item?.id || "",
      round: Number(item?.round) || 0,
      question: item?.question || "",
      status: item?.status || "pending_answer",
      createdAt: item?.createdAt || "",
    }))
    .filter((item) => item.status === "pending_answer")
    .filter((item) => item.id && item.question);
}

function getPendingFollowupQuestionsFromHistory() {
  return [...state.followup.history]
    .filter((item) => item.status === "pending_answer")
    .sort(
      (left, right) =>
        (Number(left.round) || 0) - (Number(right.round) || 0) ||
        new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime(),
    );
}

function resetFollowupState() {
  state.followup.sessionId = "";
  state.followup.history = [];
  state.followup.busy = false;
  state.followup.lastTemplateId = "";
  state.followup.dialogOpen = false;
  state.followup.pendingQuestions = [];
  state.followup.draftAnswers = {};
  if (elements.followupDialog) {
    elements.followupDialog.hidden = true;
  }
  invalidateIntakePreview();
  renderIntakeSubmitButton();
  renderFollowupDialog();
}

function resetBackupState() {
  state.backups.busy = false;
  state.backups.loaded = false;
  state.backups.error = "";
  state.backups.list = [];
  state.backups.availableDates = [];
  state.backups.selectedDate = "";
  state.backups.maxBackups = 30;
  state.backups.policy = {
    schedule: {
      frequency: "daily",
      hour: 2,
      minute: 0,
      weekday: 1,
    },
  };
  state.backups.scheduler = {
    running: false,
    lastRunAt: "",
    nextRunAt: "",
  };
}

function setFollowupBusy(isBusy) {
  state.followup.busy = isBusy;
  renderIntakeSubmitButton();
  renderFollowupDialog();
}

function getFollowupPendingQuestions() {
  return state.followup.pendingQuestions.length ? [...state.followup.pendingQuestions] : getPendingFollowupQuestionsFromHistory();
}

function syncFollowupDialogControls(pendingQuestions = getFollowupPendingQuestions()) {
  if (!elements.followupDialogSubmitButton) {
    return;
  }

  const canSubmit = Boolean(
    pendingQuestions.length &&
      pendingQuestions.every((item) => String(state.followup.draftAnswers[item.id] || "").trim()),
  );
  elements.followupDialogSubmitButton.disabled = state.busy || state.followup.busy || !canSubmit;
  elements.followupDialogCloseButton.disabled = state.busy || state.followup.busy;
  elements.followupDialogCancelButton.disabled = state.busy || state.followup.busy;

  const textareas = elements.followupDialogQuestionList?.querySelectorAll("textarea[data-question-id]") || [];
  for (const textarea of textareas) {
    textarea.disabled = state.busy || state.followup.busy;
  }
}

function renderFollowupDialog() {
  if (!elements.followupDialog) {
    return;
  }
  elements.followupDialog.hidden = !state.followup.dialogOpen;
  if (!state.followup.dialogOpen) {
    return;
  }

  const pendingQuestions = getFollowupPendingQuestions();
  if (!pendingQuestions.length) {
    elements.followupDialogQuestionList.innerHTML = '<p class="empty-copy">暂无待回答追问，请重新点击“AI 追问”。</p>';
  } else {
    elements.followupDialogQuestionList.innerHTML = pendingQuestions
      .map((item) => {
        const value = String(state.followup.draftAnswers[item.id] || "");
        return `
          <article class="followup-dialog-item">
            <div class="followup-dialog-head">
              <strong>问题 ${item.round || "--"}</strong>
            </div>
            <p class="followup-dialog-question">${escapeHtml(item.question)}</p>
            <textarea
              data-question-id="${escapeHtml(item.id)}"
              rows="3"
              placeholder="请输入你的回答"
              ${state.busy || state.followup.busy ? "disabled" : ""}
            >${escapeHtml(value)}</textarea>
          </article>
        `;
      })
      .join("");
  }

  syncFollowupDialogControls(pendingQuestions);
}

async function updateTaskStatus(taskId, taskStatus) {
  setBusy(true);
  showToast("正在更新任务状态", "busy");

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskStatus }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.bootstrap = payload.bootstrap;
    ensureSelection();
    renderAll();
    applyHealthState(payload.bootstrap.health);
    showToast("任务状态已更新", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "任务状态更新失败", "error");
  } finally {
    setBusy(false);
  }
}

async function updateUserRegion(userId, regionId) {
  setBusy(true);
  showToast("正在更新成员区域", "busy");
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.bootstrap = payload.bootstrap;
    ensureSelection();
    renderAll();
    applyHealthState(payload.bootstrap.health);
    showToast("成员区域已更新", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "成员区域更新失败", "error");
  } finally {
    setBusy(false);
  }
}

async function loadBackups(forceRefresh = false) {
  if (!isCurrentUserBackupAdmin()) {
    return;
  }
  if (state.backups.busy) {
    return;
  }
  if (state.backups.loaded && !forceRefresh) {
    return;
  }

  state.backups.busy = true;
  if (state.activeTab === "insights" && normalizeInsightSubTab(state.insightSubTab) === "management") {
    renderInsights();
  }
  try {
    const response = await fetch("/api/backups");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    applyBackupPayload(payload);
    state.backups.loaded = true;
    state.backups.error = "";
  } catch (error) {
    state.backups.loaded = false;
    state.backups.error = error instanceof Error ? error.message : "备份列表加载失败";
    showToast(state.backups.error, "error");
  } finally {
    state.backups.busy = false;
    if (state.activeTab === "insights" && normalizeInsightSubTab(state.insightSubTab) === "management") {
      renderInsights();
    }
  }
}

async function createBackupNow() {
  if (!isCurrentUserBackupAdmin() || state.backups.busy || state.busy || state.auth.busy) {
    return;
  }

  state.backups.busy = true;
  renderInsights();
  showToast("正在创建备份", "busy");
  try {
    const response = await fetch("/api/backups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    applyBackupPayload(payload);
    state.backups.loaded = true;
    state.backups.error = "";
    showToast("备份已创建", "ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建备份失败";
    state.backups.error = message;
    showToast(message, "error");
  } finally {
    state.backups.busy = false;
    renderInsights();
  }
}

async function saveBackupSchedule() {
  if (!isCurrentUserBackupAdmin() || state.backups.busy || state.busy || state.auth.busy) {
    return;
  }

  const frequencySelect = elements.insightPanel.querySelector("select[data-backup-frequency]");
  const timeInput = elements.insightPanel.querySelector("input[data-backup-time]");
  const weekdaySelect = elements.insightPanel.querySelector("select[data-backup-weekday]");
  const frequency = String(frequencySelect?.value || "").trim();
  const timeValue = String(timeInput?.value || "").trim();
  const [hourText = "", minuteText = ""] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const weekday = Number(weekdaySelect?.value);

  state.backups.busy = true;
  renderInsights();
  showToast("正在保存备份计划", "busy");
  try {
    const response = await fetch("/api/backups/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency, hour, minute, weekday }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    applyBackupPayload(payload);
    state.backups.loaded = true;
    state.backups.error = "";
    showToast("备份计划已保存", "ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存备份计划失败";
    state.backups.error = message;
    showToast(message, "error");
  } finally {
    state.backups.busy = false;
    renderInsights();
  }
}

async function restoreBackupByDate(backupDate) {
  if (!isCurrentUserBackupAdmin() || !backupDate || state.backups.busy || state.busy || state.auth.busy) {
    return;
  }

  state.backups.busy = true;
  renderInsights();
  showToast("正在恢复备份", "busy");
  try {
    const response = await fetch("/api/backups/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupDate }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    handleUnauthorized("数据已从备份恢复，请重新登录");
    showToast("恢复完成，已退出登录", "ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "恢复备份失败";
    showToast(message, "error");
    state.backups.busy = false;
    renderInsights();
    return;
  }
  state.backups.busy = false;
}

function applyBackupPayload(payload) {
  const maxBackups = Number(payload?.policy?.maxBackups);
  state.backups.maxBackups = Number.isFinite(maxBackups) && maxBackups > 0 ? maxBackups : 30;
  state.backups.policy = {
    schedule: {
      frequency: String(payload?.policy?.schedule?.frequency || "daily"),
      hour: Number(payload?.policy?.schedule?.hour) || 0,
      minute: Number(payload?.policy?.schedule?.minute) || 0,
      weekday: Number.isInteger(Number(payload?.policy?.schedule?.weekday))
        ? Number(payload?.policy?.schedule?.weekday)
        : 1,
    },
  };
  const scheduler = payload?.scheduler || {};
  state.backups.scheduler = {
    running: Boolean(scheduler.running),
    lastRunAt: String(scheduler.lastRunAt || ""),
    nextRunAt: String(scheduler.nextRunAt || ""),
  };
  state.backups.availableDates = Array.isArray(payload?.availableDates)
    ? payload.availableDates.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const backups = Array.isArray(payload?.backups) ? payload.backups : [];
  state.backups.list = backups.map((item) => ({
    id: String(item?.id || ""),
    fileName: String(item?.fileName || ""),
    trigger: String(item?.trigger || ""),
    createdAt: String(item?.createdAt || ""),
    date: String(item?.date || ""),
    sizeBytes: Number(item?.sizeBytes) || 0,
  }));
  if (!state.backups.availableDates.includes(state.backups.selectedDate)) {
    state.backups.selectedDate = state.backups.availableDates[0] || "";
  }
}

function ensureSelection() {
  const projects = state.bootstrap?.projects || [];
  if (!projects.length) {
    state.selectedProjectId = "";
    return;
  }

  const matched = projects.find((project) => project.id === state.selectedProjectId);
  state.selectedProjectId = matched ? matched.id : projects[0].id;
  persistSelection();
}

function renderAll() {
  if (!state.bootstrap) {
    renderAuthState();
    renderHistoryInfoDialog();
    return;
  }

  renderSessionBar();
  renderAuthState();
  renderTabs();
  renderProjectSearchState();
  renderProjectSelect();
  renderEntryMode();
  renderIntakeSubmitButton();
  renderIntakeResult();
  renderSupplementDialog();
  renderFollowupDialog();
  renderHistoryInfoDialog();
  renderSignals();
  renderProjectList();
  renderProjectDetail();
  renderLedgerSubTabs();
  renderTaskBoard();
  renderInsights();
}

function renderEntryMode() {
  const isReplyMode = Boolean(state.supplement.remarkId);
  const copy = isReplyMode ? ENTRY_MODE_COPY.reply : ENTRY_MODE_COPY.default;
  const selectedProject = getSelectedProject();

  if (elements.entryCard) {
    elements.entryCard.classList.toggle("is-reply-mode", isReplyMode);
  }
  if (elements.entryEyebrow) {
    elements.entryEyebrow.textContent = copy.eyebrow;
  }
  if (elements.entryTitle) {
    elements.entryTitle.textContent = copy.title;
  }
  if (elements.entryCopy) {
    elements.entryCopy.textContent = copy.copy;
  }
  if (elements.visitDateLabel) {
    elements.visitDateLabel.textContent = copy.visitDateLabel;
  }
  if (elements.noteLabel) {
    elements.noteLabel.textContent = copy.noteLabel;
  }
  if (elements.noteInput) {
    elements.noteInput.placeholder = copy.notePlaceholder;
  }
  if (elements.entryHint) {
    elements.entryHint.textContent = copy.hint;
  }

  if (!elements.replySourceCard || !elements.replySourceMeta || !elements.replySourceText) {
    return;
  }

  elements.replySourceCard.hidden = !isReplyMode;
  if (!isReplyMode) {
    elements.replySourceMeta.innerHTML = "";
    elements.replySourceText.textContent = "";
    return;
  }

  const metaTokens = [
    selectedProject?.hospital?.name ? `医院 · ${selectedProject.hospital.name}` : "",
    state.supplement.sourceDepartment ? `科室 · ${state.supplement.sourceDepartment}` : "",
    state.supplement.sourceDate ? `留言日期 · ${state.supplement.sourceDate}` : "",
  ]
    .filter(Boolean)
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");

  if (elements.replySourceTitle) {
    elements.replySourceTitle.textContent = "原始留言记录";
  }
  elements.replySourceMeta.innerHTML = metaTokens;
  elements.replySourceText.textContent = state.supplement.sourceText;
}

function renderTabs() {
  const buttons = [...elements.tabBar.querySelectorAll("button[data-tab]")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  if (!buttons.some((button) => button.dataset.tab === state.activeTab)) {
    state.activeTab = "entry";
    persistActiveTab();
  }

  for (const button of buttons) {
    button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
  }

  for (const panel of panels) {
    panel.hidden = panel.dataset.panel !== state.activeTab;
  }
}

function getVisibleProjects() {
  const projects = state.bootstrap?.projects || [];
  const keyword = state.projectKeyword.trim().toLowerCase();
  if (!keyword) {
    return projects;
  }
  return projects.filter((project) => {
    const haystack = `${project.hospital.name} ${project.hospital.city} ${project.stage.name}`.toLowerCase();
    return haystack.includes(keyword);
  });
}

function renderProjectSelect() {
  const visibleProjects = getVisibleProjects();
  const hadSelection = visibleProjects.some((project) => project.id === state.selectedProjectId);
  if (!hadSelection) {
    state.selectedProjectId = visibleProjects[0]?.id || "";
    persistSelection();
    resetFollowupState();
  }

  if (!visibleProjects.length) {
    elements.projectSelect.innerHTML = '<option value="">未找到匹配项目</option>';
    elements.projectSelect.disabled = true;
    if (elements.projectStageText) {
      elements.projectStageText.textContent = "--";
    }
    return;
  }

  elements.projectSelect.disabled = state.busy;
  elements.projectSelect.innerHTML = visibleProjects
    .map(
      (project) => `
        <option value="${project.id}" ${project.id === state.selectedProjectId ? "selected" : ""}>
          ${escapeHtml(project.hospital.name)} · ${escapeHtml(project.stage.name)}
        </option>
      `,
    )
    .join("");

  if (elements.projectStageText) {
    elements.projectStageText.textContent = getSelectedProject()?.stage?.name || "--";
  }
}

function renderIntakeResult() {
  const supplementText = getSavedSupplementText();
  const supplementSavedAt = state.supplement.savedAt ? formatDateTime(state.supplement.savedAt) : "";
  const hasResult = Boolean(state.lastResult);
  const previewReady = isPreviewReadyForCurrentInput();
  const resultStale = hasResult && !previewReady;
  if (!state.lastResult) {
    elements.intakeResult.innerHTML = `
      <div class="result-empty">
        <p>本次结构化结果将在生成后展示于此。</p>
        <ul>
          <li>系统将通过 Responses API 提取科室、联系人、问题标签、阶段变化和下一步动作。</li>
          <li>如接口未配置或提取失败，生成或提交会直接返回错误信息。</li>
          <li>提交完成后，项目台账、任务中心与管理汇总会同步刷新。</li>
        </ul>
        ${
          supplementText
            ? `
              <div class="result-supplement">
                <div class="result-supplement-head-row">
                  <span class="result-supplement-head">补充编辑</span>
                  ${supplementSavedAt ? `<small>${escapeHtml(`已保存：${supplementSavedAt}`)}</small>` : ""}
                </div>
                <p>${escapeHtml(supplementText)}</p>
              </div>
            `
            : ""
        }
      </div>
    `;
    return;
  }

  const { extraction, extractionSource, extractionWarnings = [] } = state.lastResult;
  const reviewState = ensureIntakeReviewState(state.lastResult);
  const nextActions = Array.isArray(extraction.nextActions) ? extraction.nextActions : [];
  const contacts = Array.isArray(extraction.contacts) ? extraction.contacts : [];
  elements.intakeResult.innerHTML = `
    <div class="result-head">
      <span class="result-badge ${extractionSource === "responses-api" ? "is-responses" : "is-fallback"}">
        ${extractionSource === "responses-api" ? "结构化来源：Responses API" : "结构化来源：未知"}
      </span>
      ${resultStale ? '<span class="result-badge is-stale">当前结果待重新生成</span>' : ""}
      <span class="mini-meta">阶段更新：${escapeHtml(extraction.stageAfterUpdate || "--")}</span>
      <span class="mini-meta">管理关注：${extraction.managerAttentionNeeded ? "需要" : "无需"}</span>
    </div>
    <h3>本次结构化摘要</h3>
    <p class="result-summary">${escapeHtml(extraction.feedbackSummary || "暂无结构化摘要")}</p>
    <div class="result-grid">
      <div>
        <span>科室</span>
        <strong>${escapeHtml(extraction.department || "未识别")}</strong>
      </div>
    </div>
    <div class="token-row">${renderTagList(extraction.issues)}</div>
    <div class="result-block">
      <span>联系人</span>
      <p>${escapeHtml(contacts.map((item) => `${item.name}${item.role ? ` / ${item.role}` : ""}`).join("；") || "未识别")}</p>
    </div>
    <div class="result-block">
      <span>阻塞点</span>
      <p>${escapeHtml(extraction.blockers || "暂无")}</p>
    </div>
    <section class="result-review-section">
      <div class="result-review-section-head">
        <span>下一步</span>
        <small>可单项审阅</small>
      </div>
      ${
        extraction.nextStep
          ? `
            <ul class="result-review-list">
              ${renderIntakeReviewItem({
                label: "下一步",
                title: extraction.nextStep,
                meta: "取消或恢复后，仍保留在当前预览中。",
                cancelled: Boolean(reviewState?.nextStep?.cancelled),
                section: "next-step",
                itemId: "next-step",
              })}
            </ul>
          `
          : '<p class="result-review-empty">未提取到下一步计划。</p>'
      }
    </section>
    <section class="result-review-section">
      <div class="result-review-section-head">
        <span>待办动作</span>
        <small>${nextActions.length} 项</small>
      </div>
      ${
        nextActions.length
          ? `
            <ul class="result-review-list">
              ${nextActions
                .map((item, index) =>
                  renderIntakeReviewItem({
                    label: `待办动作 ${index + 1}`,
                    title: item.title,
                    meta: item.dueDate ? `截止：${item.dueDate}` : "未填写截止时间",
                    cancelled: Boolean(reviewState?.nextActions?.[index]?.cancelled),
                    section: "next-action",
                    itemId: reviewState?.nextActions?.[index]?.itemId || `next-action-${index}`,
                  }),
                )
                .join("")}
            </ul>
          `
          : '<p class="result-review-empty">未提取到待办动作。</p>'
      }
    </section>
    ${
      extractionWarnings.length
        ? `<div class="warning-box">${escapeHtml(extractionWarnings.join(" | "))}</div>`
        : ""
    }
    ${
      supplementText
        ? `
          <div class="result-supplement">
            <div class="result-supplement-head-row">
              <span class="result-supplement-head">补充编辑</span>
              ${supplementSavedAt ? `<small>${escapeHtml(`已保存：${supplementSavedAt}`)}</small>` : ""}
            </div>
            <p>${escapeHtml(supplementText)}</p>
          </div>
        `
        : ""
    }
    <div class="result-footer">
      <p class="result-footer-copy">${
        resultStale
          ? "补充内容已保存，当前结果已失效，请先重新生成。"
          : "结果已生成，提交按钮已下沉到这里。若继续修改原始记录，请先重新生成当前结果。"
      }</p>
      <div class="result-footer-actions">
        <button class="primary-button result-submit-button" type="button" data-intake-action="submit">提交纪要</button>
      </div>
    </div>
  `;
  renderIntakeSubmitButton();
}

function renderSignals() {
  const { signals } = state.bootstrap;
  elements.signalPanel.innerHTML = `
    ${renderSignalGroup("管理关注", signals.attentionProjects, "project")}
    ${renderSignalGroup("停滞医院", signals.stalledProjects, "project")}
    ${renderSignalGroup("逾期任务", signals.overdueTasks, "task")}
    <section class="signal-group">
      <h3>最近动态</h3>
      ${(signals.recentUpdates || [])
        .map(
          (update) => `
            <article class="signal-item is-plain">
              <strong>${escapeHtml(update.departmentName)}</strong>
              <p>${escapeHtml(update.feedbackSummary)}</p>
              <span>${escapeHtml(update.visitDate || formatDate(update.createdAt))}</span>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderProjectList() {
  elements.projectList.innerHTML = state.bootstrap.projects
    .map(
      (project) => `
        <button class="project-card ${project.id === state.selectedProjectId ? "is-active" : ""}" data-project-id="${project.id}" type="button">
          <div class="project-card-head">
            <div>
              <h3>${escapeHtml(project.hospital.name)}</h3>
              <p>${escapeHtml(project.hospital.city)} · ${escapeHtml(project.stage.name)}</p>
            </div>
            <span class="risk-pill risk-${project.riskLevel}">${escapeHtml(project.riskLevel)}</span>
          </div>
          <p class="project-summary">${escapeHtml(project.latestSummary || "暂无摘要")}</p>
          <div class="token-row">${renderTagList(project.issueNames)}</div>
          <div class="project-meta">
            <span
              class="remark-pill ${project.metrics.remarkCount ? "" : "is-empty"}"
              data-remark-focus-project="${project.id}"
              title="点击顺序定位到对应上级留言条目"
            >
              上级留言 ${formatRemarkRatio(project.metrics.remarkRepliedCount, project.metrics.remarkCount)}
            </span>
            <span>待办 ${project.metrics.openTaskCount}</span>
            <span>逾期 ${project.metrics.overdueTaskCount}</span>
            <span>${project.isStalled ? `停滞 ${project.stalledDays} 天` : `最近跟进 ${formatDate(project.lastFollowUpAt)}`}</span>
          </div>
        </button>
      `,
    )
    .join("");
}

function formatRiskLevelLabel(riskLevel) {
  const normalized = String(riskLevel || "").trim().toLowerCase();
  if (normalized === "high") {
    return "高风险";
  }
  if (normalized === "normal") {
    return "中风险";
  }
  if (normalized === "low") {
    return "低风险";
  }
  return normalized || "--";
}

function renderDetailMetricCard(label, value, meta) {
  return `
    <article class="detail-metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(meta || "")}</small>
    </article>
  `;
}

function renderDetailEmptyState(title, copy) {
  return `
    <article class="detail-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(copy)}</p>
    </article>
  `;
}

function getProjectTaskSortKey(task) {
  const timeValue = String(task?.dueAt || task?.completedAt || "").trim();
  if (!timeValue) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = new Date(timeValue);
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function getProjectDetailTasks(project) {
  const tasks = Array.isArray(project?.tasks)
    ? project.tasks.filter((task) => String(task?.effectiveStatus || "") !== "completed")
    : [];
  // Sort by actionable time first, then by stable textual fallbacks so repeated
  // expand/collapse and rerenders preserve the same order.
  return tasks.sort((left, right) => {
    const leftTime = getProjectTaskSortKey(left);
    const rightTime = getProjectTaskSortKey(right);
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    const titleDelta = String(left.title || "").localeCompare(String(right.title || ""), "zh-CN");
    if (titleDelta) {
      return titleDelta;
    }
    return String(left.id || "").localeCompare(String(right.id || ""), "zh-CN");
  });
}

function formatProjectTaskTime(task) {
  if (task?.dueAt) {
    return `截止 ${formatDate(task.dueAt)}`;
  }
  if (task?.completedAt) {
    return `完成 ${formatDate(task.completedAt)}`;
  }
  return "无时间字段";
}

function formatTaskStatusLabel(status) {
  const normalized = String(status || "").trim();
  if (normalized === "overdue") {
    return "逾期";
  }
  if (normalized === "blocked") {
    return "阻塞";
  }
  if (normalized === "in_progress") {
    return "进行中";
  }
  if (normalized === "completed") {
    return "已完成";
  }
  return "待办";
}

function renderProjectTaskList(project) {
  const tasks = getProjectDetailTasks(project);
  if (!tasks.length) {
    return '<p class="detail-task-empty">当前项目暂无待办任务。</p>';
  }

  return `
    <div class="detail-task-list" role="list" aria-label="当前项目任务列表">
      ${tasks
        .map(
          (task) => `
            <article class="detail-task-item" role="listitem">
              <div class="detail-task-item-head">
                <strong>${escapeHtml(task.title || "未命名任务")}</strong>
                <span class="detail-task-item-status status-${escapeHtml(task.effectiveStatus || "todo")}">${escapeHtml(formatTaskStatusLabel(task.effectiveStatus))}</span>
              </div>
              <p class="detail-task-item-copy">${escapeHtml(task.description || "暂无任务说明")}</p>
              <div class="detail-task-item-meta">
                <span>${escapeHtml(task.assigneeName || "--")}</span>
                <span>${escapeHtml(formatProjectTaskTime(task))}</span>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderProjectTaskMetricCard(project) {
  const expanded = state.projectDetailTaskListExpandedProjectId === project.id;
  const taskCount = Number(project?.metrics?.openTaskCount || 0);

  return `
    <article class="detail-metric-card detail-metric-card-expandable">
      <button
        class="detail-metric-toggle"
        type="button"
        data-project-task-toggle="true"
        data-project-id="${escapeHtml(project.id)}"
        aria-expanded="${expanded ? "true" : "false"}"
        aria-controls="projectDetailTaskList-${escapeHtml(project.id)}"
      >
        <span class="detail-metric-toggle-copy">
          <span>任务状态</span>
          <strong>${taskCount}个待办</strong>
        </span>
        <span class="detail-metric-toggle-icon ${expanded ? "is-expanded" : ""}" aria-hidden="true">▾</span>
      </button>
      <small>点击查看当前项目相关任务，按时间顺序显示。</small>
      <div
        class="detail-metric-expand-panel"
        id="projectDetailTaskList-${escapeHtml(project.id)}"
        ${expanded ? "" : "hidden"}
      >
        ${renderProjectTaskList(project)}
      </div>
    </article>
  `;
}

function renderProjectDetail() {
  const project = getSelectedProject();
  if (!project) {
    elements.projectDetail.innerHTML = "<p>暂无项目数据。</p>";
    return;
  }
  const canLeaveProjectRemarks = canCurrentUserLeaveProjectRemarks();
  const remarks = project.remarks || [];
  const contacts = project.contacts || [];
  const updates = project.updates || [];
  const remarksByUpdateId = new Map();
  for (const remark of remarks) {
    const key = String(remark.updateId || "");
    if (!key) {
      continue;
    }
    if (!remarksByUpdateId.has(key)) {
      remarksByUpdateId.set(key, []);
    }
    remarksByUpdateId.get(key).push(remark);
  }
  const unlinkedRemarks = remarks.filter((remark) => !remark.updateId);
  const regionLine = [project.region?.name, project.hospital?.city, project.hospital?.level].filter(Boolean).join(" · ");
  const nextActionText = project.nextAction || "待补充下一步计划";
  const projectHealthText = project.managerAttentionNeeded ? "需管理关注" : "常规推进";
  const progressText = project.isStalled
    ? `停滞 ${project.stalledDays} 天`
    : `最近跟进 ${formatDate(project.lastFollowUpAt)}`;
  elements.projectDetail.innerHTML = `
    <section class="detail-overview">
      <article class="detail-hero-card">
        <div class="detail-hero-head">
          <div class="detail-hero-copy-wrap">
            <p class="panel-eyebrow">${escapeHtml(regionLine || project.region?.name || "--")}</p>
            <h3>${escapeHtml(project.hospital.name)}</h3>
          </div>
          <div class="detail-pill-row">
            <span class="stage-pill">${escapeHtml(project.stage.name)}</span>
            <span class="risk-pill risk-${escapeHtml(project.riskLevel)}">${escapeHtml(formatRiskLevelLabel(project.riskLevel))}</span>
          </div>
        </div>
        <p class="detail-copy">${escapeHtml(project.latestSummary || "暂无推进摘要")}</p>
        <div class="token-row detail-token-row">${renderTagList(project.issueNames)}</div>
      </article>

      <article class="detail-action-card">
        <p class="panel-eyebrow">当前推进</p>
        <strong>${escapeHtml(nextActionText)}</strong>
        <p>${escapeHtml(projectHealthText)} · ${escapeHtml(progressText)}</p>
        <div class="detail-action-meta">
          <span>负责人 ${escapeHtml(project.owner?.name || "--")}</span>
          <span>上级留言 ${formatRemarkRatio(project.metrics.remarkRepliedCount, project.metrics.remarkCount)}</span>
        </div>
      </article>
    </section>

    <div class="detail-stats">
      ${renderDetailMetricCard("最近推进", formatDate(project.lastFollowUpAt), updates.length ? `${updates.length} 条更新` : "暂无更新")}
      ${renderDetailMetricCard("下一步截止", project.nextActionDueAt ? formatDate(project.nextActionDueAt) : "--", project.nextActionDueAt ? "请按计划推进" : "尚未设置截止时间")}
      ${renderProjectTaskMetricCard(project)}
      ${renderDetailMetricCard("上级留言", formatRemarkRatio(project.metrics.remarkRepliedCount, project.metrics.remarkCount), remarks.length ? `${remarks.length} 条上级留言` : "暂无上级留言")}
    </div>

    <section class="detail-board">
      <article class="detail-section detail-section-card">
        <div class="detail-section-head">
          <h4>关键联系人</h4>
          <span>${contacts.length} λ</span>
        </div>
        <div class="contact-list detail-contact-list">
          ${
            contacts.length
              ? contacts
                  .map(
                    (contact) => `
          <article class="contact-card detail-contact-card">
            <strong>${escapeHtml(contact.name)}</strong>
            <span>${escapeHtml(contact.roleTitle || "角色未填写")}</span>
            <small>${escapeHtml(contact.departmentName || "未填写科室")}</small>
          </article>
        `,
                  )
                  .join("")
              : renderDetailEmptyState("暂无关键联系人", "当前项目尚未录入关键联系人，后续新增纪要后会自动补充。")
          }
        </div>
      </article>

      <article class="detail-section detail-section-card">
        <div class="detail-section-head">
          <h4>项目看板</h4>
          <span>${escapeHtml(project.owner?.name || "--")}</span>
        </div>
        <div class="detail-note-grid">
          <article class="detail-note-card">
            <span>医院等级</span>
            <strong>${escapeHtml(project.hospital.level || "--")}</strong>
          </article>
          <article class="detail-note-card">
            <span>所在城市</span>
            <strong>${escapeHtml(project.hospital.city || "--")}</strong>
          </article>
          <article class="detail-note-card">
            <span>管理关注</span>
            <strong>${escapeHtml(projectHealthText)}</strong>
          </article>
          <article class="detail-note-card">
            <span>项目状态</span>
            <strong>${escapeHtml(project.isStalled ? `停滞 ${project.stalledDays} 天` : "持续推进中")}</strong>
          </article>
        </div>
      </article>
    </section>

    <section class="detail-section detail-section-card detail-section-timeline">
      <div class="detail-section-head">
        <h4>历史时间线</h4>
        <span>${updates.length ? `${updates.length} 条` : "暂无更新"}</span>
      </div>
      <div class="timeline detail-timeline">
        ${
          updates.length
            ? updates
                .map(
                  (update) => `
          <article class="timeline-item">
            <div class="timeline-top">
              <strong>${escapeHtml(update.departmentName || "未填写科室")}</strong>
              <span>${escapeHtml(update.visitDate || formatDate(update.createdAt))}</span>
            </div>
            <p>${escapeHtml(update.feedbackSummary || "暂无推进摘要")}</p>
            ${update.blockers ? `<small>阻塞：${escapeHtml(update.blockers)}</small>` : ""}
            ${renderTimelineRemarkRows(remarksByUpdateId.get(update.id) || [])}
          </article>
        `,
                )
                .join("")
            : renderDetailEmptyState("还没有历史时间线", "项目刚建立或尚未录入纪要，首条推进记录生成后会在这里沉淀。")
        }
      </div>
      ${
        canLeaveProjectRemarks
          ? `
            <div class="detail-section-footer">
              <button class="chip detail-section-action" type="button" data-create-project-remark="${escapeHtml(project.id)}">留言</button>
            </div>
          `
          : ""
      }
    </section>

    ${
      unlinkedRemarks.length
        ? `
          <section class="detail-section detail-section-card">
            <div class="detail-section-head">
              <h4>未关联纪要的上级留言</h4>
              <span>${unlinkedRemarks.length} 条</span>
            </div>
            <div class="remark-list">${renderTimelineRemarkRows(unlinkedRemarks)}</div>
          </section>
        `
        : ""
    }
  `;
}

function normalizeLedgerSubTab(rawValue) {
  return String(rawValue || "").trim().toLowerCase() === "detail" ? "detail" : "list";
}

function renderLedgerSubTabs() {
  const activeLedgerSubTab = normalizeLedgerSubTab(state.ledgerSubTab);
  state.ledgerSubTab = activeLedgerSubTab;

  const listTabButton = document.querySelector("[data-ledger-subtab='list']");
  const detailTabButton = document.querySelector("[data-ledger-subtab='detail']");
  const subtabCopy = document.querySelector("#ledgerSubtabCopy");
  const subtabCopyMap = {
    list: "按医院项目集中查看当前阶段、任务状态、问题标签与最新推进摘要",
    detail: "查看单个医院项目的关键联系人、历史更新、上级留言与当前推进计划",
  };

  for (const button of [listTabButton, detailTabButton]) {
    if (!button) {
      continue;
    }
    const isActive = button.dataset.ledgerSubtab === activeLedgerSubTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  }

  if (elements.projectList) {
    elements.projectList.hidden = activeLedgerSubTab !== "list";
  }
  if (elements.projectDetail) {
    elements.projectDetail.hidden = activeLedgerSubTab !== "detail";
  }
  if (subtabCopy) {
    subtabCopy.textContent = subtabCopyMap[activeLedgerSubTab];
  }
}

function renderTimelineRemarkRows(remarks) {
  if (!Array.isArray(remarks) || !remarks.length) {
    return "";
  }
  return `
    <div class="timeline-remark-list">
      <p class="timeline-remark-title">上级留言</p>
      ${remarks
        .map(
          (remark) => {
            const fromUserName = String(remark.fromUserName || "上级").trim();
            const replyContent = String(remark.replyContent || "").trim();
            const replyByUserName = String(remark.replyByUserName || "").trim();
            const readByUserName = String(remark.readByUserName || "").trim();
            const readAtText = remark.readAt ? formatDateTime(remark.readAt) : "";
            const remarkMeta = [
              fromUserName,
              remark.createdAt ? formatDateTime(remark.createdAt) : "",
            ]
              .filter(Boolean)
              .map((item) => `<span>${escapeHtml(item)}</span>`)
              .join("");
            const replyMeta = [
              replyByUserName ? `回复人：${replyByUserName}` : "已回复",
            ]
              .filter(Boolean)
              .map((item) => `<span>${escapeHtml(item)}</span>`)
              .join("");
            const readMetaText = remark.isRead
              ? [readByUserName ? `已读人：${readByUserName}` : "已读", readAtText].filter(Boolean).join(" · ")
              : "未读";
            const actionMarkup = replyContent
              ? '<span class="timeline-remark-action is-done">已回复，无法再次回复</span>'
              : `<button class="timeline-remark-action" type="button" data-remark-action="reply" data-remark-id="${remark.id}">回复</button>`;
            return `
              <article class="timeline-remark-item ${remark.id === state.activeRemarkId ? "is-active" : ""}" data-remark-id="${remark.id}">
                <div class="timeline-remark-head">
                  <div class="timeline-remark-meta">${remarkMeta}</div>
                  <div class="timeline-remark-state">
                    <span class="timeline-remark-badge ${replyContent ? "is-replied" : "is-pending"}">${replyContent ? "已回复" : "待回复"}</span>
                    <span class="timeline-remark-badge ${remark.isRead ? "is-read" : "is-unread"}">${remark.isRead ? "已读" : "未读"}</span>
                  </div>
                </div>
                <div class="timeline-remark-section">
                  <p class="timeline-remark-label">留言内容</p>
                  <p class="timeline-remark-content">${escapeHtml(remark.content || "--")}</p>
                </div>
                ${
                  replyContent
                    ? `
                      <div class="remark-reply timeline-remark-reply">
                        <span>回复记录</span>
                        <div class="timeline-remark-meta">${replyMeta}</div>
                        <p>${escapeHtml(replyContent)}</p>
                      </div>
                    `
                    : '<p class="remark-status is-pending">该条留言尚未回复，可从这里进入回复模式。</p>'
                }
                <div class="timeline-remark-foot">
                  <small class="timeline-remark-read">${escapeHtml(readMetaText)}</small>
                  <div class="timeline-remark-actions">
                    ${actionMarkup}
                    ${
                      remark.isRead
                        ? '<span class="timeline-remark-action is-done">已读</span>'
                        : `<button class="timeline-remark-action" type="button" data-remark-action="read" data-remark-id="${remark.id}">标记已读</button>`
                    }
                  </div>
                </div>
              </article>
            `;
          },
        )
        .join("")}
    </div>
  `;
}

async function createProjectRemark(projectId) {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return;
  }

  const project = state.bootstrap?.projects?.find((item) => item.id === normalizedProjectId) || null;
  if (!project) {
    showToast("未找到对应项目", "error");
    return;
  }

  const content = window.prompt(`请输入给“${project.hospital?.name || "当前项目"}”的留言内容`, "");
  if (content === null) {
    return;
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    showToast("留言内容不能为空", "warn");
    return;
  }

  setBusy(true);
  showToast("正在提交留言", "busy");
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(normalizedProjectId)}/remarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmedContent }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.bootstrap = payload.bootstrap;
    state.selectedProjectId = normalizedProjectId;
    state.activeRemarkId = payload.remark?.id || "";
    ensureSelection();
    renderAll();

    requestAnimationFrame(() => {
      const selectorId = escapeSelectorValue(state.activeRemarkId);
      const target = selectorId ? document.querySelector(`[data-remark-id="${selectorId}"]`) : null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    showToast("留言已提交", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "留言提交失败", "error");
  } finally {
    setBusy(false);
  }
}

function findRemarkFromBootstrap(remarkId) {
  const normalizedRemarkId = String(remarkId || "");
  if (!normalizedRemarkId || !state.bootstrap?.projects?.length) {
    return null;
  }
  for (const project of state.bootstrap.projects) {
    const remarks = project.remarks || [];
    const matched = remarks.find((item) => item.id === normalizedRemarkId);
    if (matched) {
      return { project, remark: matched };
    }
  }
  return null;
}

function clearSupplementContext() {
  state.supplement.remarkId = "";
  state.supplement.updateId = "";
  state.supplement.sourceText = "";
  state.supplement.sourceDate = "";
  state.supplement.sourceDepartment = "";
  state.supplement.savedText = "";
  state.supplement.draftText = "";
  state.supplement.savedAt = "";
  state.supplement.dialogOpen = false;
  state.supplement.syncedReplyText = "";
  state.supplement.replySynced = false;
}

function startSupplementFromRemark(remarkId) {
  const matched = findRemarkFromBootstrap(remarkId);
  if (!matched) {
    showToast("未找到对应留言", "error");
    return;
  }

  const { project, remark } = matched;
  const update = (project.updates || []).find((item) => item.id === remark.updateId) || null;

  state.selectedProjectId = project.id;
  state.activeTab = "entry";
  state.activeRemarkId = remark.id;
  state.supplement.remarkId = remark.id;
  state.supplement.updateId = remark.updateId || "";
  state.supplement.sourceText = remark.content || "";
  state.supplement.sourceDate = update?.visitDate || "";
  state.supplement.sourceDepartment = update?.departmentName || "";
  state.supplement.savedText = "";
  state.supplement.draftText = "";
  state.supplement.savedAt = "";
  state.supplement.dialogOpen = false;
  state.supplement.syncedReplyText = String(remark.replyContent || "").trim();
  state.supplement.replySynced = Boolean(remark.replyContent);
  persistSelection();
  persistActiveTab();

  applyVisitDatePresetFromDate(update?.visitDate || "");
  elements.noteInput.value = String(remark.replyContent || "").trim();
  invalidateIntakePreview();
  resetFollowupState();
  renderAll();
  elements.noteInput.focus();
  showToast("已切换到备注回复模式，请填写回复内容", "ready");
}

function openSupplementDialog() {
  if (state.busy || state.followup.busy) {
    return;
  }
  state.supplement.dialogOpen = true;
  elements.supplementDialog.hidden = false;
  state.supplement.draftText = getSavedSupplementText();
  if (elements.supplementDialogTextarea) {
    elements.supplementDialogTextarea.value = state.supplement.draftText;
    elements.supplementDialogTextarea.focus();
    elements.supplementDialogTextarea.select();
  }
  renderSupplementDialog();
}

function closeSupplementDialog(options = {}) {
  if (!options.force && (state.busy || state.followup.busy)) {
    return;
  }
  state.supplement.dialogOpen = false;
  if (elements.supplementDialog) {
    elements.supplementDialog.hidden = true;
  }
  renderSupplementDialog();
}

function saveSupplementDraft() {
  if (!state.supplement.dialogOpen || state.busy || state.followup.busy) {
    return;
  }
  const draftText = String((elements.supplementDialogTextarea?.value ?? state.supplement.draftText) || "").trim();
  const previousText = String(state.supplement.savedText || "").trim();
  const changed = draftText !== previousText;
  if (changed) {
    state.supplement.savedText = draftText;
    state.supplement.savedAt = new Date().toISOString();
  }
  state.supplement.dialogOpen = false;
  if (elements.supplementDialog) {
    elements.supplementDialog.hidden = true;
  }
  if (changed) {
    invalidateIntakePreview({ preserveResult: true });
  }
  renderAll();
  showToast(
    changed
      ? draftText
        ? "补充内容已保存，请重新生成纪要"
        : "补充内容已清空，请重新生成纪要"
      : "补充内容未变化",
    changed ? "ready" : "info",
  );
}

function renderSupplementDialog() {
  if (!elements.supplementDialog) {
    return;
  }
  elements.supplementDialog.hidden = !state.supplement.dialogOpen;
  if (!state.supplement.dialogOpen) {
    return;
  }
  const isReplyMode = Boolean(state.supplement.remarkId);
  if (elements.supplementDialogTitle) {
    elements.supplementDialogTitle.textContent = isReplyMode ? "补充编辑（回复）" : "补充编辑";
  }
  if (elements.supplementDialogCopy) {
    elements.supplementDialogCopy.textContent = isReplyMode
      ? "补充内容会并入本次回复纪要的下一次生成。保存后当前回复摘要会失效，需要重新生成"
      : "补充内容会并入普通纪要的下一次生成。保存后当前结果会失效，需要重新生成";
  }
  if (elements.supplementDialogTextarea && elements.supplementDialogTextarea.value !== state.supplement.draftText) {
    elements.supplementDialogTextarea.value = state.supplement.draftText;
  }
  if (elements.supplementDialogSubmitButton) {
    elements.supplementDialogSubmitButton.disabled = state.busy || state.followup.busy;
  }
  if (elements.supplementDialogCancelButton) {
    elements.supplementDialogCancelButton.disabled = state.busy || state.followup.busy;
  }
  if (elements.supplementDialogCloseButton) {
    elements.supplementDialogCloseButton.disabled = state.busy || state.followup.busy;
  }
  if (elements.supplementDialogTextarea) {
    elements.supplementDialogTextarea.disabled = state.busy || state.followup.busy;
  }
}

async function markProjectRemarkAsRead(remarkId) {
  setBusy(true);
  showToast("正在标记留言已读", "busy");
  try {
    const response = await fetch(`/api/project-remarks/${remarkId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.bootstrap = payload.bootstrap;
    state.activeRemarkId = payload.remark?.id || remarkId;
    ensureSelection();
    renderAll();
    showToast("已标记为已读", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "标记已读失败", "error");
  } finally {
    setBusy(false);
  }
}

async function ensureSupplementRemarkReply(note) {
  if (!state.supplement.remarkId) {
    return;
  }
  const reply = String(note || "").trim();
  if (!reply) {
    throw new Error("请先填写回复内容，再生成回复纪要");
  }
  if (state.supplement.replySynced && reply === state.supplement.syncedReplyText) {
    return;
  }

  const response = await fetch(`/api/project-remarks/${state.supplement.remarkId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  state.bootstrap = payload.bootstrap;
  state.activeRemarkId = state.supplement.remarkId;
  state.supplement.syncedReplyText = reply;
  state.supplement.replySynced = true;
  ensureSelection();
  renderAll();
}

function focusNextProjectRemark(projectId) {
  const normalizedProjectId = String(projectId || "");
  const project =
    state.bootstrap?.projects.find((item) => item.id === normalizedProjectId) || null;
  if (!project) {
    return;
  }
  if (!(project.remarks || []).length) {
    showToast("当前项目暂无留言", "warn");
    return;
  }

  state.selectedProjectId = normalizedProjectId;
  state.ledgerSubTab = "detail";
  persistSelection();
  persistLedgerSubTab();

  const remarks = project.remarks || [];
  const total = remarks.length;
  const currentCursor = Number(state.remarkCursorByProject[normalizedProjectId] || 0);
  const nextIndex = ((currentCursor % total) + total) % total;
  const nextRemark = remarks[nextIndex];
  state.remarkCursorByProject[normalizedProjectId] = nextIndex + 1;
  state.activeRemarkId = nextRemark.id;
  renderAll();

  requestAnimationFrame(() => {
    const selectorId = escapeSelectorValue(nextRemark.id);
    const target = document.querySelector(`[data-remark-id="${selectorId}"]`);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderTaskBoard() {
  const groups = [
    ["overdue", "已逾期"],
    ["in_progress", "处理中"],
    ["todo", "待处理"],
    ["completed", "已完成"],
  ];

  elements.taskBoard.innerHTML = groups
    .map(([key, label]) => {
      const tasks = state.bootstrap.tasks.filter((task) => task.effectiveStatus === key);
      return `
        <section class="task-column">
          <div class="task-column-head">
            <h3>${label}</h3>
            <span>${tasks.length}</span>
          </div>
          <div class="task-list">
            ${tasks.length ? tasks.map((task) => renderTaskCard(task)).join("") : "<p class=\"empty-copy\">暂无任务</p>"}
          </div>
        </section>
      `;
    })
    .join("");
}

function normalizeInsightSubTab(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "recent" || value === "management" || value === "summary") {
    return value;
  }
  return "summary";
}

function renderInsights() {
  const { dashboard, signals, management } = state.bootstrap;
  const canManageUsers = Boolean(
    management?.canManageUsers || normalizeUserRole(state.bootstrap?.currentUser?.role) === "manager",
  );
  const canManageBackups = Boolean(
    management?.canManageBackups ||
      state.bootstrap?.capabilities?.canManageBackups ||
      state.bootstrap?.currentUser?.isBackupAdmin,
  );
  const activeInsightSubTab = normalizeInsightSubTab(state.insightSubTab);
  state.insightSubTab = activeInsightSubTab;
  if (activeInsightSubTab === "management" && canManageBackups && !state.backups.loaded && !state.backups.busy) {
    void loadBackups(false);
  }

  const subTabs = [
    { id: "summary", label: "管理汇总" },
    { id: "recent", label: "最近动态" },
    { id: "management", label: "三级管理" },
  ];

  const summaryContent = `
    <section class="insight-section">
      <h3>管理汇总</h3>
      <p class="section-copy">按阶段分布与高频问题汇总当前项目状态。</p>
      <section class="insight-sub-section">
        <h4>阶段分布</h4>
        ${dashboard.stageDistribution.map((item) => renderBarRow(item.label, item.value, dashboard.totalProjects)).join("")}
      </section>
      <section class="insight-sub-section">
        <h4>高频问题</h4>
        <div class="token-row">${renderTagList(dashboard.issueDistribution.map((item) => `${item.label} ${item.value}`))}</div>
      </section>
    </section>
  `;

  const recentUpdates = signals?.recentUpdates || [];
  const recentContent = `
    <section class="insight-section">
      <h3>最近动态</h3>
      <p class="section-copy">按最近纪要查看医院推进情况，可直接进入对应医院台账详情。</p>
      ${
        recentUpdates.length
          ? recentUpdates
              .map(
                (update) => `
        <article class="insight-note">
          <div class="insight-note-head">
            <div class="insight-note-copy">
              <strong>${escapeHtml(update.departmentName)}</strong>
              <span class="insight-note-hospital">${escapeHtml(resolveUpdateHospitalName(update))}</span>
            </div>
            <button class="chip insight-note-enter" type="button" data-focus-project="${escapeHtml(update.projectId)}">进入</button>
          </div>
          <p>${escapeHtml(update.feedbackSummary)}</p>
          <div class="insight-note-meta">
            <span>${escapeHtml(update.visitDate || formatDate(update.createdAt))}</span>
          </div>
        </article>
      `,
              )
              .join("")
          : '<p class="empty-copy">暂无最近动态。</p>'
      }
    </section>
  `;

  const managementContent = `
    <section class="insight-section">
      <h3>三级管理</h3>
      <div class="management-level-grid">
        ${(management?.levels || []).map((level) => `
          <article class="management-level-card">
            <span>${escapeHtml(level.name)}</span>
            <strong>${Number(level.count) || 0}</strong>
          </article>
        `).join("")}
      </div>
      <div class="management-user-list">
        ${
          (management?.visibleUsers || []).length
            ? management.visibleUsers
                .map((user) => renderManagementUserItem(user, canManageUsers))
                .join("")
            : '<p class="empty-copy">暂无可见成员</p>'
        }
      </div>
      ${renderBackupAdminPanel(canManageBackups)}
    </section>
  `;

  let subTabContent = summaryContent;
  if (activeInsightSubTab === "recent") {
    subTabContent = recentContent;
  } else if (activeInsightSubTab === "management") {
    subTabContent = managementContent;
  }

  elements.insightPanel.innerHTML = `
    <div class="insight-subtab-bar" role="tablist" aria-label="汇总子导航">
      ${subTabs
        .map(
          (tab) => `
        <button
          class="chip insight-subtab-button${tab.id === activeInsightSubTab ? " is-active" : ""}"
          type="button"
          role="tab"
          data-insight-subtab="${tab.id}"
          aria-selected="${tab.id === activeInsightSubTab ? "true" : "false"}"
        >${escapeHtml(tab.label)}</button>
      `,
        )
        .join("")}
    </div>
    ${subTabContent}
  `;
}

function normalizeUserRole(rawRole) {
  const role = String(rawRole || "").trim().toLowerCase();
  if (
    role === "manager" ||
    role === "regional_manager" ||
    role === "district_manager" ||
    role === "director" ||
    role === "vp"
  ) {
    return "manager";
  }
  if (role === "supervisor") {
    return "supervisor";
  }
  return "specialist";
}

function isCurrentUserManager() {
  return normalizeUserRole(state.bootstrap?.currentUser?.role) === "manager";
}

function isCurrentUserBackupAdmin() {
  return Boolean(
    state.bootstrap?.currentUser?.isBackupAdmin || state.bootstrap?.capabilities?.canManageBackups,
  );
}

function canCurrentUserLeaveProjectRemarks() {
  const role = normalizeUserRole(state.bootstrap?.currentUser?.role);
  return role === "manager" || role === "supervisor";
}

function formatBackupSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function renderBackupAdminPanel(canManageBackups) {
  if (!canManageBackups) {
    return "";
  }
  const backups = state.backups.list || [];
  const availableDates = state.backups.availableDates || [];
  const selectedDate =
    availableDates.includes(state.backups.selectedDate) ? state.backups.selectedDate : availableDates[0] || "";
  const backupsForDate = selectedDate ? backups.filter((item) => item.date === selectedDate) : [];
  const maxBackups = state.backups.maxBackups || 30;
  const schedule = state.backups.policy?.schedule || {};
  const scheduler = state.backups.scheduler || {};
  const scheduleText = formatBackupSchedule(schedule);
  const lastRunText = scheduler.lastRunAt ? formatDateTime(scheduler.lastRunAt) : "--";
  const nextRunText = scheduler.nextRunAt ? formatDateTime(scheduler.nextRunAt) : "--";
  const actionDisabled = state.backups.busy || state.busy || state.auth.busy;
  const timeValue = `${String(Number(schedule.hour) || 0).padStart(2, "0")}:${String(
    Number(schedule.minute) || 0,
  ).padStart(2, "0")}`;
  const frequency = String(schedule.frequency || "daily");
  const weekday = Number.isInteger(Number(schedule.weekday)) ? Number(schedule.weekday) : 1;
  const weekdayOptions = [0, 1, 2, 3, 4, 5, 6]
    .map(
      (value) =>
        `<option value="${value}"${value === weekday ? " selected" : ""}>${escapeHtml(formatWeekday(value))}</option>`,
    )
    .join("");
  const dateOptions = availableDates
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selectedDate ? " selected" : ""}>${escapeHtml(value)}</option>`,
    )
    .join("");

  return `
    <section class="backup-panel">
      <div class="backup-panel-head">
        <div>
          <h4>数据备份</h4>
          <p class="backup-copy">${escapeHtml(scheduleText)}，最多保留 ${maxBackups} 份，当前 ${backups.length} 份。</p>
          <p class="backup-meta">上次执行：${lastRunText} · 下次执行：${nextRunText}</p>
        </div>
        <button class="chip" type="button" data-backup-action="create" ${actionDisabled ? "disabled" : ""}>立即备份</button>
      </div>
      ${
        state.backups.error
          ? `<p class="backup-error">${escapeHtml(state.backups.error)}</p>`
          : ""
      }
      <div class="backup-schedule-form">
        <label class="backup-field">
          <span>备份频率</span>
          <select data-backup-frequency ${actionDisabled ? "disabled" : ""}>
            <option value="daily"${frequency === "daily" ? " selected" : ""}>每天</option>
            <option value="weekly"${frequency === "weekly" ? " selected" : ""}>每周</option>
          </select>
        </label>
        <label class="backup-field">
          <span>执行时间</span>
          <input type="time" data-backup-time value="${timeValue}" ${actionDisabled ? "disabled" : ""} />
        </label>
        <label class="backup-field">
          <span>每周执行日</span>
          <select data-backup-weekday ${actionDisabled || frequency !== "weekly" ? "disabled" : ""}>
            ${weekdayOptions}
          </select>
        </label>
        <button class="chip" type="button" data-backup-action="save-schedule" ${actionDisabled ? "disabled" : ""}>保存计划</button>
      </div>
      <div class="backup-restore-bar">
        <label class="backup-field">
          <span>恢复日期</span>
          <select data-backup-date-select ${actionDisabled || !availableDates.length ? "disabled" : ""}>
            ${dateOptions || '<option value="">暂无可恢复日期</option>'}
          </select>
        </label>
        <button class="chip" type="button" data-backup-action="restore-date" ${actionDisabled || !selectedDate ? "disabled" : ""}>恢复所选日期最新备份</button>
      </div>
      <div class="backup-list">
        ${
          backupsForDate.length
            ? backupsForDate
                .map(
                  (item) => `
              <article class="backup-item">
                <div class="backup-item-main">
                  <strong>${formatDateTime(item.createdAt)}</strong>
                  <span>${item.trigger === "auto" ? "自动备份" : "手动备份"} · ${formatBackupSize(item.sizeBytes)}</span>
                </div>
                <span class="backup-item-tag">${escapeHtml(item.fileName)}</span>
              </article>
            `,
                )
                .join("")
            : `<p class="empty-copy">${state.backups.busy ? "备份列表加载中..." : "所选日期暂无备份记录"}</p>`
        }
      </div>
    </section>
  `;
}

function formatBackupSchedule(schedule) {
  const frequency = String(schedule?.frequency || "daily");
  const hour = String(Number(schedule?.hour) || 0).padStart(2, "0");
  const minute = String(Number(schedule?.minute) || 0).padStart(2, "0");
  if (frequency === "weekly") {
    return `每周 ${formatWeekday(schedule?.weekday)} ${hour}:${minute} 自动备份`;
  }
  return `每天 ${hour}:${minute} 自动备份`;
}

function formatWeekday(value) {
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const index = Number(value);
  return labels[index] || "周一";
}

function renderManagementUserItem(user, canManageUsers) {
  const safeUserId = escapeHtml(user.id || "");
  const roleName = escapeHtml(user.roleName || user.role || "--");
  const regionName = escapeHtml(user.regionName || "--");
  const regions = getAvailableRegions();
  if (!canManageUsers || !regions.length) {
    return `
      <article class="management-user-item">
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <span>${roleName}</span>
        </div>
        <span>${regionName}</span>
      </article>
    `;
  }

  const options = regions
    .map((region) => {
      const regionId = String(region.id || "");
      const selected = regionId === String(user.regionId || "") ? " selected" : "";
      return `<option value="${escapeHtml(regionId)}"${selected}>${escapeHtml(region.name || regionId || "--")}</option>`;
    })
    .join("");

  return `
    <article class="management-user-item">
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <span>${roleName}</span>
      </div>
      <div class="management-user-actions">
        <select data-management-region-select="${safeUserId}">${options}</select>
        <button class="chip" type="button" data-management-action="save-region" data-user-id="${safeUserId}">保存区域</button>
      </div>
    </article>
  `;
}

function renderTaskCard(task) {
  const actions = [];
  if (task.status !== "in_progress" && task.status !== "completed") {
    actions.push(`<button type="button" data-task-id="${task.id}" data-task-status="in_progress">开始处理</button>`);
  }
  if (task.status !== "completed") {
    actions.push(`<button type="button" data-task-id="${task.id}" data-task-status="completed">标记完成</button>`);
  }
  if (task.status === "completed") {
    actions.push(`<button type="button" data-task-id="${task.id}" data-task-status="todo">转为待处理</button>`);
  }

  return `
    <article class="task-card ${task.effectiveStatus}">
      <div class="task-card-top">
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(task.hospitalName)}</span>
      </div>
      <p>${escapeHtml(task.description || "")}</p>
      <div class="task-meta">
        <span>${escapeHtml(task.assigneeName)}</span>
        <span>${task.dueAt ? formatDate(task.dueAt) : "无截止时间"}</span>
      </div>
      <div class="task-actions">${actions.join("")}</div>
    </article>
  `;
}

function renderSignalGroup(title, items, mode) {
  return `
    <section class="signal-group">
      <h3>${escapeHtml(title)}</h3>
      ${(items || []).length ? items.map((item) => {
        if (mode === "task") {
          return `<article class="signal-item is-plain"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.hospitalName)}</p><span>${item.dueAt ? formatDate(item.dueAt) : "无截止时间"}</span></article>`;
        }
        return `<button class="signal-item" type="button" data-focus-project="${item.id}"><strong>${escapeHtml(item.hospital.name)}</strong><p>${escapeHtml(item.latestSummary || item.blockers || "需要查看详情")}</p><span>${escapeHtml(item.stage.name)}</span></button>`;
      }).join("") : "<p class=\"empty-copy\">暂无信号</p>"}
    </section>
  `;
}

function renderBarRow(label, value, total) {
  const width = total ? Math.max(10, Math.round((value / total) * 100)) : 0;
  return `
    <div class="bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="bar-track"><i style="width:${width}%"></i></div>
      <strong>${value}</strong>
    </div>
  `;
}

function renderTagList(items) {
  return (items || []).length
    ? items.map((item) => `<span class="token">${escapeHtml(item)}</span>`).join("")
    : '<span class="token is-muted">无问题标签</span>';
}

function getSelectedProject() {
  return state.bootstrap?.projects.find((project) => project.id === state.selectedProjectId) || null;
}

function applyHealthState(health) {
  document.title = health.configured ? "AI 医院导入管理系统" : "AI 医院导入管理系统 · 接口未配置";
}

function setBusy(isBusy) {
  state.busy = isBusy;
  elements.submitButton.disabled = isBusy;
  elements.noteInput.disabled = isBusy;
  elements.projectSelect.disabled = isBusy || !getVisibleProjects().length;
  if (elements.projectSearchInput) {
    elements.projectSearchInput.disabled = isBusy;
  }
  if (elements.projectSearchButton) {
    elements.projectSearchButton.disabled = isBusy;
  }
  if (elements.projectAddButton) {
    elements.projectAddButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.projectModalCloseButton) {
    elements.projectModalCloseButton.disabled = isBusy;
  }
  if (elements.newProjectSubmitButton) {
    elements.newProjectSubmitButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.newHospitalNameInput) {
    elements.newHospitalNameInput.disabled = isBusy;
  }
  if (elements.newHospitalCityInput) {
    elements.newHospitalCityInput.disabled = isBusy;
  }
  if (elements.aiFollowupButton) {
    elements.aiFollowupButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.historyInfoButton) {
    elements.historyInfoButton.disabled = isBusy || state.followup.busy || state.historyInfo.busy;
  }
  if (elements.followupDialogSubmitButton) {
    elements.followupDialogSubmitButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.followupDialogCloseButton) {
    elements.followupDialogCloseButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.followupDialogCancelButton) {
    elements.followupDialogCancelButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.historyInfoDialogCloseButton) {
    elements.historyInfoDialogCloseButton.disabled = isBusy || state.historyInfo.busy;
  }
  if (elements.historyInfoDialogRefreshButton) {
    elements.historyInfoDialogRefreshButton.disabled = isBusy || state.historyInfo.busy;
  }
  if (elements.logoutButton) {
    elements.logoutButton.disabled = isBusy || !state.authToken || state.auth.busy;
  }
  if (elements.authLoginSubmitButton) {
    elements.authLoginSubmitButton.disabled = isBusy || state.auth.busy;
  }
  if (elements.authRegisterSubmitButton) {
    elements.authRegisterSubmitButton.disabled = isBusy || state.auth.busy;
  }
  renderFollowupDialog();
  renderSupplementDialog();
  renderHistoryInfoDialog();
  renderIntakeSubmitButton();
  renderAuthState();
}

function resolveUpdateHospitalName(update) {
  const directName = String(update?.hospitalName || "").trim();
  if (directName) {
    return directName;
  }
  const projectId = String(update?.projectId || "").trim();
  const project = state.bootstrap?.projects?.find((item) => item.id === projectId) || null;
  return project?.hospital?.name || "未关联医";
}

function openProjectLedgerDetail(projectId) {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return;
  }

  state.selectedProjectId = normalizedProjectId;
  state.activeTab = "ledger";
  state.ledgerSubTab = "detail";
  state.activeRemarkId = "";
  clearSupplementContext();
  persistSelection();
  persistActiveTab();
  persistLedgerSubTab();
  resetFollowupState();
  resetHistoryInfoState();
  renderAll();
}

function persistSelection() {
  localStorage.setItem(STORAGE_KEY, state.selectedProjectId || "");
}

function persistActiveTab() {
  localStorage.setItem(ACTIVE_TAB_KEY, state.activeTab || "entry");
}

function persistInsightSubTab() {
  localStorage.setItem(INSIGHT_SUBTAB_KEY, normalizeInsightSubTab(state.insightSubTab));
}

function persistLedgerSubTab() {
  localStorage.setItem(LEDGER_SUBTAB_KEY, normalizeLedgerSubTab(state.ledgerSubTab));
}

function renderSessionBar() {
  const currentUser = state.bootstrap?.currentUser || null;
  if (!currentUser || !state.authToken) {
    elements.sessionUserName.textContent = "未登";
    elements.sessionUserRole.textContent = "请先登录后继续使";
    elements.logoutButton.disabled = true;
    return;
  }
  elements.sessionUserName.textContent = currentUser.name || "未命名用";
  const roleText = currentUser.roleName || currentUser.role || "--";
  elements.sessionUserRole.textContent = `${roleText} · ${currentUser.regionName || "--"}`;
  elements.logoutButton.disabled = state.busy || state.auth.busy;
}

function getAvailableRegions() {
  const fromBootstrap = state.bootstrap?.lookups?.regions;
  if (Array.isArray(fromBootstrap) && fromBootstrap.length) {
    return fromBootstrap;
  }
  if (Array.isArray(state.authOptions.regions) && state.authOptions.regions.length) {
    return state.authOptions.regions;
  }
  return [];
}

function renderAuthRegionOptions() {
  if (!elements.authRegisterRegionSelect) {
    return;
  }
  const regions = getAvailableRegions();
  const previousValue = String(elements.authRegisterRegionSelect.value || "").trim();
  if (!regions.length) {
    elements.authRegisterRegionSelect.innerHTML = "";
    elements.authRegisterRegionSelect.disabled = true;
    return;
  }

  elements.authRegisterRegionSelect.innerHTML = regions
    .map(
      (region) =>
        `<option value="${escapeHtml(region.id || "")}">${escapeHtml(region.name || region.id || "--")}</option>`,
    )
    .join("");

  const nextValue = regions.some((region) => String(region.id || "") === previousValue)
    ? previousValue
    : String(regions[0]?.id || "");
  elements.authRegisterRegionSelect.value = nextValue;
  elements.authRegisterRegionSelect.disabled = state.busy || state.auth.busy;
}

function renderAuthState() {
  const showAuthDialog = state.auth.dialogOpen;
  const isLoginMode = state.auth.mode === "login";
  elements.authDialog.hidden = !showAuthDialog;
  elements.authLoginForm.hidden = !isLoginMode;
  elements.authRegisterForm.hidden = isLoginMode;
  elements.authModeLoginButton.classList.toggle("is-active", isLoginMode);
  elements.authModeRegisterButton.classList.toggle("is-active", !isLoginMode);
  elements.authModeLoginButton.disabled = state.auth.busy;
  elements.authModeRegisterButton.disabled = state.auth.busy;
  elements.authDialogCloseButton.disabled = state.auth.busy;
  renderAuthRegionOptions();
  elements.authLogoutInsideButton.hidden = !state.authToken;
  elements.authLogoutInsideButton.disabled = state.auth.busy || !state.authToken;
  if (elements.authDialogTitle) {
    elements.authDialogTitle.textContent = isLoginMode ? "账号登录" : "账号注册";
  }
  if (elements.authDialogCopy) {
    elements.authDialogCopy.textContent = isLoginMode
      ? "请输入账号和密码登录系统"
      : "创建新账号后自动登录，支持三级角色：经理、主管、专员";
  }
  if (elements.authFeedback) {
    const message = String(state.auth.feedback?.message || "").trim();
    if (!message) {
      elements.authFeedback.hidden = true;
      elements.authFeedback.textContent = "";
      elements.authFeedback.className = "auth-feedback";
    } else {
      elements.authFeedback.hidden = false;
      elements.authFeedback.textContent = message;
      const tone = String(state.auth.feedback?.tone || "");
      elements.authFeedback.className = "auth-feedback";
      if (tone) {
        elements.authFeedback.classList.add(`is-${tone}`);
      }
    }
  }
  if (elements.appShell) {
    elements.appShell.classList.toggle("is-auth-locked", showAuthDialog);
  }
}

function switchAuthMode(mode) {
  if (state.auth.busy) {
    return;
  }
  state.auth.mode = mode === "register" ? "register" : "login";
  clearAuthFeedback();
  renderAuthState();
}

function openAuthDialog(mode = "login", options = {}) {
  state.auth.mode = mode === "register" ? "register" : "login";
  state.auth.dialogOpen = true;
  if (!options.preserveFeedback) {
    clearAuthFeedback();
  }
  renderAuthState();
}

function closeAuthDialog() {
  state.auth.dialogOpen = false;
  clearAuthFeedback();
  renderAuthState();
}

function setAuthBusy(isBusy) {
  state.auth.busy = isBusy;
  renderAuthState();
  setBusy(state.busy);
}

function setAuthFeedback(message, tone = "warn") {
  state.auth.feedback = {
    tone: String(tone || ""),
    message: String(message || "").trim(),
  };
  renderAuthState();
}

function clearAuthFeedback() {
  state.auth.feedback = { tone: "", message: "" };
}

async function submitLogin() {
  if (state.auth.busy) {
    return;
  }
  const account = String(elements.authLoginAccountInput.value || "").trim();
  const password = String(elements.authLoginPasswordInput.value || "").trim();
  if (!account || !password) {
    setAuthFeedback("请输入账号和密码", "warn");
    return;
  }

  setAuthBusy(true);
  setAuthFeedback("正在登录，请稍候", "busy");
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.authToken = payload.token || "";
    localStorage.setItem(AUTH_TOKEN_KEY, state.authToken);
    state.bootstrap = payload.bootstrap || null;
    ensureSelection();
    renderAll();
    elements.authLoginPasswordInput.value = "";
    if (payload.bootstrap?.health) {
      applyHealthState(payload.bootstrap.health);
    }
    setAuthFeedback("登录成功，正在进入系统", "ready");
    closeAuthDialog();
    showToast("登录成功", "ready");
  } catch (error) {
    setAuthFeedback(error instanceof Error ? error.message : "登录失败，请重试", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function submitRegister() {
  if (state.auth.busy) {
    return;
  }
  const name = String(elements.authRegisterNameInput.value || "").trim();
  const account = String(elements.authRegisterAccountInput.value || "").trim();
  const password = String(elements.authRegisterPasswordInput.value || "").trim();
  const role = String(elements.authRegisterRoleSelect.value || "specialist").trim();
  const regionId = String(elements.authRegisterRegionSelect.value || "").trim();
  if (!name || !account || !password) {
    setAuthFeedback("请完整填写注册信息", "warn");
    return;
  }
  if (!regionId) {
    setAuthFeedback("请选择所属区域", "warn");
    return;
  }

  setAuthBusy(true);
  setAuthFeedback("正在注册，请稍候", "busy");
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, account, password, role, regionId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.authToken = payload.token || "";
    localStorage.setItem(AUTH_TOKEN_KEY, state.authToken);
    state.bootstrap = payload.bootstrap || null;
    ensureSelection();
    renderAll();
    elements.authRegisterPasswordInput.value = "";
    if (payload.bootstrap?.health) {
      applyHealthState(payload.bootstrap.health);
    }
    setAuthFeedback("注册成功，正在进入系统", "ready");
    closeAuthDialog();
    showToast("注册并登录成", "ready");
  } catch (error) {
    setAuthFeedback(error instanceof Error ? error.message : "注册失败，请重试", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function logout() {
  if (!state.authToken || state.auth.busy || state.busy) {
    return;
  }
  setAuthBusy(true);
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    handleUnauthorized("已退出登录，请重新登录");
    showToast("已退出登录", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "退出登录失败", "error");
  } finally {
    setAuthBusy(false);
  }
}

function handleUnauthorized(message = "登录已失效，请重新登录") {
  state.authToken = "";
  localStorage.removeItem(AUTH_TOKEN_KEY);
  state.bootstrap = null;
  state.lastResult = null;
  state.intakePreviewFingerprint = "";
  clearSupplementContext();
  resetFollowupState();
  resetHistoryInfoState();
  resetBackupState();
  renderSessionBar();
  setAuthFeedback(message, "warn");
  openAuthDialog("login", { preserveFeedback: true });
}

function showToast(message, tone = "ready") {
  if (!elements.toast) {
    return;
  }

  clearTimeout(showToast.timer);
  elements.toast.hidden = false;
  elements.toast.textContent = message;
  elements.toast.className = "toast";
  elements.toast.classList.add(`is-${tone}`);

  if (tone === "busy") {
    return;
  }

  showToast.timer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2200);
}

function formatDate(value) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRemarkRatio(repliedCount, totalCount) {
  const replied = Number.isFinite(Number(repliedCount)) ? Math.max(0, Number(repliedCount)) : 0;
  const total = Number.isFinite(Number(totalCount)) ? Math.max(0, Number(totalCount)) : 0;
  const left = String(Math.min(replied, total)).padStart(2, "0");
  const right = String(total).padStart(2, "0");
  return `${left}/${right}`;
}

function escapeSelectorValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function resolveVisitDate() {
  const preset = elements.visitDatePreset?.value || "today";
  const offsetDays = VISIT_DATE_OFFSETS[preset] ?? 0;
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() - offsetDays);
  return formatDateInput(base);
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function applyVisitDatePresetFromDate(dateOnly) {
  const normalized = String(dateOnly || "").trim();
  if (!normalized) {
    elements.visitDatePreset.value = "today";
    return;
  }
  const target = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(target.getTime())) {
    elements.visitDatePreset.value = "today";
    return;
  }
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const days = Math.round((now.getTime() - target.getTime()) / 86400000);
  if (days === 0) {
    elements.visitDatePreset.value = "today";
  } else if (days === 1) {
    elements.visitDatePreset.value = "yesterday";
  } else if (days === 2) {
    elements.visitDatePreset.value = "day_before_yesterday";
  } else {
    elements.visitDatePreset.value = "today";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


