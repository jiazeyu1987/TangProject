(function initUiRenderUtils() {
  const uiTextUtils = window.UiTextUtils;
  if (
    !uiTextUtils ||
    typeof uiTextUtils.escapeHtml !== "function" ||
    typeof uiTextUtils.escapeDisplayHtml !== "function" ||
    typeof uiTextUtils.formatDate !== "function"
  ) {
    throw new Error("UiTextUtils.escapeHtml/escapeDisplayHtml/formatDate are required");
  }
  const { escapeHtml, escapeDisplayHtml, formatDate } = uiTextUtils;

  function renderTaskCard(task) {
    const actions = [];
    const relatedContacts = Array.isArray(task?.relatedContacts) ? task.relatedContacts : [];
    const contactWarnings = Array.isArray(task?.contactReferenceWarnings) ? task.contactReferenceWarnings : [];
    if (task.status !== "completed") {
      actions.push(`<button type="button" data-task-id="${task.id}" data-task-status="completed">标记完成</button>`);
    }
    if (task.status === "completed") {
      actions.push(`<button type="button" data-task-id="${task.id}" data-task-status="todo">转为待处理</button>`);
    }
    if (task.status !== "completed") {
      actions.push(`<button type="button" data-task-action="due-dialog" data-task-id="${task.id}">设置截止</button>`);
    }
    actions.push(
      `<button type="button" class="${task.hasRecords ? "is-recorded" : ""}" data-task-action="record-dialog" data-task-id="${task.id}">${
        task.recordCount ? `记录 ${task.recordCount}` : "记录"
      }</button>`,
    );

    const cardTone = task.effectiveStatus === "completed" ? "completed" : task.effectiveStatus === "overdue" ? "overdue" : "todo";
    const statusLabel =
      task.effectiveStatus === "completed"
        ? "已完成"
        : task.effectiveStatus === "overdue"
          ? "已逾期"
          : "待处理";

    return `
    <article class="task-card ${task.effectiveStatus} task-card-v2${task.hasRecords ? " is-recorded" : ""}">
      <div class="task-card-timeline">
        <span>开始 ${escapeDisplayHtml(task.startDateLabel || formatDate(task.startAt || task.createdAt))}</span>
        <span>初始截止 ${escapeDisplayHtml(task.initialDueDateLabel || (task.initialDueAt ? formatDate(task.initialDueAt) : "未设置"))}</span>
        <span>当前截止 ${escapeDisplayHtml(task.currentDueDateLabel || (task.dueAt ? formatDate(task.dueAt) : "未设置"))}</span>
        ${
          task.dueAdjustmentLabel
            ? `<strong class="task-time-pill is-adjusted">${escapeDisplayHtml(task.dueAdjustmentLabel)}</strong>`
            : ""
        }
        <strong class="task-time-pill is-${cardTone}">${escapeDisplayHtml(task.timeStatusLabel || (task.dueAt ? formatDate(task.dueAt) : "未设置"))}</strong>
      </div>
      <div class="task-card-top">
        <div class="task-card-title-block">
          <strong>${escapeDisplayHtml(task.title)}</strong>
          <span class="task-card-project">${escapeDisplayHtml(task.projectLabel || task.hospitalName)}</span>
        </div>
        <span class="task-card-status is-${cardTone}">${escapeDisplayHtml(statusLabel)}</span>
      </div>
      <p>${escapeDisplayHtml(task.description || "")}</p>
      ${
        relatedContacts.length
          ? `<div class="task-contact-row">${relatedContacts
              .map((contact) => `<span class="task-contact-chip">${escapeDisplayHtml(contact.name || "--")}</span>`)
              .join("")}</div>`
          : ""
      }
      ${
        contactWarnings.length
          ? `<p class="task-warning-copy">${escapeDisplayHtml(contactWarnings.join(" | "))}</p>`
          : ""
      }
      <div class="task-meta">
        <span>${escapeDisplayHtml(task.assigneeName)}</span>
        <span>${escapeDisplayHtml(task.recordCount ? `已有 ${task.recordCount} 条记录` : "暂无记录")}</span>
      </div>
      <div class="task-actions">${actions.join("")}</div>
    </article>
  `;
  }

  function renderSignalGroup(title, items, mode) {
    return `
    <section class="signal-group">
      <h3>${escapeDisplayHtml(title)}</h3>
      ${(items || []).length
        ? items
            .map((item) => {
              if (mode === "task") {
                return `<article class="signal-item is-plain"><strong>${escapeDisplayHtml(item.title)}</strong><p>${escapeDisplayHtml(item.hospitalName)}</p><span>${item.dueAt ? formatDate(item.dueAt) : "无截止时间"}</span></article>`;
              }
              return `<button class="signal-item" type="button" data-focus-project="${item.id}"><strong>${escapeDisplayHtml(item.hospital.name)}</strong><p>${escapeDisplayHtml(item.latestSummary || item.blockers || "需要查看详情")}</p><span>${escapeDisplayHtml(item.stage.name)}</span></button>`;
            })
            .join("")
        : '<p class="empty-copy">暂无信号</p>'}
    </section>
  `;
  }

  function renderBarRow(label, value, total) {
    const width = total ? Math.max(10, Math.round((value / total) * 100)) : 0;
    return `
    <div class="bar-row">
      <span>${escapeDisplayHtml(label)}</span>
      <div class="bar-track"><i style="width:${width}%"></i></div>
      <strong>${value}</strong>
    </div>
  `;
  }

  function renderTagList(items) {
    return (items || []).length
      ? items.map((item) => `<span class="token">${escapeDisplayHtml(item)}</span>`).join("")
      : '<span class="token is-muted">无问题标签</span>';
  }

  window.UiRenderUtils = {
    renderTaskCard,
    renderSignalGroup,
    renderBarRow,
    renderTagList,
  };
})();
