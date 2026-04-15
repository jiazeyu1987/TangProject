function getMessagesBySessionId(messages, sessionId) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  return safeMessages.filter((item) => item.sessionId === sessionId);
}

function buildAnswerByQuestionId(messages) {
  return new Map(
    messages
      .filter((item) => item.kind === "followup_answer" && item.relatedMessageId)
      .map((item) => [item.relatedMessageId, item]),
  );
}

export function buildFollowupHistoryDetailedView({
  sessionId,
  session = null,
  messages,
  compareIsoAsc,
  asString,
  getUserById,
}) {
  const orderedMessages = getMessagesBySessionId(messages, sessionId).sort((left, right) =>
    compareIsoAsc(left.createdAt, right.createdAt),
  );
  const answerByQuestionId = buildAnswerByQuestionId(orderedMessages);

  return orderedMessages
    .filter((item) => item.kind === "followup_question")
    .map((item) => {
      const answerMessage = answerByQuestionId.get(item.id);
      const submittedByUserId =
        asString(answerMessage?.submittedByUserId) ||
        asString(answerMessage?.userId) ||
        asString(session?.userId);
      const submittedByUser = getUserById(submittedByUserId);
      return {
        id: item.id,
        round: Number(item.round) || 0,
        question: item.content,
        status: item.questionStatus || "pending_answer",
        createdAt: item.createdAt,
        scenarioSnapshot: item.scenarioSnapshot || null,
        answer: answerMessage
          ? {
              id: answerMessage.id,
              content: answerMessage.content,
              createdAt: answerMessage.createdAt,
              submittedByUserId,
              submittedByUserName: asString(answerMessage.submittedByUserName) || submittedByUser?.name || "",
              submitScenario: answerMessage.scenarioSnapshot || null,
            }
          : null,
      };
    });
}

export function buildFollowupHistoryView({ sessionId, messages, compareIsoAsc }) {
  const orderedMessages = getMessagesBySessionId(messages, sessionId).sort((left, right) =>
    compareIsoAsc(left.createdAt, right.createdAt),
  );
  const answerByQuestionId = buildAnswerByQuestionId(orderedMessages);

  return orderedMessages
    .filter((item) => item.kind === "followup_question")
    .map((item) => {
      const answer = answerByQuestionId.get(item.id);
      return {
        id: item.id,
        round: Number(item.round) || 0,
        question: item.content,
        status: item.questionStatus || "pending_answer",
        createdAt: item.createdAt,
        scenarioSnapshot: item.scenarioSnapshot || null,
        answer: answer
          ? {
              id: answer.id,
              content: answer.content,
              createdAt: answer.createdAt,
              scenarioSnapshot: answer.scenarioSnapshot || null,
            }
          : null,
      };
    });
}

export function buildFollowupQuestionViewModel(message) {
  return {
    id: message.id,
    round: Number(message.round) || 0,
    question: message.content,
    status: message.questionStatus || "pending_answer",
    createdAt: message.createdAt,
    scenarioSnapshot: message.scenarioSnapshot || null,
  };
}

export function findPendingFollowupQuestionsForSession({ sessionId, messages, compareIsoDesc }) {
  return getMessagesBySessionId(messages, sessionId)
    .filter((item) => item.kind === "followup_question" && item.questionStatus === "pending_answer")
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt));
}

export function buildFollowupHistorySessionSummary({
  session,
  messages,
  compareIsoAsc,
  getUserById,
  buildFollowupHistoryDetailed,
}) {
  const sessionUser = getUserById(session.userId);
  const seedMessage = getMessagesBySessionId(messages, session.id)
    .filter((item) => item.kind === "followup_seed")
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt))[0];

  return {
    sessionId: session.id,
    projectId: session.projectId,
    source: session.source || "",
    userId: session.userId || "",
    userName: sessionUser?.name || "",
    createdAt: session.createdAt,
    closedAt: session.closedAt || null,
    closedReason: session.closedReason || "",
    linkedIntakeSessionId: session.linkedIntakeSessionId || null,
    historySourceSessionId: session.historySourceSessionId || null,
    scenario: session.scenario || null,
    seedNote: seedMessage?.content || "",
    history: buildFollowupHistoryDetailed(session.id, session),
  };
}

export function buildFollowupHistorySessionsForProjectView({
  sessions,
  projectId,
  limit,
  compareIsoDesc,
  buildFollowupHistorySessionView,
}) {
  return sessions
    .filter((item) => item.sessionType === "followup" && item.projectId === projectId)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))
    .slice(0, limit)
    .map((item) => buildFollowupHistorySessionView(item));
}

export function buildFollowupHistoryPayloadView({ projectId, generatedAt, sessions }) {
  return {
    ok: true,
    projectId,
    generatedAt,
    sessions,
  };
}
