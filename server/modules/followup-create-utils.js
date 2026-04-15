export function createFollowupSessionView({
  project,
  note,
  visitDate,
  scenario,
  source,
  currentUser,
  historySourceSessionId = "",
  normalizeScenarioForStorage,
  createId,
  asString,
  nowIso,
  sessions,
  messages,
}) {
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "generate",
    project,
  });

  const session = {
    id: createId("session"),
    projectId: project.id,
    userId: currentUser?.id || "",
    source: source || "web-followup",
    sessionType: "followup",
    scenario: normalizedScenario,
    visitDate,
    historySourceSessionId: asString(historySourceSessionId) || null,
    closedAt: null,
    closedReason: "",
    linkedIntakeSessionId: null,
    createdAt: nowIso(),
  };
  sessions.push(session);

  messages.push({
    id: createId("message"),
    sessionId: session.id,
    senderType: "user",
    kind: "followup_seed",
    round: 0,
    questionStatus: null,
    relatedMessageId: null,
    scenarioSnapshot: normalizedScenario,
    content: note,
    createdAt: nowIso(),
  });

  return session;
}

export async function createFollowupQuestionsView({
  session,
  project,
  note,
  visitDate,
  historySessionId = "",
  scenario,
  source,
  currentUser,
  minQuestions = 1,
  maxQuestions = 3,
  normalizeScenarioForStorage,
  asString,
  buildFollowupHistory,
  findPendingFollowupQuestions,
  extractFollowupQuestions,
  createFollowupSession,
  messages,
  createId,
  nowIso,
  touchStore,
  persistStore,
  buildFollowupQuestionView,
}) {
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "generate",
    project,
  });
  const historyContextSessionId = session ? session.id : asString(historySessionId);
  const history = historyContextSessionId ? buildFollowupHistory(historyContextSessionId) : [];
  const pendingQuestions = session ? findPendingFollowupQuestions(session.id) : [];
  const extracted = await extractFollowupQuestions({
    project,
    note,
    visitDate,
    history,
    minQuestions,
    maxQuestions,
  });

  const activeSession =
    session ||
    createFollowupSession({
      project,
      note,
      visitDate,
      scenario,
      source,
      currentUser,
      historySourceSessionId: historySessionId,
    });

  for (const pendingQuestion of pendingQuestions) {
    pendingQuestion.questionStatus = "unsatisfied";
  }

  let round = messages
    .filter((item) => item.sessionId === activeSession.id && item.kind === "followup_question")
    .reduce((max, item) => Math.max(max, Number(item.round) || 0), 0);
  const questionMessages = extracted.questions.map((item) => {
    round += 1;
    return {
      id: createId("message"),
      sessionId: activeSession.id,
      senderType: "assistant",
      kind: "followup_question",
      round,
      questionStatus: "pending_answer",
      relatedMessageId: null,
      scenarioSnapshot: normalizedScenario,
      content: item.question,
      intent: item.intent,
      createdAt: nowIso(),
    };
  });
  messages.push(...questionMessages);

  touchStore();
  persistStore();

  return {
    ok: true,
    sessionId: activeSession.id,
    questions: questionMessages.map((message) => buildFollowupQuestionView(message)),
    history: buildFollowupHistory(activeSession.id),
  };
}
