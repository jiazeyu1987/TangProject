(function initDomainFormatters() {
  const uiTextUtils = window.UiTextUtils;
  if (!uiTextUtils || typeof uiTextUtils.formatDate !== "function") {
    throw new Error("UiTextUtils.formatDate is required");
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

  function getProjectTaskSortKey(task) {
    const timeValue = String(task?.dueAt || task?.completedAt || "").trim();
    if (!timeValue) {
      return Number.MAX_SAFE_INTEGER;
    }
    const parsed = new Date(timeValue);
    const timestamp = parsed.getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  }

  function formatProjectTaskTime(task) {
    if (task?.dueAt) {
      return `截止 ${uiTextUtils.formatDate(task.dueAt)}`;
    }
    if (task?.completedAt) {
      return `完成 ${uiTextUtils.formatDate(task.completedAt)}`;
    }
    return "无截止日";
  }

  function formatTaskStatusLabel(status) {
    const normalized = String(status || "").trim();
    if (normalized === "overdue") {
      return "逾期";
    }
    if (normalized === "blocked") {
      return "阻塞";
    }
    if (normalized === "completed") {
      return "已完成";
    }
    return "待处理";
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

  window.DomainFormatters = {
    formatRiskLevelLabel,
    getProjectTaskSortKey,
    formatProjectTaskTime,
    formatTaskStatusLabel,
    normalizeUserRole,
  };
})();
