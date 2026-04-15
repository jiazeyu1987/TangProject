export function closeFollowupSessionOnSubmitView({
  followupSession,
  intakeSessionId,
  scenario,
  project,
  messages,
  normalizeScenarioForStorage,
  nowIso,
}) {
  const normalizedScenario = normalizeScenarioForStorage({
    scenario,
    operation: "submit",
    project,
  });
  for (const message of messages) {
    if (
      message.sessionId === followupSession.id &&
      message.kind === "followup_question" &&
      message.questionStatus === "pending_answer"
    ) {
      message.questionStatus = "unanswered_on_submit";
      if (!message.scenarioSnapshot) {
        message.scenarioSnapshot = normalizedScenario;
      }
    }
  }
  followupSession.closedAt = nowIso();
  followupSession.closedReason = "intake_submitted";
  followupSession.linkedIntakeSessionId = intakeSessionId;
}
