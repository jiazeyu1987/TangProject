export function buildFollowupPromptView({
  project,
  note,
  visitDate,
  history,
  minQuestions = 1,
  maxQuestions = 3,
  getHospitalById,
  getStageById,
}) {
  const hospital = getHospitalById(project.hospitalId);
  const stage = getStageById(project.currentStageId);
  const historyText = history.length
    ? history
        .map((item, index) => {
          const answerText = item.answer?.content || "(未回答)";
          return `${index + 1}. 问题：${item.question}\n   状态：${item.status}\n   回答：${answerText}`;
        })
        .join("\n")
    : "暂无历史追问。";

  return [
    "你是医疗器械导入项目的追问助手。",
    `请根据原始纪要和历史问答，输出 ${minQuestions}-${maxQuestions} 个最有价值的追问问题，帮助完善结构化抽取信息。`,
    "每个问题都必须具体、可回答、与推进动作相关，不要泛泛而谈。",
    `医院：${hospital.name}`,
    `当前阶段：${stage.name}`,
    `拜访日期：${visitDate}`,
    "原始纪要：",
    note,
    "历史追问与回答：",
    historyText,
  ].join("\n");
}

export function normalizeFollowupQuestionsPayloadView({
  raw,
  minQuestions = 1,
  maxQuestions = 3,
  clipText,
  asString,
}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Responses API returned an invalid follow-up questions payload.");
  }

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : null;
  if (!rawQuestions) {
    throw new Error("Responses API returned follow-up questions without questions array.");
  }
  if (rawQuestions.length < minQuestions || rawQuestions.length > maxQuestions) {
    throw new Error(
      `Responses API returned ${rawQuestions.length} follow-up questions; expected ${minQuestions}-${maxQuestions}.`,
    );
  }

  const questions = rawQuestions.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Responses API returned invalid follow-up question item at index ${index}.`);
    }
    const question = clipText(asString(item.question), 180);
    if (!question) {
      throw new Error(`Responses API returned an empty follow-up question at index ${index}.`);
    }
    return {
      question,
      intent: clipText(asString(item.intent), 120),
    };
  });

  return { questions };
}
