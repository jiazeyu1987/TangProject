export function buildFollowupContextForExtractionView({ sessionId, buildFollowupHistory }) {
  if (!sessionId) {
    return [];
  }
  return buildFollowupHistory(sessionId)
    .filter((item) => item.answer?.content)
    .map((item) => ({
      question: item.question,
      answer: item.answer?.content || "",
      status: item.status || "answered",
    }));
}
