(function initPanelRenderUtils() {
  const uiTextUtils = window.UiTextUtils;
  if (!uiTextUtils || typeof uiTextUtils.escapeHtml !== "function") {
    throw new Error("UiTextUtils.escapeHtml is required");
  }
  const { escapeHtml } = uiTextUtils;

  function assertCallback(name, value) {
    if (typeof value !== "function") {
      throw new Error(`${name} callback is required`);
    }
  }

  function renderTaskBoardMarkup({
    projectOptions,
    selectedProjectId,
    projectSearchOpen,
    projectKeyword,
    activeGroup,
    groups,
    sortField,
    sortDirection,
    tasks,
    renderTaskCard,
  }) {
    assertCallback("renderTaskCard", renderTaskCard);
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeGroups = Array.isArray(groups) ? groups : [];
    const safeProjectOptions = Array.isArray(projectOptions) ? projectOptions : [];
    const sortFieldLabel = sortField === "startAt" ? "按开始" : "按截止";
    const sortDirectionLabel = sortDirection === "desc" ? "降序" : "升序";
    const activeGroupMeta =
      safeGroups.find((group) => String(group?.id || "") === String(activeGroup || "")) || safeGroups[0] || null;
    const selectedProjectLabel =
      safeProjectOptions.find((option) => String(option?.id || "") === String(selectedProjectId || ""))?.label || "";

    return `
      <div class="task-board-shell">
        <section class="task-board-toolbar">
          <div class="task-board-filter-row">
            <label class="task-board-filter-select">
              <span class="task-board-filter-label">医院项目</span>
              <select data-task-project-filter>
                <option value="">全部医院项目</option>
                ${safeProjectOptions
                  .map((option) => {
                    const optionId = String(option?.id || "");
                    const selected = optionId === String(selectedProjectId || "") ? " selected" : "";
                    return `<option value="${escapeHtml(optionId)}"${selected}>${escapeHtml(option.label || optionId)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
            <button
              class="chip task-board-filter-reset${selectedProjectId ? "" : " is-active"}"
              type="button"
              data-task-reset-filter="true"
            >全部</button>
            <button class="chip chip-icon" type="button" data-task-toggle-search="true" title="搜索医院项目">查</button>
          </div>
          ${
            projectSearchOpen
              ? `
                <div class="task-board-search-row">
                  <input
                    type="search"
                    value="${escapeHtml(projectKeyword || "")}"
                    placeholder="输入医院或科室关键词"
                    data-task-project-search="true"
                    autocomplete="off"
                  />
                </div>
              `
              : ""
          }
        </section>
        <section class="task-folder-strip" aria-label="任务状态文件夹">
          ${safeGroups
            .map((group) => {
              const groupId = String(group?.id || "");
              const selected = groupId === String(activeGroup || "");
              return `
                <button
                  class="task-folder-button${selected ? " is-active" : ""}"
                  type="button"
                  data-task-group="${escapeHtml(groupId)}"
                >
                  <strong>${escapeHtml(group?.label || groupId)}</strong>
                  <span>${Number(group?.count || 0)}</span>
                </button>
              `;
            })
            .join("")}
        </section>
        <section class="task-folder-panel">
          <div class="task-folder-panel-head">
            <div>
              <h3>${escapeHtml(activeGroupMeta?.label || "任务列表")}</h3>
              <p class="task-folder-panel-copy">${
                selectedProjectLabel ? `仅看：${escapeHtml(selectedProjectLabel)}` : "显示全部任务"
              }</p>
            </div>
            <div class="task-folder-panel-actions">
              <button class="chip" type="button" data-task-sort-field-toggle="true">${escapeHtml(sortFieldLabel)}</button>
              <button class="chip" type="button" data-task-sort-direction-toggle="true">${escapeHtml(sortDirectionLabel)}</button>
            </div>
          </div>
          <div class="task-list">
            ${safeTasks.length ? safeTasks.map((task) => renderTaskCard(task)).join("") : '<p class="empty-copy">当前筛选下暂无任务。</p>'}
          </div>
        </section>
      </div>
    `;
  }

  function renderInsightPanelMarkup({ activeInsightSubTab, subTabs, subTabContent }) {
    const safeSubTabs = Array.isArray(subTabs) ? subTabs : [];
    return `
    <div class="insight-subtab-bar" role="tablist" aria-label="汇总子导航">
      ${safeSubTabs
        .map(
          (tab) => `
        <button
          class="chip insight-subtab-button${tab.id === activeInsightSubTab ? " is-active" : ""}"
          type="button"
          role="tab"
          data-insight-subtab="${tab.id}"
          aria-selected="${tab.id === activeInsightSubTab}"
        >${escapeHtml(tab.label)}</button>
      `,
        )
        .join("")}
    </div>
    ${subTabContent}
  `;
  }

  window.PanelRenderUtils = {
    renderTaskBoardMarkup,
    renderInsightPanelMarkup,
  };
})();
