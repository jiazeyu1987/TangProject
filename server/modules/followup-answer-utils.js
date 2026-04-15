export function answerFollowupQuestionsBatchView({
  session,
  items,
  scenario,
  actorUser = null,
  getProjectById,
  asString,
  getUserById,
  normalizeScenarioForStorage,
  createId,
  nowIso,
  messages,
  touchStore,
  persistStore,
  buildFollowupHistory,
}) {
  const project = getProjectById(session.projectId);
  const submittedByUserId = asString(actorUser?.id) || asString(session.userId);
  const submittedByUser = getUserById(submittedByUserId);
  const submittedByUserName = asString(actorUser?.name) || submittedByUser?.name || "";
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "answer",
    project,
  });
  const answerMessages = items.map((item) => ({
    id: createId("message"),
    sessionId: session.id,
    senderType: "user",
    kind: "followup_answer",
    round: item.questionMessage.round || 0,
    questionStatus: null,
    relatedMessageId: item.questionMessage.id,
    scenarioSnapshot: normalizedScenario,
    userId: submittedByUserId,
    submittedByUserId,
    submittedByUserName,
    content: item.answer,
    createdAt: nowIso(),
  }));
  messages.push(...answerMessages);
  for (const item of items) {
    item.questionMessage.questionStatus = "answered";
  }

  touchStore();
  persistStore();

  return {
    ok: true,
    sessionId: session.id,
    answers: answerMessages.map((item) => ({
      id: item.id,
      content: item.content,
      round: item.round || 0,
      relatedMessageId: item.relatedMessageId,
      createdAt: item.createdAt,
      submittedByUserId: item.submittedByUserId || "",
      submittedByUserName: item.submittedByUserName || "",
      scenarioSnapshot: item.scenarioSnapshot || null,
    })),
    history: buildFollowupHistory(session.id),
  };
}
