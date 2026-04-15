function createRouteError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function resolveFollowupQuestionForSingleAnswer({
  messages,
  sessionId,
  questionMessageId,
}) {
  const questionMessage = messages.find(
    (item) =>
      item.id === questionMessageId &&
      item.sessionId === sessionId &&
      item.kind === "followup_question",
  );
  if (!questionMessage) {
    throw createRouteError(404, "Follow-up question not found.");
  }
  if (questionMessage.questionStatus !== "pending_answer") {
    throw createRouteError(400, "The follow-up question is not waiting for an answer.");
  }
  return questionMessage;
}

export function buildFollowupItemsForBatchAnswer({
  messages,
  sessionId,
  normalizedAnswers,
}) {
  const items = [];
  for (const item of normalizedAnswers) {
    const questionMessage = messages.find(
      (message) =>
        message.id === item.questionMessageId &&
        message.sessionId === sessionId &&
        message.kind === "followup_question",
    );
    if (!questionMessage) {
      throw createRouteError(404, `Follow-up question not found: ${item.questionMessageId}`);
    }
    if (questionMessage.questionStatus !== "pending_answer") {
      throw createRouteError(
        400,
        `The follow-up question is not waiting for an answer: ${item.questionMessageId}`,
      );
    }
    items.push({
      questionMessage,
      answer: item.answer,
    });
  }
  return items;
}
