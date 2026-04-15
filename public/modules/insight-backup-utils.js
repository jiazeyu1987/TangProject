(function initInsightBackupUtils() {
  const uiTextUtils = window.UiTextUtils;
  if (!uiTextUtils || typeof uiTextUtils.formatWeekday !== "function") {
    throw new Error("UiTextUtils.formatWeekday is required");
  }

  function normalizeLedgerSubTab(rawValue) {
    return String(rawValue || "").toLowerCase() === "detail" ? "detail" : "list";
  }

  function normalizeInsightSubTab(rawValue) {
    const value = String(rawValue || "").trim().toLowerCase();
    if (value === "recent" || value === "management" || value === "summary") {
      return value;
    }
    return "summary";
  }

  function resolveBackupPanelState(backupsState) {
    const backups = Array.isArray(backupsState?.list) ? backupsState.list : [];
    const availableDates = Array.isArray(backupsState?.availableDates) ? backupsState.availableDates : [];
    const selectedDate = availableDates.includes(backupsState?.selectedDate) ? backupsState.selectedDate : availableDates[0] || "";
    const backupsForDate = selectedDate ? backups.filter((item) => item.date === selectedDate) : [];
    const maxBackups = Number(backupsState?.maxBackups) || 30;
    const schedule = backupsState?.policy?.schedule || {};
    const scheduler = backupsState?.scheduler || {};
    const frequency = String(schedule.frequency || "daily");
    const weekday = Number.isInteger(Number(schedule.weekday)) ? Number(schedule.weekday) : 1;
    const timeValue = `${String(Number(schedule.hour) || 0).padStart(2, "0")}:${String(
      Number(schedule.minute) || 0,
    ).padStart(2, "0")}`;
    return {
      backups,
      availableDates,
      selectedDate,
      backupsForDate,
      maxBackups,
      schedule,
      scheduler,
      frequency,
      weekday,
      timeValue,
    };
  }

  function formatBackupSchedule(schedule) {
    const frequency = String(schedule?.frequency || "daily");
    const hour = String(Number(schedule?.hour) || 0).padStart(2, "0");
    const minute = String(Number(schedule?.minute) || 0).padStart(2, "0");
    if (frequency === "weekly") {
      return `每周 ${uiTextUtils.formatWeekday(schedule?.weekday)} ${hour}:${minute} 自动备份`;
    }
    return `每天 ${hour}:${minute} 自动备份`;
  }

  window.InsightBackupUtils = {
    normalizeLedgerSubTab,
    normalizeInsightSubTab,
    resolveBackupPanelState,
    formatBackupSchedule,
  };
})();
