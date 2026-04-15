(function initManagementBackupRenderUtils() {
  const uiTextUtils = window.UiTextUtils;
  if (
    !uiTextUtils ||
    typeof uiTextUtils.escapeHtml !== "function" ||
    typeof uiTextUtils.escapeDisplayHtml !== "function" ||
    typeof uiTextUtils.formatDate !== "function" ||
    typeof uiTextUtils.formatDateTime !== "function" ||
    typeof uiTextUtils.formatBackupSize !== "function" ||
    typeof uiTextUtils.formatWeekday !== "function"
  ) {
    throw new Error(
      "UiTextUtils.escapeHtml/escapeDisplayHtml/formatDate/formatDateTime/formatBackupSize/formatWeekday are required",
    );
  }
  const { escapeHtml, escapeDisplayHtml, formatDate, formatDateTime, formatBackupSize, formatWeekday } = uiTextUtils;

  function renderManagementUserItemMarkup(user, canManageUsers, regions, supervisorOptions = []) {
    const safeUserId = escapeHtml(user.id || "");
    const roleName = escapeDisplayHtml(user.roleName || user.role || "--");
    const regionName = escapeDisplayHtml(user.regionName || "--");
    const safeRegions = Array.isArray(regions) ? regions : [];
    const safeSupervisorOptions = Array.isArray(supervisorOptions) ? supervisorOptions : [];
    const supervisorName = escapeDisplayHtml(user.supervisorName || "未分配主管");
    const specialistMeta = user.role === "specialist" ? `<span>直属主管：${supervisorName}</span>` : "";

    if (!canManageUsers || !safeRegions.length) {
      return `
      <article class="management-user-item">
        <div class="management-user-summary">
          <strong>${escapeDisplayHtml(user.name)}</strong>
          <span>${roleName}</span>
        </div>
        <div class="management-user-meta">
          <span>${regionName}</span>
          ${specialistMeta}
        </div>
      </article>
    `;
    }

    const regionOptions = safeRegions
      .map((region) => {
        const regionId = String(region.id || "");
        const selected = regionId === String(user.regionId || "") ? " selected" : "";
        return `<option value="${escapeHtml(regionId)}"${selected}>${escapeDisplayHtml(region.name || regionId || "--")}</option>`;
      })
      .join("");

    const supervisorSelectMarkup =
      user.role === "specialist"
        ? `
        <label class="management-user-field">
          <span>直属主管</span>
          <select data-management-supervisor-select="${safeUserId}">
            <option value="">未分配主管</option>
            ${safeSupervisorOptions
              .map((item) => {
                const supervisorUserId = String(item.id || "");
                const selected = supervisorUserId === String(user.supervisorUserId || "") ? " selected" : "";
                return `<option value="${escapeHtml(supervisorUserId)}"${selected}>${escapeDisplayHtml(item.name || supervisorUserId || "--")}</option>`;
              })
              .join("")}
          </select>
        </label>
      `
        : "";

    const helperCopy =
      user.role === "specialist"
        ? '<span class="management-user-inline-note">主管归属决定该专员项目与关键联系人的可见范围</span>'
        : '<span class="management-user-inline-note">当前角色无需配置直属主管</span>';

    return `
    <article class="management-user-item">
      <div class="management-user-summary">
        <strong>${escapeDisplayHtml(user.name)}</strong>
        <span>${roleName}</span>
      </div>
      <div class="management-user-meta">
        <span>${regionName}</span>
        ${specialistMeta}
      </div>
      <div class="management-user-actions">
        <label class="management-user-field">
          <span>区域</span>
          <select data-management-region-select="${safeUserId}">${regionOptions}</select>
        </label>
        ${supervisorSelectMarkup}
        <button class="chip" type="button" data-management-action="save-user" data-user-id="${safeUserId}">保存配置</button>
      </div>
      ${helperCopy}
    </article>
  `;
  }

  function renderBackupAdminPanelMarkup({ canManageBackups, backupsState, panelState, actionDisabled, scheduleText }) {
    if (!canManageBackups) {
      return "";
    }

    const backups = Array.isArray(panelState?.backups) ? panelState.backups : [];
    const availableDates = Array.isArray(panelState?.availableDates) ? panelState.availableDates : [];
    const selectedDate = String(panelState?.selectedDate || "");
    const backupsForDate = Array.isArray(panelState?.backupsForDate) ? panelState.backupsForDate : [];
    const maxBackups = Number(panelState?.maxBackups) || 30;
    const frequency = String(panelState?.frequency || "daily");
    const weekday = Number.isInteger(Number(panelState?.weekday)) ? Number(panelState.weekday) : 1;
    const timeValue = String(panelState?.timeValue || "00:00");
    const scheduler = panelState?.scheduler || {};
    const lastRunText = scheduler.lastRunAt ? formatDateTime(scheduler.lastRunAt) : "--";
    const nextRunText = scheduler.nextRunAt ? formatDateTime(scheduler.nextRunAt) : "--";
    const busy = Boolean(backupsState?.busy);
    const error = String(backupsState?.error || "");

    const weekdayOptions = [0, 1, 2, 3, 4, 5, 6]
      .map(
        (value) =>
          `<option value="${value}"${value === weekday ? " selected" : ""}>${escapeDisplayHtml(formatWeekday(value))}</option>`,
      )
      .join("");

    const dateOptions = availableDates
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}"${value === selectedDate ? " selected" : ""}>${escapeDisplayHtml(formatDate(value))}</option>`,
      )
      .join("");

    return `
    <section class="backup-panel">
      <div class="backup-panel-head">
        <div>
          <h4>数据备份</h4>
          <p class="backup-copy">${escapeDisplayHtml(scheduleText)}，最多保留 ${maxBackups} 份，当前 ${backups.length} 份。</p>
          <p class="backup-meta">上次执行时间：${lastRunText} · 下次执行时间：${nextRunText}</p>
        </div>
        <button class="chip" type="button" data-backup-action="create" ${actionDisabled ? "disabled" : ""}>立即备份</button>
      </div>
      ${error ? `<p class="backup-error">${escapeDisplayHtml(error)}</p>` : ""}
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
                <span class="backup-item-tag">${escapeDisplayHtml(item.fileName)}</span>
              </article>
            `,
                )
                .join("")
            : `<p class="empty-copy">${busy ? "备份列表加载中..." : "所选日期暂无备份记录"}</p>`
        }
      </div>
    </section>
  `;
  }

  window.ManagementBackupRenderUtils = {
    renderManagementUserItemMarkup,
    renderBackupAdminPanelMarkup,
  };
})();
