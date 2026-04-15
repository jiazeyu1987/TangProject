export function buildProjectCollections({
  project,
  tasks,
  updates,
  contacts,
  remarks,
  buildTaskView,
  buildUpdateView,
  buildContactView,
  buildProjectRemarkView,
  compareTaskViews,
  compareIsoDesc,
  compareIsoAsc,
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeUpdates = Array.isArray(updates) ? updates : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeRemarks = Array.isArray(remarks) ? remarks : [];

  const projectTasks = safeTasks
    .filter((task) => task.projectId === project.id)
    .map((task) => buildTaskView(task))
    .sort(compareTaskViews);

  const projectUpdates = safeUpdates
    .filter((update) => update.projectId === project.id)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
    .map((update) => buildUpdateView(update));

  const hospitalContacts = safeContacts
    .filter((contact) => contact.hospitalId === project.hospitalId)
    .sort((left, right) => compareIsoDesc(left.lastContactAt, right.lastContactAt))
    .map((contact) => buildContactView(contact));

  const projectRemarks = safeRemarks
    .filter((remark) => remark.projectId === project.id)
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt))
    .map((remark) => buildProjectRemarkView(remark));

  return {
    tasks: projectTasks,
    updates: projectUpdates,
    contacts: hospitalContacts,
    remarks: projectRemarks,
  };
}

export function buildProjectMetrics({ tasks, updates, remarks }) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeUpdates = Array.isArray(updates) ? updates : [];
  const safeRemarks = Array.isArray(remarks) ? remarks : [];
  return {
    openTaskCount: safeTasks.filter((task) => task.status !== "completed").length,
    overdueTaskCount: safeTasks.filter((task) => task.overdue).length,
    updateCount: safeUpdates.length,
    remarkCount: safeRemarks.length,
    remarkRepliedCount: safeRemarks.filter((item) => item.replyContent).length,
  };
}
