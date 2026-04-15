export function buildBootstrapPayloadView({
  resolvedCurrentUser,
  nowIso,
  buildHealthPayload,
  buildUserView,
  stages,
  issueTags,
  users,
  regions,
  buildDashboard,
  buildSignals,
  buildManagementPayload,
  isBackupAdminUser,
  projects,
  tasks,
  visibleProjectIds,
}) {
  return {
    ok: true,
    generatedAt: nowIso(),
    health: buildHealthPayload(),
    currentUser: buildUserView(resolvedCurrentUser),
    lookups: {
      stages: [...stages].sort((left, right) => left.sortOrder - right.sortOrder),
      issueTags,
      users: users.map((user) => buildUserView(user)),
      regions,
    },
    dashboard: buildDashboard(projects, tasks),
    signals: buildSignals(projects, tasks, visibleProjectIds),
    management: buildManagementPayload(resolvedCurrentUser),
    capabilities: {
      canManageBackups: isBackupAdminUser(resolvedCurrentUser),
    },
    projects,
    tasks,
  };
}
