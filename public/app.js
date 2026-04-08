const STORAGE_KEY = "clinical-rollout-selected-project";
const ACTIVE_TAB_KEY = "clinical-rollout-active-tab";

const elements = {
  toast: document.querySelector("#toast"),
  tabBar: document.querySelector("#tabBar"),
  intakeForm: document.querySelector("#intakeForm"),
  projectSelect: document.querySelector("#projectSelect"),
  visitDatePreset: document.querySelector("#visitDatePreset"),
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
  submitButton: document.querySelector("#submitButton"),
  intakeResult: document.querySelector("#intakeResult"),
  signalPanel: document.querySelector("#signalPanel"),
  projectList: document.querySelector("#projectList"),
  projectDetail: document.querySelector("#projectDetail"),
  taskBoard: document.querySelector("#taskBoard"),
  insightPanel: document.querySelector("#insightPanel"),
  aiFollowupButton: document.querySelector("#aiFollowupButton"),
  followupDialog: document.querySelector("#followupDialog"),
  followupDialogForm: document.querySelector("#followupDialogForm"),
  followupDialogCloseButton: document.querySelector("#followupDialogCloseButton"),
  followupDialogCancelButton: document.querySelector("#followupDialogCancelButton"),
  followupDialogQuestionList: document.querySelector("#followupDialogQuestionList"),
  followupDialogSubmitButton: document.querySelector("#followupDialogSubmitButton"),
};

const state = {
  bootstrap: null,
  selectedProjectId: localStorage.getItem(STORAGE_KEY) || "",
  activeTab: localStorage.getItem(ACTIVE_TAB_KEY) || "entry",
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
    replySynced: false,
  },
  lastResult: null,
  busy: false,
  followup: {
    sessionId: "",
    history: [],
    busy: false,
    lastTemplateId: "",
    dialogOpen: false,
    pendingQuestions: [],
    draftAnswers: {},
  },
};

const VISIT_DATE_OFFSETS = {
  today: 0,
  yesterday: 1,
  day_before_yesterday: 2,
};

boot();

elements.projectSelect.addEventListener("change", () => {
  invalidateIntakePreview();
  state.selectedProjectId = elements.projectSelect.value;
  state.activeRemarkId = "";
  clearSupplementContext();
  persistSelection();
  resetFollowupState();
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

elements.intakeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitIntake();
});

elements.visitDatePreset.addEventListener("change", () => {
  invalidateIntakePreview();
  renderIntakeSubmitButton();
});

elements.noteInput.addEventListener("input", () => {
  invalidateIntakePreview();
  renderIntakeSubmitButton();
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
  if (state.projectModalOpen) {
    closeProjectModal();
  }
  if (state.followup.dialogOpen) {
    closeFollowupDialog();
  }
});

elements.aiFollowupButton.addEventListener("click", async () => {
  await openFollowupDialogByGeneratingQuestions();
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
  renderFollowupDialog();
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
  clearSupplementContext();
  persistSelection();
  resetFollowupState();
  renderAll();
});

elements.projectDetail.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("button[data-remark-action][data-remark-id]");
  if (!actionButton) {
    return;
  }
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
});

elements.signalPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-focus-project]");
  if (!button) {
    return;
  }

  state.selectedProjectId = button.dataset.focusProject;
  state.activeTab = "ledger";
  state.activeRemarkId = "";
  clearSupplementContext();
  persistSelection();
  persistActiveTab();
  resetFollowupState();
  renderAll();
});

elements.taskBoard.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-task-id][data-task-status]");
  if (!button || state.busy) {
    return;
  }

  await updateTaskStatus(button.dataset.taskId, button.dataset.taskStatus);
});

async function boot() {
  elements.visitDatePreset.value = "today";
  await loadBootstrap(false);
}

async function loadBootstrap(preserveResult) {
  setBusy(true);

  try {
    const response = await fetch("/api/bootstrap");
    const payload = await response.json();
    state.bootstrap = payload;
    ensureSelection();
    if (!preserveResult) {
      state.lastResult = null;
    }
    renderAll();
    applyHealthState(payload.health);
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

function getCurrentIntakeContext() {
  return {
    projectId: elements.projectSelect.value,
    note: elements.noteInput.value.trim(),
    visitDate: resolveVisitDate(),
  };
}

function invalidateIntakePreview() {
  if (!state.intakePreviewFingerprint) {
    return;
  }
  state.intakePreviewFingerprint = "";
  state.lastResult = null;
  renderIntakeResult();
}

function renderIntakeSubmitButton() {
  if (!elements.submitButton) {
    return;
  }

  const { projectId, note, visitDate } = getCurrentIntakeContext();
  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  const isSupplementMode = Boolean(state.supplement.remarkId);
  const hasAnsweredFollowup = state.followup.history.some((item) => item.answer?.content);
  if (previewReady) {
    elements.submitButton.textContent = isSupplementMode ? "提交补充纪要" : "提交纪要";
  } else if (isSupplementMode) {
    elements.submitButton.textContent = "生成补充纪要";
  } else if (hasAnsweredFollowup) {
    elements.submitButton.textContent = "再次生成纪要";
  } else {
    elements.submitButton.textContent = "生成纪要";
  }

  if (elements.aiFollowupButton) {
    elements.aiFollowupButton.disabled = !(
      !state.busy &&
      !state.followup.busy &&
      !state.followup.dialogOpen &&
      previewReady &&
      Boolean(projectId && note)
    );
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

    state.lastResult = payload;
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

async function submitIntake() {
  const { projectId, note, visitDate } = getCurrentIntakeContext();

  if (!projectId || !note || state.busy) {
    return;
  }

  try {
    await ensureSupplementRemarkReply(note);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "留言回复失败", "error");
    return;
  }

  const fingerprint = buildIntakeFingerprint({ projectId, note, visitDate });
  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  if (!previewReady) {
    await generateIntakePreview({ projectId, note, visitDate, fingerprint });
    return;
  }

  setBusy(true);
  showToast("正在提交纪要", "busy");

  try {
    const body = {
      projectId,
      note,
      visitDate,
      followupSessionId: state.followup.sessionId || undefined,
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
    state.lastResult = payload;
    state.intakePreviewFingerprint = "";
    state.selectedProjectId = payload.project.id;
    clearSupplementContext();
    persistSelection();
    elements.noteInput.value = "";
    resetFollowupState();
    renderAll();
    showToast("纪要已提交并同步台账", "ready");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "纪要提交失败", "error");
  } finally {
    setBusy(false);
  }
}

async function openFollowupDialogByGeneratingQuestions() {
  const { projectId, note, visitDate } = getCurrentIntakeContext();
  if (!projectId || !note || state.busy || state.followup.busy) {
    return;
  }

  const previewReady = isPreviewReadyForCurrentInput({ projectId, note, visitDate });
  if (!previewReady) {
    showToast("请先生成纪要，再使用 AI追问", "warn");
    return;
  }

  setFollowupBusy(true);
  showToast("正在生成 AI追问", "busy");
  try {
    const response = await fetch("/api/followups/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        note,
        visitDate,
        sessionId: state.followup.sessionId || undefined,
        scenario: buildFollowupScenario("generate"),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.followup.sessionId = payload.sessionId;
    state.followup.history = normalizeFollowupHistory(payload.history);
    state.followup.pendingQuestions = normalizeFollowupQuestions(payload.questions);
    if (!state.followup.pendingQuestions.length) {
      state.followup.pendingQuestions = getPendingFollowupQuestionsFromHistory();
    }
    state.followup.draftAnswers = Object.fromEntries(
      state.followup.pendingQuestions.map((item) => [item.id, ""]),
    );
    openFollowupDialog();
    renderIntakeSubmitButton();
    showToast(`已生成 ${state.followup.pendingQuestions.length} 个 AI追问`, "ready");
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

  const answers = pendingQuestions.map((item) => ({
    questionMessageId: item.id,
    answer: String(state.followup.draftAnswers[item.id] || "").trim(),
  }));
  const hasEmptyAnswer = answers.some((item) => !item.answer);
  if (hasEmptyAnswer) {
    showToast("请先完成所有问题回答", "warn");
    return;
  }

  setFollowupBusy(true);
  showToast("正在保存追问回答", "busy");
  try {
    const response = await fetch("/api/followups/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        answers,
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

function setFollowupBusy(isBusy) {
  state.followup.busy = isBusy;
  renderIntakeSubmitButton();
  renderFollowupDialog();
}

function renderFollowupDialog() {
  if (!elements.followupDialog) {
    return;
  }
  elements.followupDialog.hidden = !state.followup.dialogOpen;
  if (!state.followup.dialogOpen) {
    return;
  }

  const pendingQuestions = state.followup.pendingQuestions.length
    ? [...state.followup.pendingQuestions]
    : getPendingFollowupQuestionsFromHistory();
  if (!pendingQuestions.length) {
    elements.followupDialogQuestionList.innerHTML = '<p class="empty-copy">暂无待回答追问，请重新点击 AI追问。</p>';
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
            >${escapeHtml(value)}</textarea>
          </article>
        `;
      })
      .join("");
  }

  const canSubmit = Boolean(
    pendingQuestions.length &&
      pendingQuestions.every((item) => String(state.followup.draftAnswers[item.id] || "").trim()),
  );
  elements.followupDialogSubmitButton.disabled = state.busy || state.followup.busy || !canSubmit;
  elements.followupDialogCloseButton.disabled = state.busy || state.followup.busy;
  elements.followupDialogCancelButton.disabled = state.busy || state.followup.busy;
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
    return;
  }

  renderTabs();
  renderProjectSearchState();
  renderProjectSelect();
  renderIntakeSubmitButton();
  renderIntakeResult();
  renderFollowupDialog();
  renderSignals();
  renderProjectList();
  renderProjectDetail();
  renderTaskBoard();
  renderInsights();
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
    elements.projectSelect.innerHTML = '<option value="">未找到匹配医院</option>';
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
  if (!state.lastResult) {
    elements.intakeResult.innerHTML = `
      <div class="result-empty">
        <p>本次结构化结果将在生成后展示于此。</p>
        <ul>
          <li>系统将通过 Responses API 提取科室、联系人、问题标签、阶段变化和下一步动作</li>
          <li>如果接口未配置或抽取失败，生成或提交会直接返回错误信息</li>
          <li>提交完成后，项目台账、任务中心与管理汇总会同步刷新</li>
        </ul>
      </div>
    `;
    return;
  }

  const { extraction, extractionSource, extractionWarnings = [] } = state.lastResult;
  elements.intakeResult.innerHTML = `
    <div class="result-head">
      <span class="result-badge ${extractionSource === "responses-api" ? "is-responses" : "is-fallback"}">
        ${extractionSource === "responses-api" ? "结构化来源：Responses API" : "结构化来源：未知"}
      </span>
      <span class="mini-meta">阶段更新：${escapeHtml(extraction.stageAfterUpdate)}</span>
      <span class="mini-meta">管理关注：${extraction.managerAttentionNeeded ? "需要" : "无需"}</span>
    </div>
    <h3>本次结构化摘要</h3>
    <p class="result-summary">${escapeHtml(extraction.feedbackSummary || "未提取到摘要")}</p>
    <div class="result-grid">
      <div>
        <span>科室</span>
        <strong>${escapeHtml(extraction.department || "未识别")}</strong>
      </div>
      <div>
        <span>下一步</span>
        <strong>${escapeHtml(extraction.nextStep || "未填写")}</strong>
      </div>
    </div>
    <div class="token-row">${renderTagList(extraction.issues)}</div>
    <div class="result-block">
      <span>联系人</span>
      <p>${escapeHtml(extraction.contacts.map((item) => `${item.name}${item.role ? ` / ${item.role}` : ""}`).join("；") || "未识别")}</p>
    </div>
    <div class="result-block">
      <span>阻塞点</span>
      <p>${escapeHtml(extraction.blockers || "无")}</p>
    </div>
    <div class="result-block">
      <span>待办动作</span>
      <p>${escapeHtml(extraction.nextActions.map((item) => `${item.title}${item.dueDate ? `（${item.dueDate}）` : ""}`).join("；") || "无")}</p>
    </div>
    ${
      extractionWarnings.length
        ? `<div class="warning-box">${escapeHtml(extractionWarnings.join(" | "))}</div>`
        : ""
    }
  `;
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
              title="点击顺序定位到对应留言条目"
            >
              留言 ${formatRemarkRatio(project.metrics.remarkRepliedCount, project.metrics.remarkCount)}
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

function renderProjectDetail() {
  const project = getSelectedProject();
  if (!project) {
    elements.projectDetail.innerHTML = "<p>暂无项目数据。</p>";
    return;
  }
  const remarks = project.remarks || [];
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

  elements.projectDetail.innerHTML = `
    <div class="detail-hero">
      <div>
        <p class="panel-eyebrow">${escapeHtml(project.region.name)}</p>
        <h3>${escapeHtml(project.hospital.name)}</h3>
        <p class="detail-copy">${escapeHtml(project.latestSummary || "暂无摘要")}</p>
      </div>
      <span class="stage-pill">${escapeHtml(project.stage.name)}</span>
    </div>

    <div class="detail-stats">
      <article><span>最近推进</span><strong>${formatDate(project.lastFollowUpAt)}</strong></article>
      <article><span>下一步</span><strong>${escapeHtml(project.nextAction || "未填写")}</strong></article>
      <article><span>任务状态</span><strong>${project.metrics.openTaskCount} 个待办</strong></article>
    </div>

    <section class="detail-section">
      <h4>关键联系人</h4>
      <div class="contact-list">
        ${project.contacts.length ? project.contacts.map((contact) => `
          <article class="contact-card">
            <strong>${escapeHtml(contact.name)}</strong>
            <span>${escapeHtml(contact.roleTitle || "角色未填")}</span>
            <small>${escapeHtml(contact.departmentName || "")}</small>
          </article>
        `).join("") : "<p>暂无联系人。</p>"}
      </div>
    </section>

    <section class="detail-section">
      <h4>历史时间线</h4>
      <div class="timeline">
        ${project.updates.map((update) => `
          <article class="timeline-item">
            <div class="timeline-top">
              <strong>${escapeHtml(update.departmentName)}</strong>
              <span>${escapeHtml(update.visitDate || formatDate(update.createdAt))}</span>
            </div>
            <p>${escapeHtml(update.feedbackSummary)}</p>
            ${update.blockers ? `<small>阻塞：${escapeHtml(update.blockers)}</small>` : ""}
            ${renderTimelineRemarkRows(remarksByUpdateId.get(update.id) || [])}
          </article>
        `).join("")}
      </div>
    </section>

    ${
      unlinkedRemarks.length
        ? `
          <section class="detail-section">
            <h4>未关联纪要留言</h4>
            <div class="remark-list">${renderTimelineRemarkRows(unlinkedRemarks)}</div>
          </section>
        `
        : ""
    }
  `;
}

function renderTimelineRemarkRows(remarks) {
  if (!Array.isArray(remarks) || !remarks.length) {
    return "";
  }
  return `
    <div class="timeline-remark-list">
      ${remarks
        .map(
          (remark) => `
            <article class="timeline-remark-item ${remark.id === state.activeRemarkId ? "is-active" : ""}" data-remark-id="${remark.id}">
              <div class="timeline-remark-content">${escapeHtml(`${remark.fromUserName}：${remark.content}`)}</div>
              <div class="timeline-remark-actions">
                <button class="timeline-remark-action" type="button" data-remark-action="reply" data-remark-id="${remark.id}">回答</button>
                ${remark.replyContent ? '<span class="timeline-remark-action is-done">已回复</span>' : ""}
                ${
                  remark.isRead
                    ? '<span class="timeline-remark-action is-done">已读</span>'
                    : `<button class="timeline-remark-action" type="button" data-remark-action="read" data-remark-id="${remark.id}">已读</button>`
                }
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
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
  state.supplement.replySynced = false;
}

function buildSupplementNoteTemplate({ remark, update }) {
  const visitDate = update?.visitDate || formatDate(update?.createdAt) || "--";
  const departmentName = update?.departmentName || "未填写";
  return [
    "【补充纪要】回复上级留言",
    `关联日期：${visitDate}`,
    `关联科室：${departmentName}`,
    `上级留言：${remark.content}`,
    "回复与处理结果：",
  ].join("\n");
}

function startSupplementFromRemark(remarkId) {
  const matched = findRemarkFromBootstrap(remarkId);
  if (!matched) {
    showToast("未找到对应留言", "error");
    return;
  }

  const { project, remark } = matched;
  const update = (project.updates || []).find((item) => item.id === remark.updateId) || null;
  const nextNote = buildSupplementNoteTemplate({ remark, update });

  state.selectedProjectId = project.id;
  state.activeTab = "entry";
  state.activeRemarkId = remark.id;
  state.supplement.remarkId = remark.id;
  state.supplement.updateId = remark.updateId || "";
  state.supplement.sourceText = remark.content || "";
  state.supplement.sourceDate = update?.visitDate || "";
  state.supplement.sourceDepartment = update?.departmentName || "";
  state.supplement.replySynced = Boolean(remark.replyContent);
  persistSelection();
  persistActiveTab();

  applyVisitDatePresetFromDate(update?.visitDate || "");
  elements.noteInput.value = nextNote;
  invalidateIntakePreview();
  resetFollowupState();
  renderAll();
  elements.noteInput.focus();
  showToast("请补充回复内容，然后生成补充纪要", "ready");
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
  if (!state.supplement.remarkId || state.supplement.replySynced) {
    return;
  }
  const reply = String(note || "").trim();
  if (!reply) {
    throw new Error("请先填写回复内容，再生成补充纪要。");
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
  persistSelection();

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

function renderInsights() {
  const { dashboard, signals } = state.bootstrap;
  elements.insightPanel.innerHTML = `
    <section class="insight-section">
      <h3>阶段分布</h3>
      ${dashboard.stageDistribution.map((item) => renderBarRow(item.label, item.value, dashboard.totalProjects)).join("")}
    </section>
    <section class="insight-section">
      <h3>高频问题</h3>
      <div class="token-row">${renderTagList(dashboard.issueDistribution.map((item) => `${item.label} ${item.value}`))}</div>
    </section>
    <section class="insight-section">
      <h3>最近动态</h3>
      ${(signals.recentUpdates || []).map((update) => `
        <article class="insight-note">
          <strong>${escapeHtml(update.departmentName)}</strong>
          <p>${escapeHtml(update.feedbackSummary)}</p>
        </article>
      `).join("")}
    </section>
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
  if (elements.followupDialogSubmitButton) {
    elements.followupDialogSubmitButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.followupDialogCloseButton) {
    elements.followupDialogCloseButton.disabled = isBusy || state.followup.busy;
  }
  if (elements.followupDialogCancelButton) {
    elements.followupDialogCancelButton.disabled = isBusy || state.followup.busy;
  }
  renderFollowupDialog();
  renderIntakeSubmitButton();
}

function persistSelection() {
  localStorage.setItem(STORAGE_KEY, state.selectedProjectId || "");
}

function persistActiveTab() {
  localStorage.setItem(ACTIVE_TAB_KEY, state.activeTab || "entry");
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
  return new Date(value).toLocaleString("zh-CN", {
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
