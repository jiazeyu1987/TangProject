function createRouteError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function resolveFollowupProjectForQuestionRoute({
  projectId,
  projects,
  currentUser,
  canUserAccessProject,
}) {
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    throw createRouteError(404, "Project not found.");
  }
  if (!canUserAccessProject(currentUser, project)) {
    throw createRouteError(403, "Current user is not allowed to access this project.");
  }
  return project;
}

export function resolveFollowupSessionForQuestionRoute({
  sessionId,
  projectId,
  currentUser,
  getFollowupSessionById,
}) {
  if (!sessionId) {
    return null;
  }
  const followupSession = getFollowupSessionById(sessionId);
  if (!followupSession) {
    throw createRouteError(404, "Follow-up session not found.");
  }
  if (followupSession.projectId !== projectId) {
    throw createRouteError(400, "Follow-up session does not belong to the project.");
  }
  if (followupSession.closedAt) {
    throw createRouteError(400, "Follow-up session has been closed.");
  }
  if (followupSession.userId && followupSession.userId !== currentUser.id) {
    throw createRouteError(403, "Current user is not allowed to access this follow-up session.");
  }
  return followupSession;
}

export function assertHistorySessionValidForQuestionRoute({
  historySessionId,
  projectId,
  getFollowupSessionById,
}) {
  if (!historySessionId) {
    return;
  }
  const historySourceSession = getFollowupSessionById(historySessionId);
  if (!historySourceSession) {
    throw createRouteError(404, "History follow-up session not found.");
  }
  if (historySourceSession.projectId !== projectId) {
    throw createRouteError(400, "History follow-up session does not belong to the project.");
  }
}

export function resolveFollowupAnswerAccessContext({
  sessionId,
  currentUser,
  getFollowupSessionById,
  getProjectById,
  canUserAccessProject,
}) {
  const session = getFollowupSessionById(sessionId);
  if (!session) {
    throw createRouteError(404, "Follow-up session not found.");
  }
  if (session.closedAt) {
    throw createRouteError(400, "Follow-up session has been closed.");
  }
  if (session.userId && session.userId !== currentUser.id) {
    throw createRouteError(403, "Current user is not allowed to answer this follow-up session.");
  }
  const followupProject = getProjectById(session.projectId);
  if (!followupProject || !canUserAccessProject(currentUser, followupProject)) {
    throw createRouteError(403, "Current user is not allowed to access this follow-up project.");
  }
  return {
    session,
    followupProject,
  };
}

export function resolveFollowupSessionForProjectAction({
  followupSessionId,
  projectId,
  currentUser,
  getFollowupSessionById,
  unauthorizedMessage,
}) {
  if (!followupSessionId) {
    return null;
  }
  const followupSession = getFollowupSessionById(followupSessionId);
  if (!followupSession) {
    throw createRouteError(404, "Follow-up session not found.");
  }
  if (followupSession.projectId !== projectId) {
    throw createRouteError(400, "Follow-up session does not belong to the project.");
  }
  if (followupSession.closedAt) {
    throw createRouteError(400, "Follow-up session has been closed.");
  }
  if (followupSession.userId && followupSession.userId !== currentUser.id) {
    throw createRouteError(403, unauthorizedMessage);
  }
  return followupSession;
}
