const STORAGE_KEY = "clinical-rollout-selected-project";
const ACTIVE_TAB_KEY = "clinical-rollout-active-tab";
const AUTH_TOKEN_KEY = "clinical-rollout-auth-token";
const INSIGHT_SUBTAB_KEY = "clinical-rollout-insight-subtab";
const LEDGER_SUBTAB_KEY = "clinical-rollout-ledger-subtab";

const uiTextUtils = window.UiTextUtils;
if (!uiTextUtils) {
  throw new Error("UiTextUtils is required");
}
const {
  formatDate,
  formatDateTime,
  formatRemarkRatio,
  escapeSelectorValue,
  formatDateInput,
  escapeHtml,
  normalizeDisplayText,
  escapeDisplayHtml,
} = uiTextUtils;
const domainFormatters = window.DomainFormatters;
if (!domainFormatters) {
  throw new Error("DomainFormatters is required");
}
const {
  formatRiskLevelLabel,
  getProjectTaskSortKey,
  formatProjectTaskTime,
  formatTaskStatusLabel,
  normalizeUserRole,
} = domainFormatters;
const followupHistoryUtils = window.FollowupHistoryUtils;
if (!followupHistoryUtils) {
  throw new Error("FollowupHistoryUtils is required");
}
const {
  normalizeHistoryInfoSessions,
  formatScenarioSnapshot,
  normalizeFollowupHistory,
  normalizeFollowupQuestions,
  getPendingFollowupQuestions,
} = followupHistoryUtils;
const contactEditorUtils = window.ContactEditorUtils;
if (!contactEditorUtils) {
  throw new Error("ContactEditorUtils is required");
}
const {
  toContactDraftRows,
  normalizeContactDraftRows,
  validateContactDraftRows,
  normalizeContactMergeActions,
  normalizeContactOriginalRows,
  generateTempContactId,
} = contactEditorUtils;
const insightBackupUtils = window.InsightBackupUtils;
if (!insightBackupUtils) {
  throw new Error("InsightBackupUtils is required");
}
const {
  normalizeLedgerSubTab,
  normalizeInsightSubTab,
  resolveBackupPanelState,
  formatBackupSchedule,
} = insightBackupUtils;
const uiRenderUtils = window.UiRenderUtils;
if (!uiRenderUtils) {
  throw new Error("UiRenderUtils is required");
}
const {
  renderTaskCard,
  renderSignalGroup,
  renderBarRow,
  renderTagList,
} = uiRenderUtils;
const insightContentUtils = window.InsightContentUtils;
if (!insightContentUtils) {
  throw new Error("InsightContentUtils is required");
}
const {
  renderInsightSummaryContent,
  renderInsightRecentContent,
  renderInsightManagementContent,
} = insightContentUtils;
const managementBackupRenderUtils = window.ManagementBackupRenderUtils;
if (!managementBackupRenderUtils) {
  throw new Error("ManagementBackupRenderUtils is required");
}
const { renderManagementUserItemMarkup, renderBackupAdminPanelMarkup } = managementBackupRenderUtils;
const panelRenderUtils = window.PanelRenderUtils;
if (!panelRenderUtils) {
  throw new Error("PanelRenderUtils is required");
}
const { renderTaskBoardMarkup, renderInsightPanelMarkup } = panelRenderUtils;
const projectSelectionUtils = window.ProjectSelectionUtils;
if (!projectSelectionUtils) {
  throw new Error("ProjectSelectionUtils is required");
}
const { getVisibleProjectsByKeyword, resolveSelectedProjectId } = projectSelectionUtils;
const tabRenderUtils = window.TabRenderUtils;
if (!tabRenderUtils) {
  throw new Error("TabRenderUtils is required");
}
const { resolveActiveMainTab, applyMainTabs, applyLedgerSubTabs } = tabRenderUtils;

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
  departmentInput: document.querySelector("#departmentInput"),
  departmentSuggestions: document.querySelector("#departmentSuggestions"),
  projectModal: document.querySelector("#projectModal"),
  projectModalForm: document.querySelector("#projectModalForm"),
  projectModalCloseButton: document.querySelector("#projectModalCloseButton"),
  newHospitalNameInput: document.querySelector("#newHospitalNameInput"),
  newProjectDepartmentInput: document.querySelector("#newProjectDepartmentInput"),
  newProjectDepartmentSuggestions: document.querySelector("#newProjectDepartmentSuggestions"),
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
  taskDueDialog: document.querySelector("#taskDueDialog"),
  taskDueDialogForm: document.querySelector("#taskDueDialogForm"),
  taskDueDialogTitle: document.querySelector("#taskDueDialogTitle"),
  taskDueDialogCopy: document.querySelector("#taskDueDialogCopy"),
  taskDueDialogMeta: document.querySelector("#taskDueDialogMeta"),
  taskDueDialogDateInput: document.querySelector("#taskDueDialogDateInput"),
  taskDueDialogCloseButton: document.querySelector("#taskDueDialogCloseButton"),
  taskDueDialogCancelButton: document.querySelector("#taskDueDialogCancelButton"),
  taskDueDialogSubmitButton: document.querySelector("#taskDueDialogSubmitButton"),
  taskRecordDialog: document.querySelector("#taskRecordDialog"),
  taskRecordDialogForm: document.querySelector("#taskRecordDialogForm"),
  taskRecordDialogTitle: document.querySelector("#taskRecordDialogTitle"),
  taskRecordDialogCopy: document.querySelector("#taskRecordDialogCopy"),
  taskRecordDialogList: document.querySelector("#taskRecordDialogList"),
  taskRecordDialogTextarea: document.querySelector("#taskRecordDialogTextarea"),
  taskRecordDialogCloseButton: document.querySelector("#taskRecordDialogCloseButton"),
  taskRecordDialogCancelButton: document.querySelector("#taskRecordDialogCancelButton"),
  taskRecordDialogSubmitButton: document.querySelector("#taskRecordDialogSubmitButton"),
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
  intakePreviewStaleReason: "",
  intakeDepartment: {
    projectId: "",
  },
  remarkCursorByProject: {},
  activeRemarkId: "",
  supplement: {
    remarkId: "",
    updateId: "",
    sourceText: "",
    sourceDate: "",
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
  contactEditor: {
    editingProjectId: "",
    draftContacts: [],
    originalContacts: [],
    mergeActions: [],
    saving: false,
  },
  taskBoard: {
    projectFilterId: "",
    projectKeyword: "",
    projectSearchOpen: false,
    activeGroup: "overdue",
    sortField: "dueAt",
    sortDirection: "asc",
  },
  taskDueDialog: {
    dialogOpen: false,
    taskId: "",
    draftDate: "",
  },
  taskRecordDialog: {
    dialogOpen: false,
    taskId: "",
    draftContent: "",
  },
  projectDetailTaskListExpandedProjectId: "",
};

const VISIT_DATE_OFFSETS = {
  today: 0,
  yesterday: 1,
  day_before_yesterday: 2,
};
const CONTACT_LONG_PRESS_MS = 1000;
const CONTACT_DRAG_START_DISTANCE = 6;
const CONTACT_MERGE_OVERLAP_THRESHOLD = 0.75;
const CONTACT_MERGE_SNAP_RATIO = 0.9;
const contactLongPressState = {
  timer: null,
  triggered: false,
};
const contactEditorGestureState = {
  pointerId: null,
  projectId: "",
  sourceIndex: -1,
  targetIndex: -1,
  sourceCard: null,
  targetCard: null,
  startClientX: 0,
  startClientY: 0,
  translateX: 0,
  translateY: 0,
  sourceRect: null,
  dragging: false,
  decidingMerge: false,
  wiggleTimer: null,
  lastDragEndedAt: 0,
};

const ENTRY_MODE_COPY = {
  default: {
    eyebrow: "录入",
    title: "纪要录入",
    copy: "录入一线医院推进纪要，系统自动提取联系人、问题标签、阶段变化与任务建议",
    visitDateLabel: "拜访日期",
    noteLabel: "原始推进记录",
    notePlaceholder: "请描述本次医院推进记录，例如：关键联系人、反馈意见、阻塞点、下一步计划与所需支持",
    hint: "建议记录完整业务信息，以便系统准确生成项目更新与任务动作",
  },
  reply: {
    eyebrow: "录入",
    title: "纪要录入（回复）",
    copy: "围绕指定留言补充回复信息，系统会先同步原始回复记录，再继续生成结构化纪要",
    visitDateLabel: "回复日期",
    noteLabel: "原始回复记录",
    notePlaceholder: "请填写对该条留言的回复记录，例如：沟通对象、处理结果、最新结论和后续动作",
    hint: "建议补全留言处理过程，以便系统准确生成后续纪要与任务动作",
  },
};

function getScopedProjectSelectionKey(user = state.bootstrap?.currentUser) {
  const userId = String(user?.id || "").trim();
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function readPersistedSelection(user = state.bootstrap?.currentUser) {
  const userId = String(user?.id || "").trim();
  if (userId) {
    return localStorage.getItem(getScopedProjectSelectionKey(user)) || "";
  }
  return localStorage.getItem(STORAGE_KEY) || "";
}

function applyBootstrapPayload(bootstrap, options = {}) {
  state.bootstrap = bootstrap || null;
  if (!state.bootstrap) {
    state.selectedProjectId = "";
    return;
  }
  if (options.restoreSelection) {
    state.selectedProjectId = readPersistedSelection(state.bootstrap.currentUser);
  }
}

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
  resetContactEditorState({ silent: true });
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
  if (action === "toggle-action-contact") {
    const reviewItemId = String(button.dataset.intakeReviewId || "");
    const contactId = String(button.dataset.contactId || "");
    toggleIntakeActionRelatedContact(reviewItemId, contactId);
    return;
  }
  if (action === "submit") {
    await commitIntake();
  }
});

elements.intakeResult.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-intake-contact-select][data-intake-contact-id]");
  if (!select) {
    return;
  }
  const reviewContactId = String(select.dataset.intakeContactId || "").trim();
  if (!reviewContactId) {
    return;
  }
  updateIntakeContactSelection(reviewContactId, String(select.value || "").trim());
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
  if (state.taskDueDialog.dialogOpen) {
    closeTaskDueDialog();
  }
  if (state.taskRecordDialog.dialogOpen) {
    closeTaskRecordDialog();
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

elements.taskDueDialogForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitTaskDueDate();
});

elements.taskDueDialogCloseButton?.addEventListener("click", () => {
  closeTaskDueDialog();
});

elements.taskDueDialogCancelButton?.addEventListener("click", () => {
  closeTaskDueDialog();
});

elements.taskDueDialog?.addEventListener("click", (event) => {
  if (event.target === elements.taskDueDialog) {
    closeTaskDueDialog();
  }
});

elements.taskDueDialogDateInput?.addEventListener("input", () => {
  state.taskDueDialog.draftDate = String(elements.taskDueDialogDateInput.value || "").trim();
});

elements.taskRecordDialogForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitTaskRecord();
});

elements.taskRecordDialogCloseButton?.addEventListener("click", () => {
  closeTaskRecordDialog();
});

elements.taskRecordDialogCancelButton?.addEventListener("click", () => {
  closeTaskRecordDialog();
});

elements.taskRecordDialog?.addEventListener("click", (event) => {
  if (event.target === elements.taskRecordDialog) {
    closeTaskRecordDialog();
  }
});

elements.taskRecordDialogTextarea?.addEventListener("input", () => {
  state.taskRecordDialog.draftContent = String(elements.taskRecordDialogTextarea.value || "");
});

elements.historyInfoDialogList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-history-action][data-history-session-id]");
  if (!button) {
    return;
  }
  const action = String(button.dataset.historyAction || "").trim();
  const historySessionId = String(button.dataset.historySessionId || "").trim();
  if (!historySessionId || state.historyInfo.busy || state.followup.busy || state.busy) {
    return;
  }
  const matchedSession = (state.historyInfo.sessions || []).find((item) => item.sessionId === historySessionId);
  if (!matchedSession) {
    showToast("历史信息已变化，请刷新后重试", "warn");
    return;
  }
  if (action === "continue") {
    if (!String(elements.noteInput.value || "").trim() && matchedSession.seedNote) {
      elements.noteInput.value = matchedSession.seedNote;
      invalidateIntakePreview();
      renderIntakeSubmitButton();
    }
    closeHistoryInfoDialog();
    await openFollowupDialogByGeneratingQuestions({ historySessionId });
    return;
  }
  if (action === "remark") {
    const historyQuestionId = String(button.dataset.historyQuestionId || "").trim();
    if (!historyQuestionId) {
      showToast("历史条目标识缺失，请刷新后重试", "warn");
      return;
    }
    await createProjectRemarkFromHistoryEntry({
      historySessionId,
      historyQuestionId,
      session: matchedSession,
    });
    return;
  }
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
  const taskCenterTrigger = event.target.closest("[data-open-task-center-project]");
  if (taskCenterTrigger) {
    event.preventDefault();
    event.stopPropagation();
    openTaskCenter(taskCenterTrigger.dataset.openTaskCenterProject, {
      groupId: taskCenterTrigger.dataset.openTaskCenterGroup,
    });
    return;
  }

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
  resetContactEditorState({ silent: true });
  resetFollowupState();
  resetHistoryInfoState();
  renderAll();
});

elements.projectDetail.addEventListener("click", async (event) => {
  const taskCenterTrigger = event.target.closest("[data-open-task-center-project]");
  if (taskCenterTrigger) {
    event.preventDefault();
    event.stopPropagation();
    openTaskCenter(taskCenterTrigger.dataset.openTaskCenterProject, {
      groupId: taskCenterTrigger.dataset.openTaskCenterGroup,
    });
    return;
  }

  const longPressCard = event.target.closest("[data-contact-card]");
  if (contactLongPressState.triggered && longPressCard) {
    event.preventDefault();
    event.stopPropagation();
    contactLongPressState.triggered = false;
    return;
  }
  contactLongPressState.triggered = false;

  const contactToken = event.target.closest("button[data-contact-token][data-contact-field][data-contact-index]");
  if (contactToken) {
    event.preventDefault();
    event.stopPropagation();

    if (Date.now() - Number(contactEditorGestureState.lastDragEndedAt || 0) < 300) {
      return;
    }

    const projectId = String(contactToken.dataset.projectId || state.selectedProjectId || "").trim();
    if (!isContactEditorActive(projectId) || state.contactEditor.saving) {
      return;
    }

    const contactIndex = Number(contactToken.dataset.contactIndex);
    if (
      !Number.isInteger(contactIndex) ||
      contactIndex < 0 ||
      contactIndex >= state.contactEditor.draftContacts.length
    ) {
      return;
    }

    const field = String(contactToken.dataset.contactField || "").trim();
    if (!field) {
      return;
    }
    const row = state.contactEditor.draftContacts[contactIndex];
    if (!row) {
      return;
    }
    const fieldLabelMap = {
      name: "姓名",
      roleTitle: "角色",
    };
    const fieldLabel = fieldLabelMap[field] || "词条";
    const currentValue = String(row[field] || "");
    const nextValue = window.prompt(`请输入${fieldLabel}`, currentValue);
    if (nextValue === null) {
      return;
    }
    row[field] = String(nextValue).trim();
    renderProjectDetail();
    return;
  }

  const contactActionButton = event.target.closest("button[data-contact-action]");
  if (contactActionButton) {
    event.preventDefault();
    event.stopPropagation();

    const action = String(contactActionButton.dataset.contactAction || "");
    const projectId = String(contactActionButton.dataset.projectId || state.selectedProjectId || "").trim();
    if (!projectId) {
      return;
    }

    if (action === "edit") {
      if (state.busy || state.followup.busy || state.contactEditor.saving) {
        return;
      }
      startContactEditor(projectId);
      return;
    }
    if (action === "save") {
      if (state.busy || state.followup.busy || state.contactEditor.saving) {
        return;
      }
      await saveContactEditor(projectId);
      return;
    }
    if (action === "cancel") {
      if (state.contactEditor.saving) {
        return;
      }
      if (hasContactEditorChanges(projectId) && !window.confirm("是否放弃编辑")) {
        return;
      }
      resetContactEditorState({ projectId, silent: true });
      renderProjectDetail();
      return;
    }
    if (action === "add") {
      if (state.busy || state.followup.busy || state.contactEditor.saving) {
        return;
      }
      appendContactDraftRow(projectId);
      return;
    }
    if (action === "remove") {
      if (state.busy || state.followup.busy || state.contactEditor.saving) {
        return;
      }
      showToast("编辑状态下不能删除联系人，请通过覆盖合并", "warn");
      return;
    }
    return;
  }

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

  const updateId = String(createRemarkButton.dataset.updateId || "");
  await createProjectRemark(projectId, { updateId });
});

elements.projectDetail.addEventListener("pointerdown", (event) => {
  if (state.busy || state.followup.busy || state.contactEditor.saving) {
    return;
  }
  if (event.pointerType === "mouse" && Number(event.button) !== 0) {
    return;
  }

  const dragHandle = event.target.closest(
    "button[data-contact-drag-handle][data-contact-index][data-project-id]",
  );
  if (dragHandle) {
    const editContactCard = dragHandle.closest(
      "[data-contact-edit-card][data-contact-index][data-project-id]",
    );
    if (!editContactCard) {
      return;
    }
    const projectId = String(editContactCard.dataset.projectId || "").trim();
    if (isContactEditorActive(projectId)) {
      beginContactEditorCardGesture(event, editContactCard);
    }
    return;
  }

  const contactCard = event.target.closest("[data-contact-card][data-project-id]");
  if (!contactCard) {
    return;
  }

  const projectId = String(contactCard.dataset.projectId || "").trim();
  if (!projectId || state.contactEditor.editingProjectId === projectId) {
    return;
  }

  clearContactLongPressTimer();
  contactLongPressState.triggered = false;
  contactLongPressState.timer = setTimeout(() => {
    contactLongPressState.triggered = true;
    startContactEditor(projectId);
  }, CONTACT_LONG_PRESS_MS);
});

elements.projectDetail.addEventListener("pointermove", (event) => {
  updateContactEditorCardGesture(event);
});

for (const pointerEventName of ["pointerup", "pointercancel"]) {
  elements.projectDetail.addEventListener(pointerEventName, (event) => {
    clearContactLongPressTimer();
    endContactEditorCardGesture(event);
  });
}
elements.projectDetail.addEventListener("pointerleave", () => {
  clearContactLongPressTimer();
});

elements.projectDetail.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-contact-field][data-contact-index]");
  if (!input) {
    return;
  }
  const projectId = String(input.dataset.projectId || "").trim();
  if (!projectId || state.contactEditor.editingProjectId !== projectId) {
    return;
  }

  const rowIndex = Number(input.dataset.contactIndex);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= state.contactEditor.draftContacts.length) {
    return;
  }

  const field = String(input.dataset.contactField || "").trim();
  if (!field) {
    return;
  }

  const value = String(input.value || "");
  const row = state.contactEditor.draftContacts[rowIndex];
  if (!row) {
    return;
  }
  if (field === "name" || field === "roleTitle") {
    row[field] = value;
  }
});

elements.signalPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-focus-project]");
  if (!button) {
    return;
  }

  openProjectLedgerDetail(button.dataset.focusProject);
});

elements.taskBoard.addEventListener("click", async (event) => {
  const filterResetButton = event.target.closest("button[data-task-reset-filter]");
  if (filterResetButton) {
    state.taskBoard.projectFilterId = "";
    state.taskBoard.projectKeyword = "";
    state.taskBoard.projectSearchOpen = false;
    state.taskBoard.activeGroup = resolveDefaultTaskBoardGroup(getTaskBoardFilteredTasks());
    renderTaskBoard();
    return;
  }

  const searchToggleButton = event.target.closest("button[data-task-toggle-search]");
  if (searchToggleButton) {
    state.taskBoard.projectSearchOpen = !state.taskBoard.projectSearchOpen;
    if (!state.taskBoard.projectSearchOpen) {
      state.taskBoard.projectKeyword = "";
    }
    renderTaskBoard();
    return;
  }

  const groupButton = event.target.closest("button[data-task-group]");
  if (groupButton) {
    state.taskBoard.activeGroup = String(groupButton.dataset.taskGroup || "todo");
    renderTaskBoard();
    return;
  }

  const sortFieldButton = event.target.closest("button[data-task-sort-field-toggle]");
  if (sortFieldButton) {
    state.taskBoard.sortField = state.taskBoard.sortField === "startAt" ? "dueAt" : "startAt";
    renderTaskBoard();
    return;
  }

  const sortDirectionButton = event.target.closest("button[data-task-sort-direction-toggle]");
  if (sortDirectionButton) {
    state.taskBoard.sortDirection = state.taskBoard.sortDirection === "desc" ? "asc" : "desc";
    renderTaskBoard();
    return;
  }

  const dueDialogButton = event.target.closest("button[data-task-action='due-dialog'][data-task-id]");
  if (dueDialogButton) {
    openTaskDueDialog(dueDialogButton.dataset.taskId);
    return;
  }

  const recordDialogButton = event.target.closest("button[data-task-action='record-dialog'][data-task-id]");
  if (recordDialogButton) {
    openTaskRecordDialog(recordDialogButton.dataset.taskId);
    return;
  }

  const button = event.target.closest("button[data-task-id][data-task-status]");
  if (button && !state.busy) {
    await updateTaskStatus(button.dataset.taskId, button.dataset.taskStatus);
  }
});

elements.taskBoard.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-task-project-filter]");
  if (!select) {
    return;
  }

  state.taskBoard.projectFilterId = String(select.value || "").trim();
  state.taskBoard.projectKeyword = "";
  state.taskBoard.projectSearchOpen = false;
  state.taskBoard.activeGroup = resolveDefaultTaskBoardGroup(getTaskBoardFilteredTasks());
  renderTaskBoard();
});

elements.taskBoard.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-task-project-search]");
  if (!input) {
    return;
  }
  state.taskBoard.projectKeyword = String(input.value || "");
  renderTaskBoard();
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
    const confirmedRestore = window.confirm(
      `确认恢复 ${formatDate(backupDate)} 的最新备份吗？恢复后所有用户会被强制下线。`,
    );
    if (!confirmedRestore) {
      return;
    }
    await restoreBackupByDate(backupDate);
    return;
  }

  const button = event.target.closest("button[data-management-action='save-user'][data-user-id]");
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
  const supervisorSelect = elements.insightPanel.querySelector(
    `select[data-management-supervisor-select="${escapeSelectorValue(userId)}"]`,
  );
  const supervisorUserId = String(supervisorSelect?.value || "").trim();
  await updateManagedUser(userId, { regionId, supervisorUserId });
});

elements.insightPanel.addEventListener("change", (event) => {
  const managementRegionSelect = event.target.closest("select[data-management-region-select]");
  if (managementRegionSelect) {
    const userId = String(managementRegionSelect.dataset.managementRegionSelect || "").trim();
    if (userId) {
      syncManagementSupervisorSelect(userId);
    }
    return;
  }

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
    applyBootstrapPayload(payload, { restoreSelection: true });
    ensureSelection();
    if (!preserveResult) {
      state.lastResult = null;
      state.intakePreviewStaleReason = "";
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
  const departmentName = normalizeDepartmentInputValue(elements.newProjectDepartmentInput?.value || "");
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
        departmentName: departmentName || undefined,
        city,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    applyBootstrapPayload(payload.bootstrap);
    state.selectedProjectId = payload.project.id;
    state.projectKeyword = "";
    elements.projectSearchInput.value = "";
    state.projectSearchOpen = false;
    persistSelection();
    resetContactEditorState({ silent: true });
    resetFollowupState();
    closeProjectModal({ force: true });
    renderAll();
    if (departmentName && elements.departmentInput) {
      elements.departmentInput.value = departmentName;
      state.intakeDepartment.projectId = payload.project.id;
    }
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
  if (elements.newProjectDepartmentInput) {
    elements.newProjectDepartmentInput.value = "";
  }
  elements.newHospitalCityInput.value = "";
  renderProjectModalDepartmentSuggestions();
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
  const displayVisitDate = formatDate(normalizedVisitDate);
  const sourceText = String(state.supplement.sourceText || "").trim() || "未关联上级留言内容";
  return [
    "【留言回复纪要】",
    `关联日期：${displayVisitDate}`,
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

function normalizeDepartmentInputValue(value) {
  const normalized = String(value || "").trim();
  return normalized === "无科室" ? "" : normalized;
}

function getCurrentDepartmentName() {
  return normalizeDepartmentInputValue(elements.departmentInput?.value || "");
}

function clearDepartmentInput(options = {}) {
  if (elements.departmentInput) {
    elements.departmentInput.value = "";
  }
  if (elements.departmentSuggestions && options.clearSuggestions) {
    elements.departmentSuggestions.innerHTML = "";
  }
  if (options.resetProjectBinding) {
    state.intakeDepartment.projectId = "";
  }
}

function renderDepartmentField() {
  if (!elements.departmentInput || !elements.departmentSuggestions) {
    return;
  }

  const selectedProject = getSelectedProject();
  const projectId = String(selectedProject?.id || "").trim();
  const departmentSuggestions = Array.isArray(selectedProject?.departmentSuggestions)
    ? selectedProject.departmentSuggestions
    : [];

  elements.departmentSuggestions.innerHTML = departmentSuggestions
    .map(
      (departmentName) =>
        `<option value="${escapeHtml(String(departmentName || "").trim())}">${escapeDisplayHtml(
          String(departmentName || "").trim(),
        )}</option>`,
    )
    .join("");

  if (projectId !== state.intakeDepartment.projectId) {
    elements.departmentInput.value = "";
  }

  elements.departmentInput.placeholder = "无科室";
  elements.departmentInput.disabled = state.busy || !projectId;
  state.intakeDepartment.projectId = projectId;
}

function getProjectModalDepartmentSuggestions() {
  const seen = new Set();
  const suggestions = [];
  const projects = Array.isArray(state.bootstrap?.projects) ? state.bootstrap.projects : [];
  for (const project of projects) {
    const departmentSuggestions = Array.isArray(project?.departmentSuggestions) ? project.departmentSuggestions : [];
    for (const suggestion of departmentSuggestions) {
      const normalized = String(suggestion || "").trim();
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) {
        continue;
      }
      seen.add(key);
      suggestions.push(normalized);
    }
  }
  return suggestions;
}

function renderProjectModalDepartmentSuggestions() {
  if (!elements.newProjectDepartmentSuggestions) {
    return;
  }
  const suggestions = getProjectModalDepartmentSuggestions();
  elements.newProjectDepartmentSuggestions.innerHTML = suggestions
    .map((departmentName) => `<option value="${escapeHtml(departmentName)}">${escapeDisplayHtml(departmentName)}</option>`)
    .join("");
}

function getCurrentIntakeContext() {
  const projectId = elements.projectSelect.value;
  const visitDate = resolveVisitDate();
  const rawNote = getVisibleReplyText();
  const departmentName = getCurrentDepartmentName();
  const baseNote = state.supplement.remarkId ? buildReplyModeIntakeNote(rawNote, visitDate) : rawNote;
  const supplementText = getSavedSupplementText();
  const note = buildSupplementedIntakeNote(baseNote, supplementText);
  return {
    projectId,
    departmentName,
    rawNote,
    baseNote,
    supplementText,
    note,
    visitDate,
  };
}

function invalidateIntakePreview(options = {}) {
  const { preserveResult = false, staleReason = "" } = options;
  state.intakePreviewFingerprint = "";
  if (!preserveResult) {
    state.lastResult = null;
    state.intakePreviewStaleReason = "";
  } else if (state.lastResult) {
    state.intakePreviewStaleReason = staleReason || state.intakePreviewStaleReason || "";
  } else {
    state.intakePreviewStaleReason = "";
  }
  renderIntakeResult();
}

function buildIntakeReviewState(extraction = {}) {
  const contacts = Array.isArray(extraction.contacts) ? extraction.contacts : [];
  const nextActions = Array.isArray(extraction.nextActions) ? extraction.nextActions : [];
  return {
    nextStep: {
      cancelled: false,
    },
    contacts: contacts.map((item, index) => ({
      itemId: String(item?.reviewContactId || `intake-contact-${index + 1}`),
      selectedContactId: String(item?.matchedContactId || "").trim(),
    })),
    nextActions: nextActions.map((_, index) => ({
      cancelled: false,
      itemId: `next-action-${index}`,
      relatedContactIds: normalizeReviewIdList(nextActions[index]?.relatedContactIds),
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
    contacts: Array.isArray(reviewState.contacts)
      ? reviewState.contacts.map((item, index) => ({
          itemId: String(item?.itemId || `intake-contact-${index + 1}`),
          selectedContactId: String(item?.selectedContactId || "").trim(),
        }))
      : [],
    nextActions: Array.isArray(reviewState.nextActions)
      ? reviewState.nextActions.map((item, index) => ({
          cancelled: Boolean(item?.cancelled),
          itemId: String(item?.itemId || `next-action-${index}`),
          relatedContactIds: normalizeReviewIdList(item?.relatedContactIds),
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

  const contacts = Array.isArray(result.extraction.contacts) ? result.extraction.contacts : [];
  const nextActions = Array.isArray(result.extraction.nextActions) ? result.extraction.nextActions : [];
  if (
    !Array.isArray(result.reviewState.contacts) ||
    result.reviewState.contacts.length !== contacts.length ||
    !Array.isArray(result.reviewState.nextActions) ||
    result.reviewState.nextActions.length !== nextActions.length
  ) {
    result.reviewState = buildIntakeReviewState(result.extraction);
    return result.reviewState;
  }

  if (!result.reviewState.nextStep) {
    result.reviewState.nextStep = { cancelled: false };
  }

  result.reviewState.nextActions = result.reviewState.nextActions.map((item, index) => ({
    cancelled: Boolean(item?.cancelled),
    itemId: String(item?.itemId || `next-action-${index}`),
    relatedContactIds: normalizeReviewIdList(item?.relatedContactIds),
  }));
  result.reviewState.contacts = result.reviewState.contacts.map((item, index) => ({
    itemId: String(item?.itemId || contacts[index]?.reviewContactId || `intake-contact-${index + 1}`),
    selectedContactId: String(item?.selectedContactId || "").trim(),
  }));

  return result.reviewState;
}

function renderIntakeReviewItem({ label, title, meta, cancelled, section, itemId, extraContent = "" }) {
  return `
    <li class="result-review-item ${cancelled ? "is-cancelled" : ""}" data-intake-review-section="${section}" data-intake-review-id="${itemId}">
      <div class="result-review-item-main">
        <div class="result-review-item-head">
          <span class="result-review-item-label">${escapeDisplayHtml(label)}</span>
          <span class="result-review-item-status ${cancelled ? "is-cancelled" : ""}">${cancelled ? "已取消" : "待确认"}</span>
        </div>
        <strong>${escapeDisplayHtml(title || "未填写")}</strong>
        ${meta ? `<p class="result-review-item-meta">${escapeDisplayHtml(meta)}</p>` : ""}
      </div>
      <button class="chip result-review-toggle" type="button" data-intake-action="toggle-review-item" data-intake-review-section="${section}" data-intake-review-id="${itemId}">
        ${cancelled ? "恢复" : "取消"}
      </button>
      ${extraContent ? `<div class="result-review-extra">${extraContent}</div>` : ""}
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
      contacts: Array.isArray(state.lastResult.extraction.contacts)
        ? state.lastResult.extraction.contacts.map((item, index) => {
            const reviewContact = Array.isArray(reviewState.contacts) ? reviewState.contacts[index] : null;
            const selectedContactId = String(reviewContact?.selectedContactId || "").trim();
            return {
              ...item,
              reviewContactId: String(item?.reviewContactId || reviewContact?.itemId || `intake-contact-${index + 1}`),
              matchedContactId: selectedContactId,
              resolutionStatus:
                selectedContactId
                  ? "matched"
                  : String(item?.resolutionStatus || "new") === "conflict"
                    ? "conflict"
                    : "new",
            };
          })
        : [],
      feedbackSummary: state.lastResult.extraction.feedbackSummary,
      blockers: state.lastResult.extraction.blockers,
      opportunities: state.lastResult.extraction.opportunities,
      issues: Array.isArray(state.lastResult.extraction.issues) ? [...state.lastResult.extraction.issues] : [],
      nextStep: state.lastResult.extraction.nextStep,
      nextActions: Array.isArray(state.lastResult.extraction.nextActions)
        ? state.lastResult.extraction.nextActions.map((item, index) => ({
            ...item,
            relatedContactIds: normalizeReviewIdList(reviewState.nextActions?.[index]?.relatedContactIds),
          }))
        : [],
      stageAfterUpdate: state.lastResult.extraction.stageAfterUpdate,
      managerAttentionNeeded: Boolean(state.lastResult.extraction.managerAttentionNeeded),
    },
    reviewState: cloneIntakeReviewState(reviewState),
  };
}

function normalizeReviewIdList(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

function updateIntakeContactSelection(reviewContactId, selectedContactId) {
  const reviewState = ensureIntakeReviewState(state.lastResult);
  if (!reviewState) {
    return;
  }
  const contactItem = reviewState.contacts.find((item) => item.itemId === reviewContactId);
  if (!contactItem) {
    return;
  }
  contactItem.selectedContactId = selectedContactId;
  renderIntakeResult();
}

function toggleIntakeActionRelatedContact(reviewItemId, contactId) {
  const reviewState = ensureIntakeReviewState(state.lastResult);
  if (!reviewState || !contactId) {
    return;
  }
  const nextAction = reviewState.nextActions.find((item) => item.itemId === reviewItemId);
  if (!nextAction) {
    return;
  }
  const currentIds = normalizeReviewIdList(nextAction.relatedContactIds);
  if (currentIds.includes(contactId)) {
    nextAction.relatedContactIds = currentIds.filter((item) => item !== contactId);
  } else {
    nextAction.relatedContactIds = [...currentIds, contactId];
  }
  renderIntakeResult();
}

function getIntakeReviewBlockingMessage(result = state.lastResult) {
  const reviewState = ensureIntakeReviewState(result);
  if (!result?.extraction || !reviewState) {
    return "请先生成纪要，再提交。";
  }

  const contacts = Array.isArray(result.extraction.contacts) ? result.extraction.contacts : [];
  for (let index = 0; index < contacts.length; index += 1) {
    const item = contacts[index];
    const reviewContact = reviewState.contacts?.[index];
    const selectedContactId = String(reviewContact?.selectedContactId || "").trim();
    if (String(item?.resolutionStatus || "") === "conflict" && !selectedContactId) {
      return `联系人“${item.name || "未命名联系人"}”存在同名冲突，请先手动确认。`;
    }
  }
  return "";
}

function getSelectedProjectContacts() {
  return Array.isArray(getSelectedProject()?.contacts) ? getSelectedProject().contacts : [];
}

function formatProjectContactOptionLabel(contact) {
  const name = String(contact?.name || "").trim() || "未命名联系人";
  const role = String(contact?.roleTitle || "").trim() || "角色未填";
  return `${name} / ${role}`;
}

function buildIntakeContactStatusText(contact, selectedContactId) {
  const initialStatus = String(contact?.resolutionStatus || "").trim();
  const autoMatchedId = String(contact?.matchedContactId || "").trim();
  if (selectedContactId) {
    return autoMatchedId && selectedContactId === autoMatchedId ? "已自动关联现有联系人" : "已手动关联现有联系人";
  }
  if (initialStatus === "conflict") {
    return "命中多个同名联系人，提交前必须选择已有联系人";
  }
  return "将新建联系人，可按需改为关联现有联系人";
}

function renderIntakeContactResolutionCards(contacts, reviewState) {
  const projectContacts = getSelectedProjectContacts();
  if (!contacts.length) {
    return '<p class="result-review-empty">未提取到联系人。</p>';
  }

  return contacts
    .map((contact, index) => {
      const reviewContact = reviewState.contacts?.[index];
      const selectedContactId = String(reviewContact?.selectedContactId || "").trim();
      const initialStatus = String(contact?.resolutionStatus || "").trim();
      const safeStatusClass = initialStatus ? ` is-${initialStatus.replace(/[^a-z-]/gi, "").toLowerCase()}` : "";
      const statusText = buildIntakeContactStatusText(contact, selectedContactId);
      const options = [];
      if (initialStatus === "conflict") {
        options.push('<option value="">请选择已有联系人</option>');
      } else {
        options.push(`<option value="">${selectedContactId ? "改为新建联系人" : "新建联系人"}</option>`);
      }
      options.push(
        ...projectContacts.map((item) => {
          const optionValue = String(item?.id || "").trim();
          if (!optionValue) {
            return "";
          }
          const selected = optionValue === selectedContactId ? " selected" : "";
          return `<option value="${escapeHtml(optionValue)}"${selected}>${escapeDisplayHtml(formatProjectContactOptionLabel(item))}</option>`;
        }),
      );
      return `
        <article class="result-contact-review-card${safeStatusClass}">
          <div class="result-contact-review-main">
            <div class="result-contact-review-head">
              <strong>${escapeDisplayHtml(contact.name || "未命名联系人")}</strong>
              <span>${escapeDisplayHtml(statusText)}</span>
            </div>
            <p>${escapeDisplayHtml(contact.role || "角色未填写")}</p>
          </div>
          <label class="result-contact-review-field">
            <span>关联方式</span>
            <select data-intake-contact-select="true" data-intake-contact-id="${escapeHtml(contact.reviewContactId || reviewContact?.itemId || "")}">
              ${options.join("")}
            </select>
          </label>
        </article>
      `;
    })
    .join("");
}

function buildIntakeActionRelatedChoices(extractionContacts, reviewState) {
  const projectContacts = getSelectedProjectContacts();
  const projectContactById = new Map(projectContacts.map((contact) => [String(contact.id || "").trim(), contact]));
  const choices = [];
  const seen = new Set();
  const selectedProjectContactIds = new Set(
    Array.isArray(reviewState?.contacts)
      ? reviewState.contacts.map((item) => String(item?.selectedContactId || "").trim()).filter(Boolean)
      : [],
  );

  extractionContacts.forEach((contact, index) => {
    const reviewContactId = String(contact?.reviewContactId || reviewState?.contacts?.[index]?.itemId || "").trim();
    if (!reviewContactId || seen.has(reviewContactId)) {
      return;
    }
    seen.add(reviewContactId);
    const selectedContactId = String(reviewState?.contacts?.[index]?.selectedContactId || "").trim();
    const selectedProjectContact = projectContactById.get(selectedContactId);
    const selectedName = String(selectedProjectContact?.name || "").trim();
    const extractedName = String(contact?.name || "").trim();
    const label =
      selectedName && selectedName !== extractedName
        ? `${selectedName}（纪要提及：${extractedName || "未命名联系人"}）`
        : extractedName || selectedName || "未命名联系人";
    choices.push({
      id: reviewContactId,
      label,
    });
  });

  projectContacts.forEach((contact) => {
    const contactId = String(contact?.id || "").trim();
    if (!contactId || seen.has(contactId) || selectedProjectContactIds.has(contactId)) {
      return;
    }
    seen.add(contactId);
    choices.push({
      id: contactId,
      label: formatProjectContactOptionLabel(contact),
    });
  });

  return choices;
}

function renderIntakeActionRelatedContacts(actionIndex, reviewItemId, extractionContacts, reviewState) {
  const relatedChoices = buildIntakeActionRelatedChoices(extractionContacts, reviewState);
  if (!relatedChoices.length) {
    return '<p class="result-related-contact-empty">暂无可关联联系人。</p>';
  }
  const selectedIds = normalizeReviewIdList(reviewState?.nextActions?.[actionIndex]?.relatedContactIds);
  return `
    <div class="result-related-contact-row">
      ${relatedChoices
        .map(
          (choice) => `
            <button
              class="chip result-related-contact${selectedIds.includes(choice.id) ? " is-active" : ""}"
              type="button"
              data-intake-action="toggle-action-contact"
              data-intake-review-id="${escapeHtml(reviewItemId)}"
              data-contact-id="${escapeHtml(choice.id)}"
            >
              ${escapeDisplayHtml(choice.label)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderIntakeSubmitButton() {
  if (!elements.submitButton) {
    return;
  }

  const { projectId, rawNote, note, visitDate, departmentName } = getCurrentIntakeContext();
  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  const reviewBlockingMessage = getIntakeReviewBlockingMessage();
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
    resultSubmitButton.disabled = !(
      previewReady &&
      !reviewBlockingMessage &&
      !state.busy &&
      !state.followup.busy
    );
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

async function generateIntakePreview({ projectId, note, visitDate, departmentName, fingerprint }) {
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
        departmentName: departmentName || undefined,
        followupSessionId: state.followup.sessionId || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.lastResult = { ...payload, reviewState: buildIntakeReviewState(payload.extraction) };
    state.intakePreviewFingerprint = fingerprint;
    state.intakePreviewStaleReason = "";
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
  const { projectId, rawNote, note, visitDate, departmentName } = getCurrentIntakeContext();

  if (!projectId || !rawNote || state.busy || state.followup.busy) {
    return;
  }

  const fingerprint = buildIntakeFingerprint({ projectId, note, visitDate });
  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  if (!previewReady) {
    await generateIntakePreview({ projectId, note, visitDate, departmentName, fingerprint });
    return;
  }

  await generateIntakePreview({ projectId, note, visitDate, departmentName, fingerprint });
}

async function commitIntake() {
  const { projectId, rawNote, note, visitDate, departmentName } = getCurrentIntakeContext();

  if (!projectId || !rawNote || state.busy || state.followup.busy) {
    return;
  }

  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  if (!previewReady) {
    showToast("请先生成纪要，再提交", "warn");
    return;
  }
  const reviewBlockingMessage = getIntakeReviewBlockingMessage();
  if (reviewBlockingMessage) {
    showToast(reviewBlockingMessage, "warn");
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
      departmentName: departmentName || undefined,
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

    applyBootstrapPayload(payload.bootstrap);
    state.intakePreviewFingerprint = "";
    state.selectedProjectId = payload.project.id;
    clearSupplementContext();
    persistSelection();
    elements.noteInput.value = "";
    clearDepartmentInput();
    resetContactEditorState({ silent: true });
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
    showToast("请先生成纪要，再使用智能追问", "warn");
    return;
  }

  setFollowupBusy(true);
  showToast("正在生成智能追问", "busy");
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
    const pendingFromHistory = getPendingFollowupQuestions(state.followup.history);
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
    showToast(`已生成 ${state.followup.pendingQuestions.length} 条智能追问`, "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "智能追问生成失败", "error");
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
  const canLeaveProjectRemarks = canCurrentUserLeaveProjectRemarks();
  if (state.historyInfo.busy && !sessions.length) {
    elements.historyInfoDialogList.innerHTML = '<p class="empty-copy">历史信息加载中...</p>';
    return;
  }
  if (state.historyInfo.error && !sessions.length) {
    elements.historyInfoDialogList.innerHTML = `<p class="backup-error">${escapeDisplayHtml(state.historyInfo.error)}</p>`;
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
                  <p class="history-question"><strong>问题 ${item.round || "--"}：</strong>${escapeDisplayHtml(item.question || "--")}</p>
                  <p class="history-answer"><strong>回答：</strong>${escapeDisplayHtml(answer?.content || "（未回答）")}</p>
                  <p class="history-meta-line">提交人：${escapeDisplayHtml(submitter)} · 提交时间：${escapeDisplayHtml(submitAt)}</p>
                  <details class="history-params">
                    <summary>提交参数</summary>
                    <pre>${escapeHtml(submitScenario)}</pre>
                  </details>
                  ${
                    canLeaveProjectRemarks
                      ? `
                        <div class="history-qa-actions">
                          <button
                            class="chip history-qa-action"
                            type="button"
                            data-history-action="remark"
                            data-history-session-id="${escapeHtml(session.sessionId)}"
                            data-history-question-id="${escapeHtml(item.id)}"
                            ${state.historyInfo.busy || state.followup.busy || state.busy ? "disabled" : ""}
                          >
                            给专员留言
                          </button>
                        </div>
                      `
                      : ""
                  }
                </article>
              `;
            })
            .join("")
        : '<p class="empty-copy">暂无历史问题与回答记录</p>';
      return `
        <article class="history-session-card">
          <div class="history-session-head">
            <div>
              <strong>历史信息会话 ${escapeDisplayHtml(session.sessionId)}</strong>
              <p class="history-meta-line">
                创建人：${escapeDisplayHtml(session.userName || "--")} · 创建时间：${escapeDisplayHtml(
                  session.createdAt ? formatDateTime(session.createdAt) : "--",
                )} · 回答进度：${answerCount}/${totalCount}
              </p>
              <p class="history-meta-line">
                状态：${session.closedAt ? `已关闭（${escapeDisplayHtml(formatDateTime(session.closedAt))}）` : "进行中"}
              </p>
            </div>
            <button
              class="chip"
              type="button"
              data-history-action="continue"
              data-history-session-id="${escapeHtml(session.sessionId)}"
              ${state.historyInfo.busy || state.followup.busy || state.busy ? "disabled" : ""}
            >
              基于此继续追问
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

function getTaskById(taskId) {
  const normalizedTaskId = String(taskId || "").trim();
  if (!normalizedTaskId) {
    return null;
  }
  return (Array.isArray(state.bootstrap?.tasks) ? state.bootstrap.tasks : []).find(
    (task) => String(task?.id || "").trim() === normalizedTaskId,
  ) || null;
}

function resolveTaskDialogDefaultDate(task) {
  if (task?.dueAt) {
    return formatDateInput(new Date(task.dueAt));
  }
  if (task?.initialDueAt) {
    return formatDateInput(new Date(task.initialDueAt));
  }
  const businessDate = String(state.bootstrap?.health?.simulation?.currentDate || "").trim();
  if (businessDate) {
    return businessDate;
  }
  return formatDateInput(new Date());
}

function renderTaskDueDialog() {
  if (!elements.taskDueDialog || !elements.taskDueDialogMeta || !elements.taskDueDialogDateInput) {
    return;
  }
  const task = getTaskById(state.taskDueDialog.taskId);
  const open = Boolean(state.taskDueDialog.dialogOpen && task);
  elements.taskDueDialog.hidden = !open;
  if (!open) {
    return;
  }

  const historyCount = Array.isArray(task?.dueDateHistory) ? task.dueDateHistory.length : 0;
  elements.taskDueDialogTitle.textContent = "截止日";
  elements.taskDueDialogCopy.textContent = task?.dueAt ? "可调整截止日，系统会保留变更记录。" : "先设置截止日，系统会记为初始截止日。";
  elements.taskDueDialogMeta.innerHTML = `
    <div class="task-dialog-meta-card">
      <span>开始时间</span>
      <strong>${escapeDisplayHtml(formatDate(task?.startAt || task?.createdAt))}</strong>
    </div>
    <div class="task-dialog-meta-card">
      <span>初始截止日</span>
      <strong>${escapeDisplayHtml(task?.initialDueAt ? formatDate(task.initialDueAt) : "未设置")}</strong>
    </div>
    <div class="task-dialog-meta-card">
      <span>当前截止日</span>
      <strong>${escapeDisplayHtml(task?.dueAt ? formatDate(task.dueAt) : "未设置")}</strong>
    </div>
    <div class="task-dialog-meta-card">
      <span>历史变更</span>
      <strong>${historyCount} 次</strong>
    </div>
  `;
  elements.taskDueDialogDateInput.value = state.taskDueDialog.draftDate || resolveTaskDialogDefaultDate(task);
  elements.taskDueDialogDateInput.disabled = state.busy;
  elements.taskDueDialogCloseButton.disabled = state.busy;
  elements.taskDueDialogCancelButton.disabled = state.busy;
  elements.taskDueDialogSubmitButton.disabled = state.busy;
}

function renderTaskRecordGroups(records) {
  const safeRecords = Array.isArray(records) ? records : [];
  if (!safeRecords.length) {
    return '<p class="empty-copy">当前任务还没有记录。</p>';
  }

  const groups = new Map();
  for (const record of safeRecords) {
    const dayLabel = formatDate(record?.createdAt);
    if (!groups.has(dayLabel)) {
      groups.set(dayLabel, []);
    }
    groups.get(dayLabel).push(record);
  }

  return [...groups.entries()]
    .map(
      ([dayLabel, items]) => `
        <section class="task-record-group">
          <h4>${escapeDisplayHtml(dayLabel)}</h4>
          ${items
            .map(
              (item) => `
                <article class="task-record-item">
                  <div class="task-record-item-head">
                    <strong>${escapeDisplayHtml(item?.createdByName || "未知用户")}</strong>
                    <span>${escapeDisplayHtml(formatDateTime(item?.createdAt))}</span>
                  </div>
                  <p>${escapeDisplayHtml(item?.content || "")}</p>
                </article>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function renderTaskRecordDialog() {
  if (!elements.taskRecordDialog || !elements.taskRecordDialogList || !elements.taskRecordDialogTextarea) {
    return;
  }
  const task = getTaskById(state.taskRecordDialog.taskId);
  const open = Boolean(state.taskRecordDialog.dialogOpen && task);
  elements.taskRecordDialog.hidden = !open;
  if (!open) {
    return;
  }

  elements.taskRecordDialogTitle.textContent = "处理记录";
  elements.taskRecordDialogCopy.textContent = task?.recordCount
    ? `已记录 ${task.recordCount} 条，可继续补充。`
    : "还没有记录，可先补一条。";
  elements.taskRecordDialogList.innerHTML = renderTaskRecordGroups(task?.records);
  elements.taskRecordDialogTextarea.value = state.taskRecordDialog.draftContent;
  elements.taskRecordDialogTextarea.disabled = state.busy;
  elements.taskRecordDialogCloseButton.disabled = state.busy;
  elements.taskRecordDialogCancelButton.disabled = state.busy;
  elements.taskRecordDialogSubmitButton.disabled = state.busy;
}

function openTaskDueDialog(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    showToast("未找到对应任务", "error");
    return;
  }
  state.taskDueDialog.taskId = task.id;
  state.taskDueDialog.draftDate = resolveTaskDialogDefaultDate(task);
  state.taskDueDialog.dialogOpen = true;
  renderTaskDueDialog();
}

function closeTaskDueDialog() {
  state.taskDueDialog.dialogOpen = false;
  state.taskDueDialog.taskId = "";
  state.taskDueDialog.draftDate = "";
  renderTaskDueDialog();
}

function openTaskRecordDialog(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    showToast("未找到对应任务", "error");
    return;
  }
  state.taskRecordDialog.taskId = task.id;
  state.taskRecordDialog.draftContent = "";
  state.taskRecordDialog.dialogOpen = true;
  renderTaskRecordDialog();
}

function closeTaskRecordDialog() {
  state.taskRecordDialog.dialogOpen = false;
  state.taskRecordDialog.taskId = "";
  state.taskRecordDialog.draftContent = "";
  renderTaskRecordDialog();
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
    : getPendingFollowupQuestions(state.followup.history);
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
    invalidateIntakePreview({ preserveResult: true, staleReason: "followup-answer" });
    renderIntakeSubmitButton();
    showToast("追问回答已保存，当前结果待重新生成", "ready");
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
  return state.followup.pendingQuestions.length
    ? [...state.followup.pendingQuestions]
    : getPendingFollowupQuestions(state.followup.history);
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
    elements.followupDialogQuestionList.innerHTML = '<p class="empty-copy">暂无待回答问题，可关闭后再次点击“智能追问”生成新问题。</p>';
  } else {
    elements.followupDialogQuestionList.innerHTML = pendingQuestions
      .map((item) => {
        const value = String(state.followup.draftAnswers[item.id] || "");
        return `
          <article class="followup-dialog-item">
            <div class="followup-dialog-head">
              <strong>问题 ${item.round || "--"}</strong>
            </div>
            <p class="followup-dialog-question">${escapeDisplayHtml(item.question)}</p>
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
  await updateTask(taskId, {
    body: { taskStatus },
    method: "PATCH",
    busyMessage: "正在更新任务状态",
    successMessage: "任务状态已更新",
    errorMessage: "任务状态更新失败",
  });
}

async function submitTaskDueDate() {
  const taskId = String(state.taskDueDialog.taskId || "").trim();
  const dueDate = String(state.taskDueDialog.draftDate || "").trim();
  if (!taskId || !dueDate) {
    showToast("请选择截止日期", "warn");
    return;
  }
  await updateTask(taskId, {
    body: { dueDate },
    method: "PATCH",
    busyMessage: "正在保存截止日",
    successMessage: "截止日已更新",
    errorMessage: "截止日更新失败",
    onSuccess: () => closeTaskDueDialog(),
  });
}

async function submitTaskRecord() {
  const taskId = String(state.taskRecordDialog.taskId || "").trim();
  const content = String(state.taskRecordDialog.draftContent || "").trim();
  if (!taskId || !content) {
    showToast("请输入记录内容", "warn");
    return;
  }
  await updateTask(taskId, {
    body: { content },
    method: "POST",
    pathSuffix: "/records",
    busyMessage: "正在保存记录",
    successMessage: "记录已保存",
    errorMessage: "记录保存失败",
    onSuccess: () => {
      state.taskRecordDialog.draftContent = "";
      renderTaskRecordDialog();
    },
  });
}

async function updateTask(taskId, options = {}) {
  setBusy(true);
  showToast(options.busyMessage || "正在更新任务", "busy");
  const method = String(options.method || "PATCH").trim().toUpperCase();
  const pathSuffix = String(options.pathSuffix || "");
  const body = options.body || {};

  try {
    const response = await fetch(`/api/tasks/${taskId}${pathSuffix}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    applyBootstrapPayload(payload.bootstrap);
    ensureSelection();
    renderAll();
    applyHealthState(payload.bootstrap.health);
    if (typeof options.onSuccess === "function") {
      options.onSuccess(payload);
    }
    showToast(options.successMessage || "任务已更新", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : options.errorMessage || "任务更新失败", "error");
  } finally {
    setBusy(false);
  }
}

async function updateManagedUser(userId, { regionId, supervisorUserId = "" }) {
  setBusy(true);
  showToast("正在更新成员配置", "busy");
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId, supervisorUserId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    applyBootstrapPayload(payload.bootstrap);
    ensureSelection();
    renderAll();
    applyHealthState(payload.bootstrap.health);
    showToast("成员配置已更新", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "成员配置更新失败", "error");
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
  const previousProjectId = state.selectedProjectId;
  const projects = state.bootstrap?.projects || [];
  if (!projects.length) {
    state.selectedProjectId = "";
    resetContactEditorState({ silent: true });
    return;
  }

  state.selectedProjectId = resolveSelectedProjectId(projects, state.selectedProjectId);
  if (previousProjectId !== state.selectedProjectId) {
    resetContactEditorState({ silent: true });
  }
  persistSelection();
}

function renderAll() {
  if (!state.bootstrap) {
    renderAuthState();
    renderHistoryInfoDialog();
    renderTaskDueDialog();
    renderTaskRecordDialog();
    return;
  }

  renderSessionBar();
  renderAuthState();
  renderTabs();
  renderProjectSearchState();
  renderProjectSelect();
  renderDepartmentField();
  renderEntryMode();
  renderIntakeSubmitButton();
  renderIntakeResult();
  renderSupplementDialog();
  renderFollowupDialog();
  renderHistoryInfoDialog();
  renderTaskDueDialog();
  renderTaskRecordDialog();
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
    state.supplement.sourceDate ? `留言日期 · ${formatDate(state.supplement.sourceDate)}` : "",
  ]
    .filter(Boolean)
    .map((item) => `<span>${escapeDisplayHtml(item)}</span>`)
    .join("");

  if (elements.replySourceTitle) {
    elements.replySourceTitle.textContent = "原始留言记录";
  }
  elements.replySourceMeta.innerHTML = metaTokens;
  elements.replySourceText.textContent = normalizeDisplayText(state.supplement.sourceText);
}

function renderTabs() {
  const buttons = [...elements.tabBar.querySelectorAll("button[data-tab]")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  const activeMainTab = resolveActiveMainTab(state.activeTab, buttons);
  if (activeMainTab !== state.activeTab) {
    state.activeTab = activeMainTab;
    persistActiveTab();
  }
  applyMainTabs(state.activeTab, buttons, panels);
}

function getVisibleProjects() {
  const projects = state.bootstrap?.projects || [];
  return getVisibleProjectsByKeyword(projects, state.projectKeyword);
}

function renderProjectSelect() {
  const visibleProjects = getVisibleProjects();
  const hadSelection = visibleProjects.some((project) => project.id === state.selectedProjectId);
  if (!hadSelection) {
    state.selectedProjectId = visibleProjects[0]?.id || "";
    persistSelection();
    resetContactEditorState({ silent: true });
    resetFollowupState();
  }

  if (!visibleProjects.length) {
    elements.projectSelect.innerHTML = '<option value="">请选择医院项目</option>';
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
          ${escapeDisplayHtml(project.hospital.name)} · ${escapeDisplayHtml(project.stage.name)}
        </option>
      `,
    )
    .join("");

  if (elements.projectStageText) {
    elements.projectStageText.textContent = normalizeDisplayText(getSelectedProject()?.stage?.name || "--");
  }
}

function renderIntakeResult() {
  const supplementText = getSavedSupplementText();
  const supplementSavedAt = state.supplement.savedAt ? formatDateTime(state.supplement.savedAt) : "";
  const hasResult = Boolean(state.lastResult);
  const previewReady = isPreviewReadyForCurrentInput();
  const resultStale = hasResult && !previewReady;
  const staleReason = resultStale ? String(state.intakePreviewStaleReason || "").trim() : "";
  const staleResultCopy =
    staleReason === "followup-answer"
      ? "追问回答已保存，当前结果还未纳入最新追问信息，请先重新生成。"
      : staleReason === "supplement"
        ? "补充内容已保存，当前结果已失效，请先重新生成。"
        : "当前输入已变化，当前结果已失效，请先重新生成。";
  if (!state.lastResult) {
    elements.intakeResult.innerHTML = `
      <div class="result-empty">
        <p>本次结构化结果将在生成后展示于此。</p>
        <ul>
          <li>系统会通过模型接口提取联系人、问题标签、阶段变化与下一步动作。</li>
          <li>如果接口未配置或提取失败，生成/提交会直接返回错误。</li>
          <li>提交完成后，项目台账、任务中心和管理汇总会同步刷新。</li>
        </ul>
        ${
          supplementText
            ? `
              <div class="result-supplement">
                <div class="result-supplement-head-row">
                  <span class="result-supplement-head">补充编辑</span>
                  ${supplementSavedAt ? `<small>${escapeDisplayHtml(`已保存：${supplementSavedAt}`)}</small>` : ""}
                </div>
                <p>${escapeDisplayHtml(supplementText)}</p>
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
  const projectWarnings = Array.isArray(getSelectedProject()?.contactReferenceWarnings)
    ? getSelectedProject().contactReferenceWarnings
    : [];
  const reviewBlockingMessage = getIntakeReviewBlockingMessage(state.lastResult);
  const warningMessages = [...new Set([...projectWarnings, ...extractionWarnings, ...(reviewBlockingMessage ? [reviewBlockingMessage] : [])])];
  elements.intakeResult.innerHTML = `
    <div class="result-head">
      <span class="result-badge ${extractionSource === "responses-api" ? "is-responses" : "is-fallback"}">
        ${extractionSource === "responses-api" ? "结构化来源：模型接口" : "结构化来源：未知"}
      </span>
      ${resultStale ? '<span class="result-badge is-stale">当前结果待重新生成</span>' : ""}
      <span class="mini-meta">阶段更新：${escapeDisplayHtml(extraction.stageAfterUpdate || "--")}</span>
      <span class="mini-meta">管理关注：${extraction.managerAttentionNeeded ? "需要" : "无需"}</span>
    </div>
    <h3>本次结构化摘要</h3>
    <p class="result-summary">${escapeDisplayHtml(extraction.feedbackSummary || "暂无结构化摘要")}</p>
    <div class="token-row">${renderTagList(extraction.issues)}</div>
    <div class="result-block">
      <span>联系人摘要</span>
      <p>${escapeDisplayHtml(
        contacts
          .map((item) => `${normalizeDisplayText(item.name)}${item.role ? ` / ${normalizeDisplayText(item.role)}` : ""}`)
          .join("；") || "未识别",
      )}</p>
    </div>
    <section class="result-review-section">
      <div class="result-review-section-head">
        <span>联系人确认</span>
        <small>${contacts.length} 位</small>
      </div>
      ${renderIntakeContactResolutionCards(contacts, reviewState)}
    </section>
    <div class="result-block">
      <span>阻塞点</span>
      <p>${escapeDisplayHtml(extraction.blockers || "暂无")}</p>
    </div>
    <section class="result-review-section">
      <div class="result-review-section-head">
        <span>下一步</span>
        <small>可单项审核</small>
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
                .map((item, index) => {
                  const reviewItemId = reviewState?.nextActions?.[index]?.itemId || `next-action-${index}`;
                  const reviewItemLabel = ["后续事项", index + 1].join(" ");
                  return renderIntakeReviewItem({
                    label: reviewItemLabel,
                    title: item.title,
                    meta: item.dueDate ? `截止：${formatDate(item.dueDate)}` : "未填写截止时间",
                    cancelled: Boolean(reviewState?.nextActions?.[index]?.cancelled),
                    section: "next-action",
                    itemId: reviewItemId,
                    extraContent: renderIntakeActionRelatedContacts(index, reviewItemId, contacts, reviewState),
                  });
                })
                .join("")}
            </ul>
          `
          : '<p class="result-review-empty">未提取到待办动作。</p>'
      }
    </section>
    ${
      warningMessages.length
        ? `<div class="warning-box">${escapeDisplayHtml(warningMessages.join(" | "))}</div>`
        : ""
    }
    ${
      supplementText
        ? `
          <div class="result-supplement">
            <div class="result-supplement-head-row">
              <span class="result-supplement-head">补充编辑</span>
              ${supplementSavedAt ? `<small>${escapeDisplayHtml(`已保存：${supplementSavedAt}`)}</small>` : ""}
            </div>
            <p>${escapeDisplayHtml(supplementText)}</p>
          </div>
        `
        : ""
    }
    <div class="result-footer">
      <p class="result-footer-copy">${
        resultStale
          ? staleResultCopy
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
              <strong>${escapeDisplayHtml(update.hospitalName || update.stageAfterName || "最近推进")}</strong>
              <p>${escapeDisplayHtml(update.feedbackSummary)}</p>
              <span>${escapeDisplayHtml(formatDate(update.visitDate || update.createdAt))}</span>
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
              <h3>${escapeDisplayHtml(project.hospital.name)}</h3>
              <p>${escapeDisplayHtml(project.hospital.city)} · ${escapeDisplayHtml(project.stage.name)}</p>
            </div>
            <div class="project-card-badge-stack">
              <span class="department-pill${project.departmentName ? "" : " is-empty"}">${escapeDisplayHtml(project.departmentName || "无科室")}</span>
              <span class="risk-pill risk-${project.riskLevel}">${escapeDisplayHtml(formatRiskLevelLabel(project.riskLevel))}</span>
            </div>
          </div>
          <p class="project-summary">${escapeDisplayHtml(project.latestSummary || "暂无摘要")}</p>
          <div class="token-row">${renderTagList(project.issueNames)}</div>
          <div class="project-meta">
            <span
              class="remark-pill ${project.metrics.remarkCount ? "" : "is-empty"}"
              data-remark-focus-project="${project.id}"
              title="点击查看该项目关联的上级留言"
            >
              上级留言 ${formatRemarkRatio(project.metrics.remarkRepliedCount, project.metrics.remarkCount)}
            </span>
            <span
              class="remark-pill ${project.metrics.openTaskCount ? "" : "is-empty"}"
              data-open-task-center-project="${project.id}"
              title="进入该医院项目的任务中心"
            >
              待办 ${project.metrics.openTaskCount}
            </span>
            <span>逾期 ${project.metrics.overdueTaskCount}</span>
            <span>${project.isStalled ? `停滞 ${project.stalledDays} 天` : `最近跟进 ${formatDate(project.lastFollowUpAt)}`}</span>
          </div>
        </button>
      `,
    )
    .join("");
}

function renderDetailMetricCard(label, value, meta) {
  return `
    <article class="detail-metric-card">
      <span>${escapeDisplayHtml(label)}</span>
      <strong>${escapeDisplayHtml(value)}</strong>
      <small>${escapeDisplayHtml(meta || "")}</small>
    </article>
  `;
}

function renderDetailEmptyState(title, copy) {
  return `
    <article class="detail-empty-state">
      <strong>${escapeDisplayHtml(title)}</strong>
      <p>${escapeDisplayHtml(copy)}</p>
    </article>
  `;
}

function getProjectDetailTasks(project) {
  const tasks = Array.isArray(project?.tasks)
    ? project.tasks.filter((task) => String(task?.effectiveStatus || "") !== "completed")
    : [];
  // 优先按可执行时间排序，再按稳定的文本字段收口，避免重复展开或重渲染后顺序变化。
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

function renderProjectTaskList(project) {
  const tasks = getProjectDetailTasks(project);
  if (!tasks.length) {
    return '<p class="detail-task-empty">当前项目暂无待办任务。</p>';
  }

  return `
    <div class="detail-task-list" role="list" aria-label="当前项目任务列表">
      ${tasks
        .map(
          (task) => {
            const forwardTaskLabel = ["处理任务：", task.title || "任务"].join("");
            return `
            <article class="detail-task-item" role="listitem">
              <div class="detail-task-item-head">
                <strong>${escapeDisplayHtml(task.title || "未命名任务")}</strong>
                <div class="detail-task-item-head-actions">
                  <span class="detail-task-item-status status-${escapeHtml(task.effectiveStatus || "todo")}">${escapeDisplayHtml(formatTaskStatusLabel(task.effectiveStatus))}</span>
                  <button
                    class="detail-task-forward-button"
                    type="button"
                    data-open-task-center-project="${escapeHtml(project.id)}"
                    data-open-task-center-group="${escapeHtml(resolveTaskBoardGroup(task))}"
                    title="前往任务中心处理该医院项目任务"
                    aria-label="${escapeHtml(forwardTaskLabel)}"
                  >
                    前往处理
                  </button>
                </div>
              </div>
              <p class="detail-task-item-copy">${escapeDisplayHtml(task.description || "暂无任务说明")}</p>
              <div class="detail-task-item-meta">
                <span>${escapeDisplayHtml(task.assigneeName || "--")}</span>
                <span>${escapeDisplayHtml(formatProjectTaskTime(task))}</span>
              </div>
            </article>
          `;
          },
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
          <span>任务总数</span>
          <strong>${taskCount} 项</strong>
        </span>
        <span class="detail-metric-toggle-icon ${expanded ? "is-expanded" : ""}" aria-hidden="true">▾</span>
      </button>
      <small>展开后可查看任务明细。</small>
      <div
        class="detail-metric-expand-panel"
        id="projectDetailTaskList-${escapeHtml(project.id)}"
        ${expanded ? "" : "hidden"}
      >
        ${renderProjectTaskList(project)}
      </div>
      <div class="detail-metric-card-actions">
        <button
          class="chip"
          type="button"
          data-open-task-center-project="${escapeHtml(project.id)}"
        >
          查看任务
        </button>
      </div>
    </article>
  `;
}

function clearContactLongPressTimer() {
  if (!contactLongPressState.timer) {
    return;
  }
  clearTimeout(contactLongPressState.timer);
  contactLongPressState.timer = null;
}

function clearContactEditorWiggleTimer() {
  if (!contactEditorGestureState.wiggleTimer) {
    return;
  }
  clearTimeout(contactEditorGestureState.wiggleTimer);
  contactEditorGestureState.wiggleTimer = null;
}

function clearContactEditorGestureStyles() {
  const sourceCard = contactEditorGestureState.sourceCard;
  if (sourceCard) {
    sourceCard.classList.remove("is-dragging", "is-merge-source", "is-snapping", "is-wiggling");
    sourceCard.style.transform = "";
    sourceCard.style.transition = "";
  }
  const targetCard = contactEditorGestureState.targetCard;
  if (targetCard) {
    targetCard.classList.remove("is-merge-target");
  }
}

function resetContactEditorGestureState() {
  clearContactEditorWiggleTimer();
  clearContactEditorGestureStyles();
  contactEditorGestureState.pointerId = null;
  contactEditorGestureState.projectId = "";
  contactEditorGestureState.sourceIndex = -1;
  contactEditorGestureState.targetIndex = -1;
  contactEditorGestureState.sourceCard = null;
  contactEditorGestureState.targetCard = null;
  contactEditorGestureState.startClientX = 0;
  contactEditorGestureState.startClientY = 0;
  contactEditorGestureState.translateX = 0;
  contactEditorGestureState.translateY = 0;
  contactEditorGestureState.sourceRect = null;
  contactEditorGestureState.dragging = false;
  contactEditorGestureState.decidingMerge = false;
}

function beginContactEditorCardGesture(event, cardElement) {
  if (contactEditorGestureState.pointerId !== null || contactEditorGestureState.decidingMerge) {
    return;
  }
  const projectId = String(cardElement.dataset.projectId || "").trim();
  const sourceIndex = Number(cardElement.dataset.contactIndex);
  if (!isContactEditorActive(projectId)) {
    return;
  }
  if (
    !Number.isInteger(sourceIndex) ||
    sourceIndex < 0 ||
    sourceIndex >= state.contactEditor.draftContacts.length
  ) {
    return;
  }

  clearContactEditorWiggleTimer();
  cardElement.classList.remove("is-wiggling");
  contactEditorGestureState.pointerId = event.pointerId;
  contactEditorGestureState.projectId = projectId;
  contactEditorGestureState.sourceIndex = sourceIndex;
  contactEditorGestureState.targetIndex = -1;
  contactEditorGestureState.sourceCard = cardElement;
  contactEditorGestureState.targetCard = null;
  contactEditorGestureState.startClientX = Number(event.clientX) || 0;
  contactEditorGestureState.startClientY = Number(event.clientY) || 0;
  contactEditorGestureState.translateX = 0;
  contactEditorGestureState.translateY = 0;
  contactEditorGestureState.sourceRect = cardElement.getBoundingClientRect();
  contactEditorGestureState.dragging = false;

  contactEditorGestureState.wiggleTimer = setTimeout(() => {
    if (
      contactEditorGestureState.sourceCard === cardElement &&
      !contactEditorGestureState.dragging &&
      !contactEditorGestureState.decidingMerge
    ) {
      cardElement.classList.add("is-wiggling");
      setTimeout(() => {
        cardElement.classList.remove("is-wiggling");
      }, 1200);
    }
  }, CONTACT_LONG_PRESS_MS);
}

function getContactCardOverlapRatio(sourceRect, targetRect) {
  if (!sourceRect || !targetRect) {
    return 0;
  }
  const left = Math.max(sourceRect.left, targetRect.left);
  const right = Math.min(sourceRect.right, targetRect.right);
  const top = Math.max(sourceRect.top, targetRect.top);
  const bottom = Math.min(sourceRect.bottom, targetRect.bottom);
  if (right <= left || bottom <= top) {
    return 0;
  }
  const overlapArea = (right - left) * (bottom - top);
  const targetArea = Math.max(targetRect.width * targetRect.height, 1);
  return overlapArea / targetArea;
}

function updateContactEditorCardGesture(event) {
  if (
    contactEditorGestureState.pointerId === null ||
    contactEditorGestureState.pointerId !== event.pointerId ||
    !contactEditorGestureState.sourceCard ||
    contactEditorGestureState.decidingMerge
  ) {
    return;
  }

  const deltaX = (Number(event.clientX) || 0) - contactEditorGestureState.startClientX;
  const deltaY = (Number(event.clientY) || 0) - contactEditorGestureState.startClientY;
  const movedDistance = Math.hypot(deltaX, deltaY);
  if (!contactEditorGestureState.dragging && movedDistance < CONTACT_DRAG_START_DISTANCE) {
    return;
  }
  const dragStartedNow = !contactEditorGestureState.dragging;
  contactEditorGestureState.dragging = true;
  if (dragStartedNow && typeof contactEditorGestureState.sourceCard.setPointerCapture === "function") {
    try {
      contactEditorGestureState.sourceCard.setPointerCapture(event.pointerId);
    } catch (error) {
      // 某些环境不支持指针捕获，这里忽略异常即可。
    }
  }
  clearContactEditorWiggleTimer();
  contactEditorGestureState.sourceCard.classList.remove("is-wiggling");

  contactEditorGestureState.translateX = deltaX;
  contactEditorGestureState.translateY = deltaY;
  contactEditorGestureState.sourceCard.classList.add("is-dragging", "is-merge-source");
  contactEditorGestureState.sourceCard.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

  const movedRect = {
    left: contactEditorGestureState.sourceRect.left + deltaX,
    right: contactEditorGestureState.sourceRect.right + deltaX,
    top: contactEditorGestureState.sourceRect.top + deltaY,
    bottom: contactEditorGestureState.sourceRect.bottom + deltaY,
  };

  const cards = Array.from(elements.projectDetail.querySelectorAll("[data-contact-edit-card][data-contact-index]"));
  let bestTarget = null;
  let bestRatio = 0;
  for (const card of cards) {
    const index = Number(card.dataset.contactIndex);
    if (
      !Number.isInteger(index) ||
      index === contactEditorGestureState.sourceIndex ||
      String(card.dataset.projectId || "").trim() !== contactEditorGestureState.projectId
    ) {
      continue;
    }
    const ratio = getContactCardOverlapRatio(movedRect, card.getBoundingClientRect());
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestTarget = { index, card };
    }
  }

  if (contactEditorGestureState.targetCard && contactEditorGestureState.targetCard !== bestTarget?.card) {
    contactEditorGestureState.targetCard.classList.remove("is-merge-target");
  }
  if (bestTarget && bestRatio >= CONTACT_MERGE_OVERLAP_THRESHOLD) {
    contactEditorGestureState.targetCard = bestTarget.card;
    contactEditorGestureState.targetIndex = bestTarget.index;
    bestTarget.card.classList.add("is-merge-target");
  } else {
    contactEditorGestureState.targetCard = null;
    contactEditorGestureState.targetIndex = -1;
  }
}

function appendContactMergeAction(action) {
  if (!action || typeof action !== "object") {
    return;
  }
  state.contactEditor.mergeActions.push({
    sourceContactId: String(action.sourceContactId || ""),
    targetContactId: String(action.targetContactId || ""),
    sourceSnapshot: {
      name: String(action.sourceSnapshot?.name || ""),
      roleTitle: String(action.sourceSnapshot?.roleTitle || ""),
    },
    targetSnapshot: {
      name: String(action.targetSnapshot?.name || ""),
      roleTitle: String(action.targetSnapshot?.roleTitle || ""),
    },
  });
}

function applyContactDraftMerge(projectId, sourceIndex, targetIndex) {
  if (!isContactEditorActive(projectId)) {
    return false;
  }
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) || sourceIndex === targetIndex) {
    return false;
  }
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= state.contactEditor.draftContacts.length ||
    targetIndex >= state.contactEditor.draftContacts.length
  ) {
    return false;
  }

  const sourceRow = state.contactEditor.draftContacts[sourceIndex];
  const targetRow = state.contactEditor.draftContacts[targetIndex];
  if (!sourceRow || !targetRow) {
    return false;
  }

  appendContactMergeAction({
    sourceContactId: sourceRow.id || "",
    targetContactId: targetRow.id || "",
    sourceSnapshot: sourceRow,
    targetSnapshot: targetRow,
  });

  targetRow.name = String(sourceRow.name || "");
  targetRow.roleTitle = String(sourceRow.roleTitle || "");

  state.contactEditor.draftContacts.splice(sourceIndex, 1);
  return true;
}

function endContactEditorCardGesture(event) {
  if (contactEditorGestureState.pointerId === null) {
    return;
  }
  if (
    event &&
    event.pointerId !== undefined &&
    event.pointerId !== null &&
    contactEditorGestureState.pointerId !== event.pointerId
  ) {
    return;
  }

  const pointerId = contactEditorGestureState.pointerId;
  const projectId = contactEditorGestureState.projectId;
  const sourceIndex = contactEditorGestureState.sourceIndex;
  const targetIndex = contactEditorGestureState.targetIndex;
  const sourceCard = contactEditorGestureState.sourceCard;
  const targetCard = contactEditorGestureState.targetCard;
  const sourceRect = contactEditorGestureState.sourceRect;
  const isDragging = contactEditorGestureState.dragging;

  clearContactEditorWiggleTimer();
  if (sourceCard && typeof sourceCard.hasPointerCapture === "function") {
    try {
      if (sourceCard.hasPointerCapture(pointerId)) {
        sourceCard.releasePointerCapture(pointerId);
      }
    } catch (error) {
      // 某些环境释放指针捕获时会报错，这里忽略即可。
    }
  }

  if (isDragging) {
    contactEditorGestureState.lastDragEndedAt = Date.now();
  }

  if (!isDragging || !sourceCard || !sourceRect || targetIndex < 0 || !targetCard) {
    resetContactEditorGestureState();
    return;
  }

  const targetRect = targetCard.getBoundingClientRect();
  const snapOffsetX =
    targetRect.left -
    sourceRect.left +
    (targetRect.width - sourceRect.width) * (1 - CONTACT_MERGE_SNAP_RATIO);
  const snapOffsetY =
    targetRect.top -
    sourceRect.top +
    (targetRect.height - sourceRect.height) * (1 - CONTACT_MERGE_SNAP_RATIO);
  sourceCard.classList.remove("is-merge-source");
  sourceCard.classList.add("is-snapping");
  sourceCard.style.transition = "transform 140ms ease-out";
  sourceCard.style.transform = `translate(${snapOffsetX}px, ${snapOffsetY}px)`;
  contactEditorGestureState.decidingMerge = true;

  window.setTimeout(() => {
    const confirmed = window.confirm("是否覆盖");
    resetContactEditorGestureState();
    if (!confirmed) {
      return;
    }
    const merged = applyContactDraftMerge(projectId, sourceIndex, targetIndex);
    if (!merged) {
      showToast("覆盖合并失败，请重试", "warn");
      return;
    }
    renderProjectDetail();
    showToast("名片覆盖已记录，点击“完成”保存", "ready");
  }, 150);
}

function isContactEditorActive(projectId) {
  return String(projectId || "").trim() && state.contactEditor.editingProjectId === String(projectId || "").trim();
}

function hasContactEditorChanges(projectId) {
  if (!isContactEditorActive(projectId)) {
    return false;
  }
  const draftContacts = normalizeContactDraftRows(state.contactEditor.draftContacts);
  const originalContacts = normalizeContactOriginalRows(state.contactEditor.originalContacts);
  const mergeActions = normalizeContactMergeActions(state.contactEditor.mergeActions);
  return JSON.stringify(draftContacts) !== JSON.stringify(originalContacts) || mergeActions.length > 0;
}

function renderContactToken(projectId, index, field, label, value, disabled) {
  const normalizedValue = String(value || "").trim();
  const displayValue = normalizedValue ? normalizeDisplayText(normalizedValue) : `点击填写${label}`;
  const emptyClass = normalizedValue ? "" : " is-empty";
  return `
    <button
      class="detail-contact-token${emptyClass}"
      type="button"
      data-contact-token="true"
      data-project-id="${escapeHtml(projectId)}"
      data-contact-index="${index}"
      data-contact-field="${escapeHtml(field)}"
      ${disabled ? "disabled" : ""}
    >
      <span>${escapeDisplayHtml(label)}</span>
      <strong>${escapeDisplayHtml(displayValue)}</strong>
    </button>
  `;
}

function renderContactEditorRows(projectId, draftContacts) {
  const disabled = state.busy || state.followup.busy || state.contactEditor.saving;
  if (!draftContacts.length) {
    return '<p class="detail-contact-edit-empty">当前无联系人，点击“新增名片”后可开始编辑。</p>';
  }
  return draftContacts
    .map(
      (contact, index) => {
        const dragHandleLabel = ["拖动名片", index + 1].join(" ");
        return `
        <article class="detail-contact-edit-card" data-contact-edit-card="true" data-project-id="${escapeHtml(projectId)}" data-contact-index="${index}">
          <div class="detail-contact-edit-card-top">
            <span>名片 ${index + 1}</span>
            <button
              class="detail-contact-drag-handle"
              type="button"
              data-contact-drag-handle="true"
              data-project-id="${escapeHtml(projectId)}"
              data-contact-index="${index}"
              aria-label="${escapeHtml(dragHandleLabel)}"
              title="按住拖动名片"
            >
              ≡
            </button>
            <span>仅可覆盖</span>
          </div>
          <div class="detail-contact-token-grid">
            ${renderContactToken(projectId, index, "name", "姓名", contact.name, disabled)}
            ${renderContactToken(projectId, index, "roleTitle", "角色", contact.roleTitle, disabled)}
          </div>
        </article>
      `;
      },
    )
    .join("");
}

function resetContactEditorState(options = {}) {
  const projectId = String(options?.projectId || "").trim();
  if (projectId && state.contactEditor.editingProjectId && state.contactEditor.editingProjectId !== projectId) {
    return;
  }
  state.contactEditor.editingProjectId = "";
  state.contactEditor.draftContacts = [];
  state.contactEditor.originalContacts = [];
  state.contactEditor.mergeActions = [];
  state.contactEditor.saving = false;
  clearContactLongPressTimer();
  resetContactEditorGestureState();
  contactLongPressState.triggered = false;
}

function startContactEditor(projectId) {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return;
  }
  const project = state.bootstrap?.projects?.find((item) => item.id === normalizedProjectId);
  if (!project) {
    return;
  }
  state.contactEditor.editingProjectId = normalizedProjectId;
  state.contactEditor.draftContacts = toContactDraftRows(project.contacts);
  state.contactEditor.originalContacts = toContactDraftRows(project.contacts);
  state.contactEditor.mergeActions = [];
  state.contactEditor.saving = false;
  clearContactLongPressTimer();
  resetContactEditorGestureState();
  contactLongPressState.triggered = false;
  renderProjectDetail();
}

function appendContactDraftRow(projectId) {
  if (!isContactEditorActive(projectId)) {
    return;
  }
  state.contactEditor.draftContacts.push({
    id: generateTempContactId(),
    name: "",
    roleTitle: "",
  });
  renderProjectDetail();
}

function removeContactDraftRow(projectId, rowIndex) {
  if (!isContactEditorActive(projectId)) {
    return;
  }
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= state.contactEditor.draftContacts.length) {
    return;
  }
  showToast("编辑状态下不能删除联系人，请通过覆盖合并", "warn");
}

async function saveContactEditor(projectId) {
  if (!isContactEditorActive(projectId)) {
    return;
  }

  let contacts;
  let originalContacts;
  try {
    contacts = validateContactDraftRows(normalizeContactDraftRows(state.contactEditor.draftContacts));
    originalContacts = normalizeContactOriginalRows(state.contactEditor.originalContacts);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "联系人内容校验失败", "warn");
    return;
  }
  const mergeActions = normalizeContactMergeActions(state.contactEditor.mergeActions);

  const editingProjectId = state.contactEditor.editingProjectId;
  state.contactEditor.saving = true;
  renderProjectDetail();
  showToast("正在保存联系人", "busy");
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(editingProjectId)}/contacts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts,
        originalContacts,
        mergeActions,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    applyBootstrapPayload(payload.bootstrap);
    ensureSelection();
    resetContactEditorState({ projectId: editingProjectId, silent: true });
    renderAll();
    showToast("联系人已保存", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "联系人保存失败", "error");
  } finally {
    if (state.contactEditor.editingProjectId === editingProjectId) {
      state.contactEditor.saving = false;
      renderProjectDetail();
    }
  }
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
  const isContactEditing = isContactEditorActive(project.id);
  const contactDraftRows = isContactEditing ? state.contactEditor.draftContacts : [];
  const updates = project.updates || [];
  const visibleProjectCount = Array.isArray(state.bootstrap?.projects) ? state.bootstrap.projects.length : 0;
  const contactScopeHint =
    visibleProjectCount > 1
      ? `当前仅展示已选项目的联系人；当前账号可见 ${visibleProjectCount} 个项目。`
      : "当前仅展示已选项目的联系人。";
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
  const contactWarnings = Array.isArray(project.contactReferenceWarnings) ? project.contactReferenceWarnings : [];
  elements.projectDetail.innerHTML = `
    <section class="detail-overview">
      <article class="detail-hero-card">
        <div class="detail-hero-head">
          <div class="detail-hero-copy-wrap">
            <p class="panel-eyebrow">${escapeDisplayHtml(regionLine || project.region?.name || "--")}</p>
            <h3>${escapeDisplayHtml(project.hospital.name)}</h3>
          </div>
          <div class="detail-pill-row">
            <span class="stage-pill">${escapeDisplayHtml(project.stage.name)}</span>
            <span class="risk-pill risk-${escapeHtml(project.riskLevel)}">${escapeDisplayHtml(formatRiskLevelLabel(project.riskLevel))}</span>
          </div>
        </div>
        <p class="detail-copy">${escapeDisplayHtml(project.latestSummary || "暂无推进摘要")}</p>
        <div class="token-row detail-token-row">${renderTagList(project.issueNames)}</div>
      </article>

      <article class="detail-action-card">
        <p class="panel-eyebrow">当前推进</p>
        <strong>${escapeDisplayHtml(nextActionText)}</strong>
        <p>${escapeDisplayHtml(projectHealthText)} · ${escapeDisplayHtml(progressText)}</p>
        <div class="detail-action-meta">
          <span>负责人：${escapeDisplayHtml(project.owner?.name || "--")}</span>
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
          <div class="detail-contact-head-copy">
            <h4>关键联系人</h4>
            <span>${escapeDisplayHtml(contactScopeHint)}</span>
          </div>
          <div class="detail-contact-head-actions">
            <span>${isContactEditing ? `${contactDraftRows.length} 行` : `${contacts.length} 位`}</span>
            ${
              isContactEditing
                ? ""
                : `
                    <button
                      class="chip detail-contact-edit-trigger"
                      type="button"
                      data-contact-action="edit"
                      data-project-id="${escapeHtml(project.id)}"
                      ${state.busy || state.followup.busy || state.contactEditor.saving ? "disabled" : ""}
                    >
                      编辑
                    </button>
                  `
            }
          </div>
        </div>
        ${
          contactWarnings.length
            ? `<div class="warning-box detail-contact-warning-box">${escapeDisplayHtml(contactWarnings.join(" | "))}</div>`
            : ""
        }
        ${
          isContactEditing
            ? `
                <div class="detail-contact-edit-panel">
                  <p class="detail-contact-edit-hint">点击词条可编辑文本；编辑状态下名片不能删除，只能通过顶部中央手柄拖拽覆盖合并；同名联系人允许并存，但至少需要角色来区分。</p>
                  <div class="detail-contact-edit-list">
                    ${renderContactEditorRows(project.id, contactDraftRows)}
                  </div>
                  <div class="detail-contact-edit-actions">
                    <button
                      class="chip detail-contact-edit-action"
                      type="button"
                      data-contact-action="add"
                      data-project-id="${escapeHtml(project.id)}"
                      ${state.busy || state.followup.busy || state.contactEditor.saving ? "disabled" : ""}
                    >
                      新增名片
                    </button>
                    <button
                      class="chip detail-contact-edit-action"
                      type="button"
                      data-contact-action="cancel"
                      data-project-id="${escapeHtml(project.id)}"
                      ${state.contactEditor.saving ? "disabled" : ""}
                    >
                      放弃编辑
                    </button>
                    <button
                      class="primary-button detail-contact-edit-action detail-contact-complete-trigger"
                      type="button"
                      data-contact-action="save"
                      data-project-id="${escapeHtml(project.id)}"
                      ${state.busy || state.followup.busy || state.contactEditor.saving ? "disabled" : ""}
                    >
                      ${state.contactEditor.saving ? "保存中..." : "完成"}
                    </button>
                  </div>
                </div>
              `
            : `
                <div class="contact-list detail-contact-list">
                  ${
                    contacts.length
                      ? contacts
                          .map(
                            (contact) => `
                      <article class="contact-card detail-contact-card" data-contact-card="true" data-project-id="${escapeHtml(project.id)}">
                        <strong>${escapeDisplayHtml(contact.name)}</strong>
                        <span>${escapeDisplayHtml(contact.roleTitle || "角色未填写")}</span>
                      </article>
                    `,
                          )
                          .join("")
                      : renderDetailEmptyState("暂无关键联系人", "当前项目尚未录入关键联系人，后续新增纪要后会自动补充。")
                  }
                </div>
                <p class="detail-contact-longpress-hint">长按联系人卡片 1 秒可快速进入编辑模式。</p>
              `
        }
      </article>

      <article class="detail-section detail-section-card">
        <div class="detail-section-head">
          <h4>项目看板</h4>
          <span>${escapeDisplayHtml(project.owner?.name || "--")}</span>
        </div>
        <div class="detail-note-grid">
          <article class="detail-note-card">
            <span>医院等级</span>
            <strong>${escapeDisplayHtml(project.hospital.level || "--")}</strong>
          </article>
          <article class="detail-note-card">
            <span>所在城市</span>
            <strong>${escapeDisplayHtml(project.hospital.city || "--")}</strong>
          </article>
          <article class="detail-note-card">
            <span>管理关注</span>
            <strong>${escapeDisplayHtml(projectHealthText)}</strong>
          </article>
          <article class="detail-note-card">
            <span>项目状态</span>
            <strong>${escapeDisplayHtml(project.isStalled ? `停滞 ${project.stalledDays} 天` : "持续推进中")}</strong>
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
              <strong>${escapeDisplayHtml(update.stageAfterName || "推进记录")}</strong>
              <span>${escapeDisplayHtml(formatDate(update.visitDate || update.createdAt))}</span>
            </div>
            <p>${escapeDisplayHtml(update.feedbackSummary || "暂无推进摘要")}</p>
            ${update.blockers ? `<small>阻塞：${escapeDisplayHtml(update.blockers)}</small>` : ""}
            ${
              canLeaveProjectRemarks
                ? `
                  <div class="timeline-item-footer">
                    <button
                      class="chip timeline-item-remark-trigger"
                      type="button"
                      data-create-project-remark="${escapeHtml(project.id)}"
                      data-update-id="${escapeHtml(update.id)}"
                    >
                      留言
                    </button>
                  </div>
                `
                : ""
            }
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

function renderLedgerSubTabs() {
  const activeLedgerSubTab = normalizeLedgerSubTab(state.ledgerSubTab);
  state.ledgerSubTab = activeLedgerSubTab;

  const listTabButton = document.querySelector("[data-ledger-subtab='list']");
  const detailTabButton = document.querySelector("[data-ledger-subtab='detail']");
  const subtabCopy = document.querySelector("#ledgerSubtabCopy");
  applyLedgerSubTabs({
    activeLedgerSubTab,
    listTabButton,
    detailTabButton,
    projectList: elements.projectList,
    projectDetail: elements.projectDetail,
    subtabCopy,
  });
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
              .map((item) => `<span>${escapeDisplayHtml(item)}</span>`)
              .join("");
            const replyMeta = [
              replyByUserName ? `回复人：${replyByUserName}` : "已回复",
            ]
              .filter(Boolean)
              .map((item) => `<span>${escapeDisplayHtml(item)}</span>`)
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
                  <p class="timeline-remark-content">${escapeDisplayHtml(remark.content || "--")}</p>
                </div>
                ${
                  replyContent
                    ? `
                      <div class="remark-reply timeline-remark-reply">
                        <span>回复记录</span>
                        <div class="timeline-remark-meta">${replyMeta}</div>
                        <p>${escapeDisplayHtml(replyContent)}</p>
                      </div>
                    `
                    : '<p class="remark-status is-pending">该留言尚未回复，可点击右侧按钮立即回复。</p>'
                }
                <div class="timeline-remark-foot">
                  <small class="timeline-remark-read">${escapeDisplayHtml(readMetaText)}</small>
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

async function createProjectRemarkFromHistoryEntry({ historySessionId, historyQuestionId, session }) {
  const normalizedHistorySessionId = String(historySessionId || "").trim();
  const normalizedHistoryQuestionId = String(historyQuestionId || "").trim();
  if (!normalizedHistorySessionId || !normalizedHistoryQuestionId) {
    showToast("历史条目标识缺失，请刷新后重试", "error");
    return;
  }

  const matchedSession =
    session && session.sessionId === normalizedHistorySessionId
      ? session
      : (state.historyInfo.sessions || []).find((item) => item.sessionId === normalizedHistorySessionId) || null;
  if (!matchedSession) {
    showToast("历史信息已变化，请刷新后重试", "warn");
    return;
  }

  const matchedHistoryItem = (matchedSession.history || []).find((item) => item.id === normalizedHistoryQuestionId) || null;
  if (!matchedHistoryItem) {
    showToast("历史条目已变化，请刷新后重试", "warn");
    return;
  }

  const project = state.bootstrap?.projects?.find((item) => item.id === matchedSession.projectId) || null;
  if (!project) {
    showToast("未找到关联项目，请刷新后重试", "error");
    return;
  }

  const toUserId = String(matchedHistoryItem.answer?.submittedByUserId || project.owner?.id || "").trim();
  if (!toUserId) {
    showToast("未找到留言接收人，请刷新后重试", "error");
    return;
  }

  const targetName = String(matchedHistoryItem.answer?.submittedByUserName || project.owner?.name || "专员").trim() || "专员";
  await createProjectRemark(project.id, {
    toUserId,
    historySessionId: normalizedHistorySessionId,
    historyQuestionId: normalizedHistoryQuestionId,
    promptTitle: `请输入给“${targetName}”的留言内容`,
  });
}

async function createProjectRemark(projectId, options = {}) {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return;
  }

  const project = state.bootstrap?.projects?.find((item) => item.id === normalizedProjectId) || null;
  if (!project) {
    showToast("未找到对应项目", "error");
    return;
  }

  const toUserId = String(options?.toUserId || "").trim();
  const updateId = String(options?.updateId || "").trim();
  const historySessionId = String(options?.historySessionId || "").trim();
  const historyQuestionId = String(options?.historyQuestionId || "").trim();
  const promptTitle = String(options?.promptTitle || "").trim();
  const targetUpdate = updateId ? (project.updates || []).find((item) => String(item?.id || "") === updateId) || null : null;

  if (updateId && !targetUpdate) {
    showToast("目标纪要已变化，请刷新后重试", "error");
    return;
  }

  const hasHistoryLinkage = Boolean(historySessionId || historyQuestionId);
  if (hasHistoryLinkage && (!historySessionId || !historyQuestionId)) {
    showToast("历史关联参数不完整，请刷新后重试", "error");
    return;
  }

  if (toUserId) {
    const existsInLookups = (state.bootstrap?.lookups?.users || []).some((user) => String(user?.id || "") === toUserId);
    if (!existsInLookups) {
      showToast("留言接收人不存在，请刷新后重试", "error");
      return;
    }
  }

  const defaultPromptTitle = targetUpdate
    ? `请输入给“${normalizeDisplayText(project.hospital?.name || targetUpdate.hospitalName || "当前项目")} ${formatDate(targetUpdate.visitDate || targetUpdate.createdAt)}”纪要的留言内容`
    : `请输入给“${normalizeDisplayText(project.hospital?.name || "当前项目")}”的留言内容`;
  const content = window.prompt(promptTitle || defaultPromptTitle, "");
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
      body: JSON.stringify({
        content: trimmedContent,
        toUserId: toUserId || undefined,
        updateId: updateId || undefined,
        historySessionId: historySessionId || undefined,
        historyQuestionId: historyQuestionId || undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    applyBootstrapPayload(payload.bootstrap);
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
    showToast("未找到该条留言", "error");
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
  clearDepartmentInput();
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
    invalidateIntakePreview({ preserveResult: true, staleReason: "supplement" });
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
      ? "补充内容会并入本次回复纪要的下一次生成。保存后当前回复摘要会失效，需要重新生成。"
      : "补充内容会并入普通纪要的下一次生成。保存后当前结果会失效，需要重新生成。";
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

    applyBootstrapPayload(payload.bootstrap);
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

  applyBootstrapPayload(payload.bootstrap);
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
  ensureTaskBoardState();
  const filteredTasks = getTaskBoardFilteredTasks();
  const activeGroup = String(state.taskBoard.activeGroup || "todo").trim();
  const tasks = sortTaskBoardTasks(filteredTasks.filter((task) => resolveTaskBoardGroup(task) === activeGroup)).map(
    (task) => decorateTaskBoardTask(task),
  );
  const groupDefs = [
    { id: "overdue", label: "已逾期" },
    { id: "todo", label: "待处理" },
    { id: "completed", label: "已完成" },
  ].map((group) => ({
    ...group,
    count: filteredTasks.filter((task) => resolveTaskBoardGroup(task) === group.id).length,
  }));

  elements.taskBoard.innerHTML = renderTaskBoardMarkup({
    projectOptions: getVisibleTaskBoardProjectOptions(),
    selectedProjectId: state.taskBoard.projectFilterId,
    projectSearchOpen: state.taskBoard.projectSearchOpen,
    projectKeyword: state.taskBoard.projectKeyword,
    activeGroup,
    groups: groupDefs,
    sortField: state.taskBoard.sortField,
    sortDirection: state.taskBoard.sortDirection,
    tasks,
    renderTaskCard,
  });
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

  const summaryContent = renderInsightSummaryContent({
    dashboard,
    renderBarRow,
    renderTagList,
  });
  const recentContent = renderInsightRecentContent({
    recentUpdates: signals?.recentUpdates || [],
    resolveUpdateHospitalName,
  });
  const managementContent = renderInsightManagementContent({
    management,
    canManageUsers,
    canManageBackups,
    renderManagementUserItem,
    renderBackupAdminPanel,
  });

  let subTabContent = summaryContent;
  if (activeInsightSubTab === "recent") {
    subTabContent = recentContent;
  } else if (activeInsightSubTab === "management") {
    subTabContent = managementContent;
  }

  elements.insightPanel.innerHTML = renderInsightPanelMarkup({
    activeInsightSubTab,
    subTabs,
    subTabContent,
  });
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

function renderBackupAdminPanel(canManageBackups) {
  const panelState = resolveBackupPanelState(state.backups);
  const scheduleText = formatBackupSchedule(panelState.schedule);
  const actionDisabled = state.backups.busy || state.busy || state.auth.busy;
  return renderBackupAdminPanelMarkup({
    canManageBackups,
    backupsState: state.backups,
    panelState,
    actionDisabled,
    scheduleText,
  });
}

function renderManagementUserItem(user, canManageUsers) {
  const regions = getAvailableRegions();
  const supervisorOptions = getSupervisorOptionsForUser(user);
  return renderManagementUserItemMarkup(user, canManageUsers, regions, supervisorOptions);
}

function getSelectedProject() {
  return state.bootstrap?.projects.find((project) => project.id === state.selectedProjectId) || null;
}

function applyHealthState(health) {
  document.title = health.configured ? "智能医院导入管理系统" : "智能医院导入管理系统 · 接口未配置";
}

function setBusy(isBusy) {
  state.busy = isBusy;
  elements.submitButton.disabled = isBusy;
  elements.noteInput.disabled = isBusy;
  elements.projectSelect.disabled = isBusy || !getVisibleProjects().length;
  if (elements.departmentInput) {
    elements.departmentInput.disabled = isBusy || !getVisibleProjects().length;
  }
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
  if (elements.newProjectDepartmentInput) {
    elements.newProjectDepartmentInput.disabled = isBusy;
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
  renderTaskDueDialog();
  renderTaskRecordDialog();
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

function buildTaskBoardProjectLabel(project) {
  if (!project) {
    return "";
  }
  const hospitalName = String(project?.hospital?.name || "").trim();
  const departmentName = String(project?.departmentName || "").trim();
  if (hospitalName && departmentName) {
    return `${hospitalName}-${departmentName}`;
  }
  return hospitalName || departmentName || String(project?.id || "").trim();
}

function getTaskBoardProjectOptions() {
  const tasks = Array.isArray(state.bootstrap?.tasks) ? state.bootstrap.tasks : [];
  const counts = new Map();
  for (const task of tasks) {
    const projectId = String(task?.projectId || "").trim();
    if (!projectId) {
      continue;
    }
    counts.set(projectId, (counts.get(projectId) || 0) + 1);
  }

  return (Array.isArray(state.bootstrap?.projects) ? state.bootstrap.projects : [])
    .filter((project) => counts.has(String(project?.id || "").trim()))
    .map((project) => ({
      id: String(project.id || "").trim(),
      label: buildTaskBoardProjectLabel(project),
      hospitalName: String(project?.hospital?.name || "").trim(),
      city: String(project?.hospital?.city || "").trim(),
      departmentName: String(project?.departmentName || "").trim(),
      taskCount: Number(counts.get(String(project.id || "").trim()) || 0),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

function getVisibleTaskBoardProjectOptions() {
  const options = getTaskBoardProjectOptions();
  const keyword = String(state.taskBoard.projectKeyword || "").trim().toLowerCase();
  if (!keyword) {
    return options;
  }
  return options.filter((option) => {
    const haystack = `${option.label} ${option.hospitalName} ${option.city} ${option.departmentName}`.toLowerCase();
    return haystack.includes(keyword);
  });
}

function resolveTaskBoardGroup(task) {
  const status = String(task?.effectiveStatus || task?.status || "").trim();
  if (status === "completed") {
    return "completed";
  }
  if (status === "overdue") {
    return "overdue";
  }
  return "todo";
}

function compareTaskBoardDates(leftValue, rightValue, direction = "asc") {
  const leftTime = leftValue ? new Date(leftValue).getTime() : Number.NaN;
  const rightTime = rightValue ? new Date(rightValue).getTime() : Number.NaN;
  const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
  return direction === "desc" ? safeRight - safeLeft : safeLeft - safeRight;
}

function compareTaskBoardText(leftValue, rightValue) {
  return String(leftValue || "").localeCompare(String(rightValue || ""), "zh-CN");
}

function sortTaskBoardTasks(tasks) {
  const safeTasks = Array.isArray(tasks) ? [...tasks] : [];
  const sortField = state.taskBoard.sortField === "startAt" ? "startAt" : "dueAt";
  const sortDirection = state.taskBoard.sortDirection === "desc" ? "desc" : "asc";

  return safeTasks.sort((left, right) => {
    if (sortField === "dueAt") {
      const leftHasDueAt = Boolean(left?.dueAt);
      const rightHasDueAt = Boolean(right?.dueAt);
      if (leftHasDueAt !== rightHasDueAt) {
        return leftHasDueAt ? -1 : 1;
      }
      if (leftHasDueAt && rightHasDueAt) {
        const dueDelta = compareTaskBoardDates(left.dueAt, right.dueAt, sortDirection);
        if (dueDelta) {
          return dueDelta;
        }
      }
    } else {
      const startDelta = compareTaskBoardDates(left?.startAt, right?.startAt, sortDirection);
      if (startDelta) {
        return startDelta;
      }
    }

    const fallbackTimeDelta = compareTaskBoardDates(left?.startAt, right?.startAt, sortDirection);
    if (fallbackTimeDelta) {
      return fallbackTimeDelta;
    }

    const titleDelta = compareTaskBoardText(left?.title, right?.title);
    if (titleDelta) {
      return titleDelta;
    }

    return compareTaskBoardText(left?.id, right?.id);
  });
}

function getTaskBoardFilteredTasks() {
  const projectFilterId = String(state.taskBoard.projectFilterId || "").trim();
  const tasks = Array.isArray(state.bootstrap?.tasks) ? state.bootstrap.tasks : [];
  return projectFilterId ? tasks.filter((task) => String(task?.projectId || "").trim() === projectFilterId) : tasks;
}

function resolveDefaultTaskBoardGroup(tasks) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const groups = ["overdue", "todo", "completed"];
  for (const groupId of groups) {
    if (safeTasks.some((task) => resolveTaskBoardGroup(task) === groupId)) {
      return groupId;
    }
  }
  return "todo";
}

function ensureTaskBoardState() {
  const options = getTaskBoardProjectOptions();
  const filterId = String(state.taskBoard.projectFilterId || "").trim();
  if (filterId && !options.some((option) => option.id === filterId)) {
    state.taskBoard.projectFilterId = "";
  }

  const filteredTasks = getTaskBoardFilteredTasks();
  const currentGroup = String(state.taskBoard.activeGroup || "todo").trim();
  const allowedGroups = new Set(["overdue", "todo", "completed"]);
  const nextGroup = allowedGroups.has(currentGroup) ? currentGroup : "todo";
  if (!filteredTasks.some((task) => resolveTaskBoardGroup(task) === nextGroup)) {
    state.taskBoard.activeGroup = resolveDefaultTaskBoardGroup(filteredTasks);
  } else {
    state.taskBoard.activeGroup = nextGroup;
  }
}

function parseTaskBoardDateValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfTaskBoardDay(date) {
  const parsed = parseTaskBoardDateValue(date);
  if (!parsed) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

function getTaskBoardReferenceDate() {
  const businessDate = String(state.bootstrap?.health?.simulation?.currentDate || "").trim();
  if (businessDate) {
    return new Date(`${businessDate}T12:00:00`);
  }
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return now;
}

function getTaskBoardDayDelta(targetDate, baseDate) {
  const target = startOfTaskBoardDay(targetDate);
  const base = startOfTaskBoardDay(baseDate);
  if (!target || !base) {
    return null;
  }
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

function formatTaskBoardSignedDayLabel(delta) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) {
    return "";
  }
  if (delta > 0) {
    return `+${delta}天`;
  }
  if (delta < 0) {
    return `${delta}天`;
  }
  return "0天";
}

function buildTaskDueAdjustmentLabel(task) {
  const initialDueAt = String(task?.initialDueAt || "").trim();
  const currentDueAt = String(task?.dueAt || "").trim();
  if (!initialDueAt || !currentDueAt || initialDueAt === currentDueAt) {
    return "";
  }
  const delta = getTaskBoardDayDelta(currentDueAt, initialDueAt);
  if (delta === null || delta === 0) {
    return "";
  }
  return delta > 0 ? `已延期 ${formatTaskBoardSignedDayLabel(delta)}` : `已提前 ${formatTaskBoardSignedDayLabel(delta)}`;
}

function buildTaskTimeStatusLabel(task) {
  const dueAt = String(task?.dueAt || "").trim();
  if (!dueAt) {
    return task?.status === "completed" ? "已完成" : "无截止日";
  }

  if (task?.status === "completed" && task?.completedAt) {
    const completedDelta = getTaskBoardDayDelta(dueAt, task.completedAt);
    if (completedDelta === null) {
      return "已完成";
    }
    return formatTaskBoardSignedDayLabel(completedDelta);
  }

  const remainingDelta = getTaskBoardDayDelta(dueAt, getTaskBoardReferenceDate());
  if (remainingDelta === null) {
    return "无截止日";
  }
  if (remainingDelta > 0) {
    return `剩余 ${remainingDelta} 天`;
  }
  if (remainingDelta < 0) {
    return `逾期 ${Math.abs(remainingDelta)} 天`;
  }
  return "今天截止";
}

function decorateTaskBoardTask(task) {
  const project =
    (Array.isArray(state.bootstrap?.projects) ? state.bootstrap.projects : []).find(
      (item) => String(item?.id || "").trim() === String(task?.projectId || "").trim(),
    ) || null;

  return {
    ...task,
    projectLabel: buildTaskBoardProjectLabel(project) || String(task?.hospitalName || "").trim(),
    startDateLabel: formatDate(task?.startAt || task?.createdAt),
    initialDueDateLabel: task?.initialDueAt ? formatDate(task.initialDueAt) : "未设置",
    currentDueDateLabel: task?.dueAt ? formatDate(task.dueAt) : "未设置",
    dueAdjustmentLabel: buildTaskDueAdjustmentLabel(task),
    timeStatusLabel: buildTaskTimeStatusLabel(task),
    hasRecords: Number(task?.recordCount || 0) > 0,
  };
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
  resetContactEditorState({ silent: true });
  resetFollowupState();
  resetHistoryInfoState();
  renderAll();
}

function openTaskCenter(projectId = "", options = {}) {
  const normalizedProjectId = String(projectId || "").trim();
  const requestedGroupId = String(options?.groupId || "").trim();
  const visibleProjectIds = new Set(getTaskBoardProjectOptions().map((option) => option.id));
  state.activeTab = "tasks";
  if (normalizedProjectId && visibleProjectIds.has(normalizedProjectId)) {
    state.selectedProjectId = normalizedProjectId;
    state.taskBoard.projectFilterId = normalizedProjectId;
  } else {
    state.taskBoard.projectFilterId = "";
  }
  state.taskBoard.projectKeyword = "";
  state.taskBoard.projectSearchOpen = false;
  const filteredTasks = getTaskBoardFilteredTasks();
  const availableGroups = new Set(filteredTasks.map((task) => resolveTaskBoardGroup(task)));
  state.taskBoard.activeGroup =
    requestedGroupId && availableGroups.has(requestedGroupId)
      ? requestedGroupId
      : resolveDefaultTaskBoardGroup(filteredTasks);
  persistSelection();
  persistActiveTab();
  renderAll();
}

function persistSelection() {
  const value = state.selectedProjectId || "";
  localStorage.setItem(STORAGE_KEY, value);
  localStorage.setItem(getScopedProjectSelectionKey(), value);
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
    elements.sessionUserName.textContent = "未登录";
    elements.sessionUserRole.textContent = "请先登录后继续使用";
    elements.logoutButton.disabled = true;
    return;
  }
  elements.sessionUserName.textContent = normalizeDisplayText(currentUser.name || "未命名用户");
  const roleText = normalizeDisplayText(currentUser.roleName || currentUser.role || "--");
  const regionText = normalizeDisplayText(currentUser.regionName || "--");
  elements.sessionUserRole.textContent = `${roleText} · ${regionText}`;
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

function getManagementLookupUsers() {
  return Array.isArray(state.bootstrap?.lookups?.users) ? state.bootstrap.lookups.users : [];
}

function getSupervisorOptionsForUser(user, overrideRegionId = user?.regionId) {
  const normalizedRegionId = String(overrideRegionId || "").trim();
  return getManagementLookupUsers()
    .filter(
      (candidate) =>
        normalizeUserRole(candidate?.role) === "supervisor" && String(candidate?.regionId || "").trim() === normalizedRegionId,
    )
    .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "zh-CN"))
    .map((candidate) => ({
      id: String(candidate?.id || "").trim(),
      name: String(candidate?.name || "").trim(),
    }))
    .filter((candidate) => candidate.id);
}

function buildManagementSupervisorOptionMarkup(options, selectedSupervisorUserId = "") {
  const normalizedSelectedSupervisorUserId = String(selectedSupervisorUserId || "").trim();
  const safeOptions = Array.isArray(options) ? options : [];
  const rows = [
    `<option value="">未分配主管</option>`,
    ...safeOptions.map((item) => {
      const supervisorUserId = escapeHtml(String(item.id || ""));
      const selected = String(item.id || "").trim() === normalizedSelectedSupervisorUserId ? " selected" : "";
      return `<option value="${supervisorUserId}"${selected}>${escapeDisplayHtml(item.name || item.id || "--")}</option>`;
    }),
  ];
  return rows.join("");
}

function syncManagementSupervisorSelect(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return;
  }

  const regionSelect = elements.insightPanel.querySelector(
    `select[data-management-region-select="${escapeSelectorValue(normalizedUserId)}"]`,
  );
  const supervisorSelect = elements.insightPanel.querySelector(
    `select[data-management-supervisor-select="${escapeSelectorValue(normalizedUserId)}"]`,
  );
  if (!regionSelect || !supervisorSelect) {
    return;
  }

  const visibleUsers = Array.isArray(state.bootstrap?.management?.visibleUsers) ? state.bootstrap.management.visibleUsers : [];
  const user =
    visibleUsers.find((item) => String(item?.id || "").trim() === normalizedUserId) ||
    getManagementLookupUsers().find((item) => String(item?.id || "").trim() === normalizedUserId) ||
    null;
  const regionId = String(regionSelect.value || "").trim();
  const options = getSupervisorOptionsForUser(user, regionId);
  const previousValue = String(supervisorSelect.value || user?.supervisorUserId || "").trim();
  const nextValue = options.some((item) => item.id === previousValue) ? previousValue : "";
  supervisorSelect.innerHTML = buildManagementSupervisorOptionMarkup(options, nextValue);
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
        `<option value="${escapeHtml(region.id || "")}">${escapeDisplayHtml(region.name || region.id || "--")}</option>`,
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
      elements.authFeedback.textContent = normalizeDisplayText(message);
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
    applyBootstrapPayload(payload.bootstrap || null, { restoreSelection: true });
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
    applyBootstrapPayload(payload.bootstrap || null, { restoreSelection: true });
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
  applyBootstrapPayload(null);
  state.lastResult = null;
  state.intakePreviewFingerprint = "";
  state.intakePreviewStaleReason = "";
  clearDepartmentInput({ clearSuggestions: true, resetProjectBinding: true });
  clearSupplementContext();
  resetContactEditorState({ silent: true });
  resetFollowupState();
  resetHistoryInfoState();
  closeTaskDueDialog();
  closeTaskRecordDialog();
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
  elements.toast.textContent = normalizeDisplayText(message);
  elements.toast.className = "toast";
  elements.toast.classList.add(`is-${tone}`);

  if (tone === "busy") {
    return;
  }

  showToast.timer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2200);
}

function resolveVisitDate() {
  const preset = elements.visitDatePreset?.value || "today";
  const offsetDays = VISIT_DATE_OFFSETS[preset] ?? 0;
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() - offsetDays);
  return formatDateInput(base);
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



