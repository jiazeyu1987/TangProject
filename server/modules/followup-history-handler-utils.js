export function handleFollowupHistoryRequestView({
  req,
  res,
  executeRouteStep,
  parseInput,
  resolveProject,
  buildSessions,
  buildPayload,
}) {
  const parsedInput = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Follow-up history request is invalid.",
    action: () => parseInput(req.query),
  });
  if (!parsedInput) {
    return null;
  }
  const { projectId, limit } = parsedInput;

  const project = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Follow-up history access check failed.",
    action: () =>
      resolveProject({
        projectId,
        currentUser: req.currentUser,
      }),
  });
  if (!project) {
    return null;
  }

  const sessions = buildSessions(projectId, limit);
  return buildPayload(projectId, sessions);
}
