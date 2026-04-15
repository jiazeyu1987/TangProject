export function buildTaskViewEntity({
  task,
  getProjectById,
  getHospitalById,
  getUserById,
  isDatePast,
}) {
  const project = getProjectById(task.projectId);
  const hospital = project ? getHospitalById(project.hospitalId) : null;
  const assignee = getUserById(task.assigneeUserId);
  const overdue = task.status !== "completed" && isDatePast(task.dueAt);
  const dueDateHistory = Array.isArray(task.dueDateHistory) ? task.dueDateHistory : [];
  const records = Array.isArray(task.records) ? task.records : [];

  return {
    id: task.id,
    projectId: task.projectId,
    hospitalName: hospital?.name || "",
    title: task.title,
    description: task.description,
    assigneeName: assignee?.name || "未分配",
    startAt: task.createdAt || null,
    createdAt: task.createdAt || null,
    initialDueAt: task.initialDueAt || null,
    dueAt: task.dueAt,
    status: task.status,
    effectiveStatus: overdue ? "overdue" : task.status,
    overdue,
    priority: task.priority,
    completedAt: task.completedAt,
    dueDateHistory: dueDateHistory.map((entry) => ({
      id: entry.id,
      previousDueAt: entry.previousDueAt || null,
      nextDueAt: entry.nextDueAt || null,
      changedAt: entry.changedAt || null,
      changedByUserId: entry.changedByUserId || "",
      changedByName: getUserById(entry.changedByUserId)?.name || "未知用户",
    })),
    records: records.map((entry) => ({
      id: entry.id,
      content: entry.content || "",
      createdAt: entry.createdAt || null,
      createdByUserId: entry.createdByUserId || "",
      createdByName: getUserById(entry.createdByUserId)?.name || "未知用户",
    })),
    recordCount: records.length,
    relatedContactIds: Array.isArray(task.relatedContactIds) ? task.relatedContactIds : [],
    relatedContacts: Array.isArray(task.relatedContacts) ? task.relatedContacts : [],
    contactReferenceWarnings: Array.isArray(task.contactReferenceWarnings) ? task.contactReferenceWarnings : [],
  };
}

export function buildUpdateViewEntity({
  update,
  getProjectById,
  getHospitalById,
  getUserById,
  getDepartmentById,
  getIssueTagById,
  getStageById,
}) {
  const project = getProjectById(update.projectId);
  const hospital = project ? getHospitalById(project.hospitalId) : null;

  return {
    id: update.id,
    projectId: update.projectId,
    hospitalName: hospital?.name || "",
    visitDate: update.visitDate,
    createdAt: update.createdAt,
    createdByName: getUserById(update.createdByUserId)?.name || "未知用户",
    departmentName: getDepartmentById(update.departmentId)?.name || "",
    contacts: update.contactEntries || [],
    feedbackSummary: update.feedbackSummary,
    blockers: update.blockers,
    opportunities: update.opportunities,
    nextStep: update.nextStep,
    issueNames: (update.issueTagIds || []).map((id) => getIssueTagById(id)?.name).filter(Boolean),
    stageBeforeName: getStageById(update.stageBeforeId)?.name || "",
    stageAfterName: getStageById(update.stageAfterId)?.name || "",
    managerAttentionNeeded: Boolean(update.managerAttentionNeeded),
    sourceNote: update.sourceNote,
    relatedContactIds: Array.isArray(update.relatedContactIds) ? update.relatedContactIds : [],
    relatedContacts: Array.isArray(update.relatedContacts) ? update.relatedContacts : [],
    contactReferenceWarnings: Array.isArray(update.contactReferenceWarnings) ? update.contactReferenceWarnings : [],
  };
}
