export function handleFollowupQuestionRequestView({
  req,
  res,
  executeRouteStep,
  executeRouteStepAsync,
  parseInput,
  resolveAccessContext,
  createQuestions,
}) {
  const parsedInput = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Follow-up request is invalid.",
    action: () => parseInput(req.body),
  });
  if (!parsedInput) {
    return null;
  }

  const accessContext = executeRouteStep({
    res,
    fallbackStatus: 400,
    fallbackMessage: "Follow-up access check failed.",
    action: () =>
      resolveAccessContext({
        projectId: parsedInput.projectId,
        sessionId: parsedInput.sessionId,
        historySessionId: parsedInput.historySessionId,
        currentUser: req.currentUser,
      }),
  });
  if (!accessContext) {
    return null;
  }

  return executeRouteStepAsync({
    res,
    fallbackStatus: 500,
    fallbackMessage: "Failed to generate follow-up question.",
    action: () =>
      createQuestions({
        parsedInput,
        accessContext,
        currentUser: req.currentUser,
      }),
  });
}
