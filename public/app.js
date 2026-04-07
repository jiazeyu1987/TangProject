const STORAGE_KEY = "clinical-rollout-selected-project";
const ACTIVE_TAB_KEY = "clinical-rollout-active-tab";

const elements = {
  toast: document.querySelector("#toast"),
  tabBar: document.querySelector("#tabBar"),
  intakeForm: document.querySelector("#intakeForm"),
  projectSelect: document.querySelector("#projectSelect"),
  visitDateInput: document.querySelector("#visitDateInput"),
  noteInput: document.querySelector("#noteInput"),
  submitButton: document.querySelector("#submitButton"),
  promptChips: document.querySelector("#promptChips"),
  intakeResult: document.querySelector("#intakeResult"),
  signalPanel: document.querySelector("#signalPanel"),
  projectList: document.querySelector("#projectList"),
  projectDetail: document.querySelector("#projectDetail"),
  taskBoard: document.querySelector("#taskBoard"),
  insightPanel: document.querySelector("#insightPanel"),
};

const state = {
  bootstrap: null,
  selectedProjectId: localStorage.getItem(STORAGE_KEY) || "",
  activeTab: localStorage.getItem(ACTIVE_TAB_KEY) || "entry",
  lastResult: null,
  busy: false,
};

const NOTE_TEMPLATES = {
  trial: (project) =>
    `今天去${project?.hospital.name || "这家医院"}${project?.contacts[0]?.departmentName || "相关科室"}继续看试用反馈。主任认可病例效果，但希望我们补一版收费与经济性说明，再决定是否扩大试用。`,
  training: (project) =>
    `和${project?.hospital.name || "这家医院"}护理侧沟通过培训安排。对方愿意推进，但要求先锁定培训名单、操作材料和培训时间。`,
  blocker: (project) =>
    `${project?.hospital.name || "该医院"}当前推进卡在院内流程。科室有兴趣，但采购和支持力度不足，需要区域经理或总部一起介入。`,
};

boot();

elements.projectSelect.addEventListener("change", () => {
  state.selectedProjectId = elements.projectSelect.value;
  persistSelection();
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

elements.promptChips.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-template]");
  if (!button || state.busy) {
    return;
  }

  const project = getSelectedProject();
  const builder = NOTE_TEMPLATES[button.dataset.template];
  if (builder) {
    elements.noteInput.value = builder(project);
    elements.noteInput.focus();
  }
});

elements.projectList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-project-id]");
  if (!card) {
    return;
  }

  state.selectedProjectId = card.dataset.projectId;
  persistSelection();
  renderAll();
});

elements.signalPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-focus-project]");
  if (!button) {
    return;
  }

  state.selectedProjectId = button.dataset.focusProject;
  state.activeTab = "ledger";
  persistSelection();
  persistActiveTab();
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
  elements.visitDateInput.value = formatDateInput(new Date());
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

async function submitIntake() {
  const projectId = elements.projectSelect.value;
  const note = elements.noteInput.value.trim();
  const visitDate = elements.visitDateInput.value;

  if (!projectId || !note || state.busy) {
    return;
  }

  setBusy(true);
  showToast("正在生成结构化结果", "busy");

  try {
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, note, visitDate }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    state.bootstrap = payload.bootstrap;
    state.lastResult = payload;
    state.selectedProjectId = payload.project.id;
    persistSelection();
    elements.noteInput.value = "";
    renderAll();
    showToast(
      payload.extractionSource === "codex"
        ? "结构化结果已生成并同步入台账"
        : "Codex 当前不可用，系统已切换至应急抽取模式",
      payload.extractionSource === "codex" ? "ready" : "warn",
    );
  } catch (error) {
    showToast(error instanceof Error ? error.message : "纪要提交失败", "error");
  } finally {
    setBusy(false);
  }
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
  renderProjectSelect();
  renderIntakeResult();
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

function renderProjectSelect() {
  elements.projectSelect.innerHTML = state.bootstrap.projects
    .map(
      (project) => `
        <option value="${project.id}" ${project.id === state.selectedProjectId ? "selected" : ""}>
          ${escapeHtml(project.hospital.name)} · ${escapeHtml(project.stage.name)}
        </option>
      `,
    )
    .join("");
}
function renderIntakeResult() {
  if (!state.lastResult) {
    elements.intakeResult.innerHTML = `
      <div class="result-empty">
        <p>本次结构化结果将在提交后展示于此。</p>
        <ul>
          <li>系统将提取科室、联系人、问题标签、阶段变化和下一步动作</li>
          <li>当本机 Codex 不可用时，系统将自动切换至启发式应急抽取</li>
          <li>提交完成后，项目台账、任务中心与管理汇总会同步刷新</li>
        </ul>
      </div>
    `;
    return;
  }

  const { extraction, extractionSource, extractionWarnings = [] } = state.lastResult;
  elements.intakeResult.innerHTML = `
    <div class="result-head">
      <span class="result-badge ${extractionSource === "codex" ? "is-codex" : "is-fallback"}">
        ${extractionSource === "codex" ? "结构化来源：本机 Codex" : "结构化来源：应急抽取"}
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
          </article>
        `).join("")}
      </div>
    </section>
  `;
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
  document.title = health.configured ? "AI 医院导入管理系统" : "AI 医院导入管理系统 · 降级模式";
}

function setBusy(isBusy) {
  state.busy = isBusy;
  elements.submitButton.disabled = isBusy;
  elements.noteInput.disabled = isBusy;
  elements.projectSelect.disabled = isBusy;
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

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
