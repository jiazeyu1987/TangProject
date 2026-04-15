(function initFollowupHistoryUtils() {
  function normalizeHistoryInfoSessions(sessions) {
    if (!Array.isArray(sessions)) {
      return [];
    }
    return sessions
      .map((session) => ({
        sessionId: String(session?.sessionId || ""),
        projectId: String(session?.projectId || ""),
        createdAt: String(session?.createdAt || ""),
        closedAt: String(session?.closedAt || ""),
        closedReason: String(session?.closedReason || ""),
        source: String(session?.source || ""),
        userId: String(session?.userId || ""),
        userName: String(session?.userName || ""),
        seedNote: String(session?.seedNote || ""),
        scenario: session?.scenario && typeof session.scenario === "object" ? session.scenario : null,
        history: Array.isArray(session?.history)
          ? session.history.map((item) => ({
              id: String(item?.id || ""),
              round: Number(item?.round) || 0,
              question: String(item?.question || ""),
              status: String(item?.status || ""),
              createdAt: String(item?.createdAt || ""),
              scenarioSnapshot:
                item?.scenarioSnapshot && typeof item.scenarioSnapshot === "object" ? item.scenarioSnapshot : null,
              answer: item?.answer
                ? {
                    id: String(item.answer.id || ""),
                    content: String(item.answer.content || ""),
                    createdAt: String(item.answer.createdAt || ""),
                    submittedByUserId: String(item.answer.submittedByUserId || ""),
                    submittedByUserName: String(item.answer.submittedByUserName || ""),
                    submitScenario:
                      item.answer.submitScenario && typeof item.answer.submitScenario === "object"
                        ? item.answer.submitScenario
                        : null,
                  }
                : null,
            }))
          : [],
      }))
      .filter((item) => item.sessionId);
  }

  function formatScenarioSnapshot(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "--";
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "--";
    }
  }

  function normalizeFollowupHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }
    return history
      .map((item) => ({
        id: item?.id || "",
        round: Number(item?.round) || 0,
        question: item?.question || "",
        status: item?.status || "pending_answer",
        createdAt: item?.createdAt || "",
        answer: item?.answer
          ? {
              id: item.answer.id || "",
              content: item.answer.content || "",
              createdAt: item.answer.createdAt || "",
            }
          : null,
      }))
      .filter((item) => item.id && item.question);
  }

  function normalizeFollowupQuestions(questions) {
    if (!Array.isArray(questions)) {
      return [];
    }
    return questions
      .map((item) => ({
        id: item?.id || "",
        round: Number(item?.round) || 0,
        question: item?.question || "",
        status: item?.status || "pending_answer",
        createdAt: item?.createdAt || "",
      }))
      .filter((item) => item.status === "pending_answer")
      .filter((item) => item.id && item.question);
  }

  function getPendingFollowupQuestions(history) {
    if (!Array.isArray(history)) {
      return [];
    }
    return [...history]
      .filter((item) => item.status === "pending_answer")
      .sort(
        (left, right) =>
          (Number(left.round) || 0) - (Number(right.round) || 0) ||
          new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime(),
      );
  }

  window.FollowupHistoryUtils = {
    normalizeHistoryInfoSessions,
    formatScenarioSnapshot,
    normalizeFollowupHistory,
    normalizeFollowupQuestions,
    getPendingFollowupQuestions,
  };
})();
