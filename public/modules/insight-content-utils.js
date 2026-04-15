(function initInsightContentUtils() {
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

  function assertCallback(name, value) {
    if (typeof value !== "function") {
      throw new Error(`${name} callback is required`);
    }
  }

  function renderInsightSummaryContent({ dashboard, renderBarRow, renderTagList }) {
    assertCallback("renderBarRow", renderBarRow);
    assertCallback("renderTagList", renderTagList);
    const stageDistribution = Array.isArray(dashboard?.stageDistribution) ? dashboard.stageDistribution : [];
    const issueDistribution = Array.isArray(dashboard?.issueDistribution) ? dashboard.issueDistribution : [];
    const totalProjects = Number(dashboard?.totalProjects) || 0;

    return `
    <section class="insight-section">
      <h3>管理汇总</h3>
      <p class="section-copy">按阶段分布与高频问题汇总当前项目状态，支持管理判断与资源配置。</p>
      <section class="insight-sub-section">
        <h4>阶段分布</h4>
        ${stageDistribution.map((item) => renderBarRow(item.label, item.value, totalProjects)).join("")}
      </section>
      <section class="insight-sub-section">
        <h4>高频问题</h4>
        <div class="token-row">${renderTagList(issueDistribution.map((item) => `${item.label} ${item.value}`))}</div>
      </section>
    </section>
  `;
  }

  function renderInsightRecentContent({ recentUpdates, resolveUpdateHospitalName }) {
    assertCallback("resolveUpdateHospitalName", resolveUpdateHospitalName);
    const rows = Array.isArray(recentUpdates) ? recentUpdates : [];

    return `
    <section class="insight-section">
      <h3>最近动态</h3>
      <p class="section-copy">按最近纪要查看医院推进情况，可直接进入对应医院台账详情。</p>
      ${
        rows.length
          ? rows
              .map(
                (update) => `
        <article class="insight-note">
          <div class="insight-note-head">
            <div class="insight-note-copy">
              <strong>${escapeDisplayHtml(update.stageAfterName || "推进记录")}</strong>
              <span class="insight-note-hospital">${escapeDisplayHtml(resolveUpdateHospitalName(update))}</span>
            </div>
            <button class="chip insight-note-enter" type="button" data-focus-project="${escapeHtml(update.projectId)}">进入</button>
          </div>
          <p>${escapeDisplayHtml(update.feedbackSummary)}</p>
          <div class="insight-note-meta">
            <span>${escapeDisplayHtml(formatDate(update.visitDate || update.createdAt))}</span>
          </div>
        </article>
      `,
              )
              .join("")
          : '<p class="empty-copy">暂无最近动态。</p>'
      }
    </section>
  `;
  }

  function renderInsightManagementContent({
    management,
    canManageUsers,
    canManageBackups,
    renderManagementUserItem,
    renderBackupAdminPanel,
  }) {
    assertCallback("renderManagementUserItem", renderManagementUserItem);
    assertCallback("renderBackupAdminPanel", renderBackupAdminPanel);
    const levels = Array.isArray(management?.levels) ? management.levels : [];
    const visibleUsers = Array.isArray(management?.visibleUsers) ? management.visibleUsers : [];
    const scopeCopy = canManageUsers
      ? "经理可为专员配置直属主管，主管归属会直接影响项目与关键联系人的可见范围。"
      : "当前成员列表已按账号层级收敛，只展示你当前应当看到的成员。";

    return `
    <section class="insight-section">
      <h3>三级管理</h3>
      <p class="management-scope-copy">${escapeDisplayHtml(scopeCopy)}</p>
      <div class="management-level-grid">
        ${levels
          .map(
            (level) => `
          <article class="management-level-card">
            <span>${escapeDisplayHtml(level.name)}</span>
            <strong>${Number(level.count) || 0}</strong>
          </article>
        `,
          )
          .join("")}
      </div>
      <div class="management-user-list">
        ${
          visibleUsers.length
            ? visibleUsers.map((user) => renderManagementUserItem(user, canManageUsers)).join("")
            : '<p class="empty-copy">暂无可见成员</p>'
        }
      </div>
      ${renderBackupAdminPanel(canManageBackups)}
    </section>
  `;
  }

  window.InsightContentUtils = {
    renderInsightSummaryContent,
    renderInsightRecentContent,
    renderInsightManagementContent,
  };
})();
