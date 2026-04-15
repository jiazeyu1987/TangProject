function createValidationError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

export function parseFollowupQuestionRouteInput({
  body,
  asString,
  normalizeDateOnly,
  todayDateOnly,
  parseScenarioPayload,
}) {
  const projectId = asString(body?.projectId);
  const note = asString(body?.note);
  const visitDate = normalizeDateOnly(body?.visitDate) || todayDateOnly();
  const sessionId = asString(body?.sessionId);
  const historySessionId = asString(body?.historySessionId);
  const scenario = parseScenarioPayload(body?.scenario);

  if (!projectId) {
    throw createValidationError(400, "projectId is required.");
  }
  if (!note) {
    throw createValidationError(400, "note is required.");
  }
  if (!scenario) {
    throw createValidationError(400, "scenario is required.");
  }

  return {
    projectId,
    note,
    visitDate,
    sessionId,
    historySessionId,
    scenario,
  };
}

export function parseFollowupSingleAnswerRouteInput({ body, asString, parseScenarioPayload }) {
  const sessionId = asString(body?.sessionId);
  const questionMessageId = asString(body?.questionMessageId);
  const answer = asString(body?.answer);
  const scenario = parseScenarioPayload(body?.scenario);

  if (!sessionId) {
    throw createValidationError(400, "sessionId is required.");
  }
  if (!questionMessageId) {
    throw createValidationError(400, "questionMessageId is required.");
  }
  if (!answer) {
    throw createValidationError(400, "answer is required.");
  }
  if (!scenario) {
    throw createValidationError(400, "scenario is required.");
  }

  return {
    sessionId,
    questionMessageId,
    answer,
    scenario,
  };
}

export function parseFollowupBatchAnswerRouteInput({ body, asString, parseScenarioPayload }) {
  const sessionId = asString(body?.sessionId);
  const scenario = parseScenarioPayload(body?.scenario);
  const answersRaw = Array.isArray(body?.answers) ? body.answers : null;

  if (!sessionId) {
    throw createValidationError(400, "sessionId is required.");
  }
  if (!answersRaw || !answersRaw.length) {
    throw createValidationError(400, "answers is required and must be a non-empty array.");
  }
  if (!scenario) {
    throw createValidationError(400, "scenario is required.");
  }

  return {
    sessionId,
    scenario,
    answersRaw,
  };
}

export function parseFollowupHistoryRouteInput({ query, asString }) {
  const projectId = asString(query?.projectId);
  const limitRaw = Number.parseInt(asString(query?.limit), 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  if (!projectId) {
    throw createValidationError(400, "projectId is required.");
  }

  return {
    projectId,
    limit,
  };
}

export function normalizeFollowupAnswerItems({ answersRaw, asString }) {
  const normalizedAnswers = answersRaw.map((item) => ({
    questionMessageId: asString(item?.questionMessageId),
    answer: asString(item?.answer),
  }));
  if (normalizedAnswers.some((item) => !item.questionMessageId || !item.answer)) {
    throw createValidationError(400, "Each answers item must include questionMessageId and answer.");
  }

  const uniqueQuestionIds = new Set(normalizedAnswers.map((item) => item.questionMessageId));
  if (uniqueQuestionIds.size !== normalizedAnswers.length) {
    throw createValidationError(400, "answers contains duplicated questionMessageId.");
  }

  return normalizedAnswers;
}
