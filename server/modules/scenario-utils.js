export function parseScenarioPayloadInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input;
}

export function normalizeScenarioForStorageView({
  scenario,
  operation,
  project,
  asString,
  getStageById,
  nowIso,
}) {
  const stage = project ? getStageById(project.currentStageId) : null;
  return {
    operation: asString(operation),
    projectId: asString(scenario?.projectId) || project?.id || "",
    currentStageId: asString(scenario?.currentStageId) || project?.currentStageId || "",
    currentStageName: asString(scenario?.currentStageName) || stage?.name || "",
    activeTab: asString(scenario?.activeTab) || "entry",
    templateId: asString(scenario?.templateId),
    recordedAt: asString(scenario?.recordedAt) || nowIso(),
  };
}
