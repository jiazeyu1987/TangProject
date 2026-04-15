export function buildDashboardMetrics({ projects, tasks, mapCountEntries }) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const stageCounts = new Map();
  const issueCounts = new Map();

  for (const project of safeProjects) {
    const stageName = project?.stage?.name || "";
    stageCounts.set(stageName, (stageCounts.get(stageName) || 0) + 1);
    for (const issueName of Array.isArray(project?.issueNames) ? project.issueNames : []) {
      issueCounts.set(issueName, (issueCounts.get(issueName) || 0) + 1);
    }
  }

  return {
    totalProjects: safeProjects.length,
    attentionProjects: safeProjects.filter((project) => project.managerAttentionNeeded).length,
    overdueTasks: safeTasks.filter((task) => task.overdue).length,
    stalledProjects: safeProjects.filter((project) => project.isStalled).length,
    tasksInFlight: safeTasks.filter((task) => task.status !== "completed").length,
    stageDistribution: mapCountEntries(stageCounts),
    issueDistribution: mapCountEntries(issueCounts),
  };
}

export function buildSignalsPayload({
  projects,
  tasks,
  updates,
  visibleProjectIds,
  compareIsoDesc,
  buildUpdateView,
}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeUpdates = Array.isArray(updates) ? updates : [];
  const visibleIds = visibleProjectIds instanceof Set ? visibleProjectIds : new Set();

  return {
    attentionProjects: safeProjects.filter((project) => project.managerAttentionNeeded).slice(0, 4),
    stalledProjects: safeProjects.filter((project) => project.isStalled).slice(0, 4),
    overdueTasks: safeTasks.filter((task) => task.overdue).slice(0, 4),
    recentUpdates: [...safeUpdates]
      .filter((update) => visibleIds.has(update.projectId))
      .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
      .slice(0, 5)
      .map((update) => buildUpdateView(update)),
  };
}
