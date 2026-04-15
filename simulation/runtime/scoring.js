export function collectStoreMetrics({ store, roleCatalog }) {
  if (!store || typeof store !== "object") {
    throw new Error("Store payload is invalid for metric collection.");
  }
  const users = Array.isArray(store.users) ? store.users : [];
  const projects = Array.isArray(store.projects) ? store.projects : [];
  const tasks = Array.isArray(store.tasks) ? store.tasks : [];
  const remarks = Array.isArray(store.remarks) ? store.remarks : [];
  const updates = Array.isArray(store.updates) ? store.updates : [];
  const stages = Array.isArray(store.stages) ? store.stages : [];
  const referenceNowMs = Number.isFinite(new Date(store?.meta?.updatedAt || "").getTime())
    ? new Date(store.meta.updatedAt).getTime()
    : Date.now();

  const stageOrderMap = new Map(
    stages.map((item) => [String(item.id || ""), Number(item.sortOrder || 0)]),
  );
  const stageNameMap = new Map(
    stages.map((item) => [String(item.id || ""), String(item.name || item.id || "")]),
  );
  const userRoleMap = new Map(users.map((item) => [item.id, normalizeRole(item.role)]));

  const supervisorRegionId = roleCatalog?.byRole?.supervisor?.[0]?.regionId || "";
  const specialistAccountIds = new Set(
    (roleCatalog?.byRole?.specialist || []).map((item) => item.userId).filter(Boolean),
  );

  const regionProjects = projects.filter(
    (project) => String(project.regionId || "") === String(supervisorRegionId || ""),
  );
  const regionTaskIds = new Set(regionProjects.map((item) => item.id));
  const regionTasks = tasks.filter((item) => regionTaskIds.has(item.projectId));

  const stageAverage = average(
    projects.map((project) => stageOrderMap.get(String(project.currentStageId || "")) || 0),
  );
  const regionStageAverage = average(
    regionProjects.map((project) => stageOrderMap.get(String(project.currentStageId || "")) || 0),
  );

  const taskStatusCounts = tasks.reduce(
    (acc, task) => {
      const key = String(task.status || "todo");
      if (!(key in acc)) {
        acc[key] = 0;
      }
      acc[key] += 1;
      return acc;
    },
    {
      todo: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
    },
  );
  const stageDistribution = projects.reduce((acc, project) => {
    const stageName = stageNameMap.get(String(project.currentStageId || "")) || "unknown";
    if (!(stageName in acc)) {
      acc[stageName] = 0;
    }
    acc[stageName] += 1;
    return acc;
  }, {});

  const managerToSupervisorRemarks = filterRemarksByRolePair(
    remarks,
    userRoleMap,
    "manager",
    "supervisor",
  );
  const supervisorToSpecialistRemarks = filterRemarksByRolePair(
    remarks,
    userRoleMap,
    "supervisor",
    "specialist",
  );
  const specialistReceivedRemarks = remarks.filter(
    (item) => specialistAccountIds.has(item.toUserId) && item.createdAt,
  );

  const specialistTasks = tasks.filter((item) =>
    specialistAccountIds.has(String(item.assigneeUserId || "")),
  );

  return {
    capturedAt: new Date().toISOString(),
    totals: {
      projects: projects.length,
      attentionProjects: projects.filter((item) => Boolean(item.managerAttentionNeeded)).length,
      highRiskProjects: projects.filter((item) => item.riskLevel === "high").length,
      overdueTasks: tasks.filter((item) => isTaskOverdue(item, referenceNowMs)).length,
      stageAverage,
      taskStatusCounts,
      stageDistribution,
    },
    region: {
      projects: regionProjects.length,
      highRiskProjects: regionProjects.filter((item) => item.riskLevel === "high").length,
      overdueTasks: regionTasks.filter((item) => isTaskOverdue(item, referenceNowMs)).length,
      stageAverage: regionStageAverage,
    },
    replies: {
      managerToSupervisorWithin2d: computeReplyRateWithinDays(managerToSupervisorRemarks, 2),
      supervisorToSpecialistWithin2d: computeReplyRateWithinDays(supervisorToSpecialistRemarks, 2),
      specialistReplyWithin1d: computeReplyRateWithinDays(specialistReceivedRemarks, 1),
    },
    specialist: {
      assignedTaskCount: specialistTasks.length,
      completedTaskCount: specialistTasks.filter((item) => item.status === "completed").length,
      intakeUpdateCount: updates.filter((item) => specialistAccountIds.has(item.createdByUserId)).length,
      progressedTaskCount: specialistTasks.filter((item) =>
        item.status === "in_progress" || item.status === "completed",
      ).length,
    },
  };
}

export function scoreDailyMetrics({ baseline, current, scorecards, dayEvents = [] }) {
  const managerInspectionCoverage = calculateManagerInspectionCoverage(dayEvents);
  const managerKpis = {
    attentionProjectsImprovement: improvement(
      baseline.totals.attentionProjects,
      current.totals.attentionProjects,
    ),
    overdueTasksImprovement: improvement(
      baseline.totals.overdueTasks,
      current.totals.overdueTasks,
    ),
    supervisorFollowupRate2d: clamp01(current.replies.managerToSupervisorWithin2d),
    globalInspectionCoverage: clamp01(managerInspectionCoverage),
  };

  const supervisorKpis = {
    regionStageProgression: stageImprovement(
      baseline.region.stageAverage,
      current.region.stageAverage,
    ),
    regionOverdueImprovement: improvement(
      baseline.region.overdueTasks,
      current.region.overdueTasks,
    ),
    specialistReplyRate2d: clamp01(current.replies.supervisorToSpecialistWithin2d),
    highRiskReduction: improvement(
      baseline.region.highRiskProjects,
      current.region.highRiskProjects,
    ),
  };

  const specialistKpis = {
    ownTaskCompletionRate: ratio(
      current.specialist.completedTaskCount,
      current.specialist.assignedTaskCount,
    ),
    remarkReplyRate1d: clamp01(current.replies.specialistReplyWithin1d),
    intakeAndTaskProgress: clamp01(
      ratio(
        current.specialist.intakeUpdateCount + current.specialist.progressedTaskCount,
        Math.max(1, current.specialist.assignedTaskCount + 2),
      ),
    ),
  };

  return {
    manager: scoreByWeight(managerKpis, scorecards.manager),
    supervisor: scoreByWeight(supervisorKpis, scorecards.supervisor),
    specialist: scoreByWeight(specialistKpis, scorecards.specialist),
  };
}

function scoreByWeight(kpis, weights) {
  const weighted = Object.keys(weights).reduce((sum, key) => {
    const weight = Number(weights[key] || 0);
    const value = clamp01(Number(kpis[key] || 0));
    return sum + value * weight;
  }, 0);
  return {
    score: Math.round(clamp01(weighted) * 10000) / 100,
    kpis,
  };
}

function calculateManagerInspectionCoverage(dayEvents) {
  const managerEvents = dayEvents.filter((item) => item.role === "manager");
  if (!managerEvents.length) {
    return 0;
  }
  const targets = [
    "管理信号",
    "管理汇总",
    "项目详情",
    "医院项目台账",
  ];
  const visited = new Set();
  for (const event of managerEvents) {
    const summary = String(event.pageSummary || "");
    for (const token of targets) {
      if (summary.includes(token)) {
        visited.add(token);
      }
    }
  }
  return visited.size / targets.length;
}

function filterRemarksByRolePair(remarks, roleMap, fromRole, toRole) {
  return remarks.filter((item) => {
    const sourceRole = roleMap.get(item.fromUserId);
    const targetRole = roleMap.get(item.toUserId);
    return sourceRole === fromRole && targetRole === toRole && item.createdAt;
  });
}

function computeReplyRateWithinDays(remarks, maxDays) {
  if (!remarks.length) {
    return 0;
  }
  const repliedCount = remarks.filter((item) => {
    if (!item.replyContent || !item.repliedAt) {
      return false;
    }
    const createdMs = new Date(item.createdAt).getTime();
    const repliedMs = new Date(item.repliedAt).getTime();
    if (!Number.isFinite(createdMs) || !Number.isFinite(repliedMs)) {
      return false;
    }
    return repliedMs - createdMs <= maxDays * 86400000;
  }).length;
  return repliedCount / remarks.length;
}

function isTaskOverdue(task, referenceNowMs) {
  if (!task || task.status === "completed" || !task.dueAt) {
    return false;
  }
  const dueMs = new Date(task.dueAt).getTime();
  return Number.isFinite(dueMs) && dueMs < referenceNowMs;
}

function normalizeRole(rawRole) {
  const role = String(rawRole || "").trim().toLowerCase();
  if (
    role === "manager" ||
    role === "regional_manager" ||
    role === "district_manager" ||
    role === "director" ||
    role === "vp"
  ) {
    return "manager";
  }
  if (role === "supervisor") {
    return "supervisor";
  }
  return "specialist";
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function improvement(baseline, current) {
  const base = Number(baseline || 0);
  const now = Number(current || 0);
  if (base <= 0) {
    return now <= 0 ? 1 : 0;
  }
  return clamp01((base - now) / base);
}

function stageImprovement(baseline, current) {
  const base = Number(baseline || 0);
  const now = Number(current || 0);
  if (base <= 0) {
    return now > 0 ? 1 : 0;
  }
  return clamp01((now - base) / Math.max(1, base));
}

function ratio(numerator, denominator) {
  const num = Number(numerator || 0);
  const den = Number(denominator || 0);
  if (den <= 0) {
    return 0;
  }
  return clamp01(num / den);
}

function clamp01(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}
