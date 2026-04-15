export function collectAccessibleUserIdsByRole({ currentUser, users, normalizeUserRole, asString }) {
  const currentUserId = asString(currentUser?.id);
  if (!currentUserId) {
    return new Set();
  }

  const role = normalizeUserRole(currentUser?.role);
  if (role === "manager") {
    return new Set((Array.isArray(users) ? users : []).map((user) => asString(user?.id)).filter(Boolean));
  }

  if (role === "supervisor") {
    return new Set(
      (Array.isArray(users) ? users : [])
        .filter((user) => {
          const userId = asString(user?.id);
          if (!userId) {
            return false;
          }
          if (userId === currentUserId) {
            return true;
          }
          return normalizeUserRole(user?.role) === "specialist" && asString(user?.supervisorUserId) === currentUserId;
        })
        .map((user) => asString(user?.id))
        .filter(Boolean),
    );
  }

  return new Set([currentUserId]);
}

export function canUserAccessProjectByRole({ currentUser, project, users, normalizeUserRole, asString }) {
  if (!currentUser || !project) {
    return false;
  }

  const role = normalizeUserRole(currentUser.role);
  if (role === "manager") {
    return true;
  }

  const accessibleUserIds = collectAccessibleUserIdsByRole({
    currentUser,
    users,
    normalizeUserRole,
    asString,
  });
  return accessibleUserIds.has(asString(project.ownerUserId));
}

export function collectVisibleProjectIdsByAccess({ projects, currentUser, canUserAccessProject }) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  return new Set(
    safeProjects
      .filter((project) => canUserAccessProject(currentUser, project))
      .map((project) => project.id),
  );
}

export function buildProjectViewsForVisibleIds({
  projects,
  visibleProjectIds,
  buildProjectView,
  compareProjectViews,
}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const visibleIds = visibleProjectIds instanceof Set ? visibleProjectIds : new Set();
  return [...safeProjects]
    .filter((project) => visibleIds.has(project.id))
    .map((project) => buildProjectView(project))
    .sort(compareProjectViews);
}

export function buildTaskViewsForVisibleIds({
  tasks,
  visibleProjectIds,
  buildTaskView,
  compareTaskViews,
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const visibleIds = visibleProjectIds instanceof Set ? visibleProjectIds : new Set();
  return [...safeTasks]
    .filter((task) => visibleIds.has(task.projectId))
    .map((task) => buildTaskView(task))
    .sort(compareTaskViews);
}
