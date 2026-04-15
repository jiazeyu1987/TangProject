function createRouteError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function resolveIntakeRouteContextView({
  body,
  currentUser,
  asString,
  normalizeDateOnly,
  todayDateOnly,
  projects,
  canUserAccessProject,
  resolveFollowupSessionForProjectAction,
  getFollowupSessionById,
  projectUnauthorizedMessage,
  followupUnauthorizedMessage,
}) {
  const projectId = asString(body?.projectId);
  const note = asString(body?.note);
  const departmentName = asString(body?.departmentName) === "\u65e0\u79d1\u5ba4" ? "" : asString(body?.departmentName);
  const visitDate = normalizeDateOnly(body?.visitDate) || todayDateOnly();
  const followupSessionId = asString(body?.followupSessionId);
  if (!projectId) {
    throw createRouteError(400, "projectId is required.");
  }
  if (!note) {
    throw createRouteError(400, "note is required.");
  }
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    throw createRouteError(404, "Project not found.");
  }
  if (!canUserAccessProject(currentUser, project)) {
    throw createRouteError(403, projectUnauthorizedMessage);
  }

  const followupSession = resolveFollowupSessionForProjectAction({
    followupSessionId,
    projectId,
    currentUser,
    getFollowupSessionById,
    unauthorizedMessage: followupUnauthorizedMessage,
  });

  return {
    projectId,
    note,
    departmentName,
    visitDate,
    followupSessionId,
    project,
    followupSession,
  };
}
