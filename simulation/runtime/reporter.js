import fs from "node:fs";
import path from "node:path";

import { readJsonFile, writeJsonFile, writeTextFile } from "./helpers.js";

export async function buildDailyReport({
  runtime,
  scenario,
  dailySummary,
  dayEvents,
}) {
  const dayNumber = String(dailySummary.dayIndex + 1).padStart(2, "0");
  const fileName = `day-${dayNumber}-${dailySummary.simDate}.md`;
  const reportPath = path.join(runtime.paths.dailyDir, fileName);
  const storeSnapshotPath = path.join(
    runtime.paths.snapshotsDir,
    `day-${dayNumber}-store.json`,
  );
  fs.copyFileSync(runtime.paths.storeFile, storeSnapshotPath);

  const lines = [];
  lines.push(`# Day ${dailySummary.dayIndex + 1} (${dailySummary.simDate})`);
  lines.push("");
  lines.push(`- Scenario: ${scenario.name}`);
  lines.push(`- Event count: ${dailySummary.eventCount}`);
  lines.push(
    `- First-round all idle: ${dailySummary.firstRoundAllIdle ? "yes" : "no"}`,
  );
  lines.push(`- Store snapshot: ${path.relative(runtime.paths.runDir, storeSnapshotPath)}`);
  lines.push("");
  lines.push("## Scores");
  lines.push("");
  lines.push(
    `- Manager: ${dailySummary.score.manager.score.toFixed(2)} | ${renderKpis(
      dailySummary.score.manager.kpis,
    )}`,
  );
  lines.push(
    `- Supervisor: ${dailySummary.score.supervisor.score.toFixed(2)} | ${renderKpis(
      dailySummary.score.supervisor.kpis,
    )}`,
  );
  lines.push(
    `- Specialist: ${dailySummary.score.specialist.score.toFixed(2)} | ${renderKpis(
      dailySummary.score.specialist.kpis,
    )}`,
  );
  lines.push("");
  lines.push("## Metrics");
  lines.push("");
  lines.push(
    `- Projects: ${dailySummary.metrics.totals.projects}, attention=${dailySummary.metrics.totals.attentionProjects}, high-risk=${dailySummary.metrics.totals.highRiskProjects}`,
  );
  lines.push(
    `- Task statuses: ${renderKeyValuePairs(dailySummary.metrics.totals.taskStatusCounts)}`,
  );
  lines.push(
    `- Stage distribution: ${renderKeyValuePairs(dailySummary.metrics.totals.stageDistribution)}`,
  );
  lines.push(
    `- Overdue tasks: total=${dailySummary.metrics.totals.overdueTasks}, region=${dailySummary.metrics.region.overdueTasks}`,
  );
  lines.push(
    `- Reply rates: manager->supervisor(2d)=${percent(
      dailySummary.metrics.replies.managerToSupervisorWithin2d,
    )}, supervisor->specialist(2d)=${percent(
      dailySummary.metrics.replies.supervisorToSpecialistWithin2d,
    )}, specialist(1d)=${percent(dailySummary.metrics.replies.specialistReplyWithin1d)}`,
  );
  lines.push("");
  lines.push("## Event Digest");
  lines.push("");
  if (!dayEvents.length) {
    lines.push("- No events were recorded.");
  } else {
    for (const event of dayEvents) {
      const stateTag = event.stateChanged ? "state-changed" : "no-change";
      const errorTag = event.error ? ` | error=${event.error}` : "";
      lines.push(
        `- ${event.simDate} ${event.role} turn=${event.turnIndex} action=${event.actionType} ${stateTag} | ${event.pageSummary || "(no page summary)"}${errorTag}`,
      );
    }
  }
  lines.push("");

  await writeTextFile(reportPath, lines.join("\n"));
}

export async function buildFinalReport({
  runtime,
  scenario,
  status,
  fatalError,
  events,
  dailySummaries,
}) {
  const lines = [];
  lines.push(`# Simulation Final Report`);
  lines.push("");
  lines.push(`- Run ID: ${runtime.runId}`);
  lines.push(`- Scenario: ${scenario.name}`);
  lines.push(`- Status: ${status}`);
  lines.push(`- Base URL: ${runtime.baseUrl}`);
  lines.push(`- Days completed: ${dailySummaries.length}/${scenario.days}`);
  lines.push(`- Total events: ${events.length}`);
  lines.push(`- Fatal error: ${fatalError ? fatalError.message : "none"}`);
  lines.push("");
  lines.push("## Daily Score Timeline");
  lines.push("");
  lines.push("| Day | Date | Manager | Supervisor | Specialist |");
  lines.push("| --- | --- | ---: | ---: | ---: |");
  for (const day of dailySummaries) {
    lines.push(
      `| ${day.dayIndex + 1} | ${day.simDate} | ${day.score.manager.score.toFixed(
        2,
      )} | ${day.score.supervisor.score.toFixed(2)} | ${day.score.specialist.score.toFixed(2)} |`,
    );
  }
  lines.push("");
  lines.push("## Evolution Highlights");
  lines.push("");
  if (!dailySummaries.length) {
    lines.push("- No completed day summary.");
  } else {
    const first = dailySummaries[0];
    const last = dailySummaries[dailySummaries.length - 1];
    lines.push(
      `- Attention projects: ${first.metrics.totals.attentionProjects} -> ${last.metrics.totals.attentionProjects}`,
    );
    lines.push(
      `- Overdue tasks: ${first.metrics.totals.overdueTasks} -> ${last.metrics.totals.overdueTasks}`,
    );
    lines.push(
      `- Task status shift: ${renderStatusTransition(first.metrics.totals.taskStatusCounts, last.metrics.totals.taskStatusCounts)}`,
    );
    lines.push(
      `- Stage distribution shift: ${renderStatusTransition(first.metrics.totals.stageDistribution, last.metrics.totals.stageDistribution)}`,
    );
    lines.push(
      `- Region high-risk projects: ${first.metrics.region.highRiskProjects} -> ${last.metrics.region.highRiskProjects}`,
    );
    lines.push(
      `- Specialist task completion: ${percent(
        ratio(first.metrics.specialist.completedTaskCount, first.metrics.specialist.assignedTaskCount),
      )} -> ${percent(
        ratio(last.metrics.specialist.completedTaskCount, last.metrics.specialist.assignedTaskCount),
      )}`,
    );
    lines.push(
      `- Remark chain rates: manager->supervisor(2d) ${percent(
        first.metrics.replies.managerToSupervisorWithin2d,
      )} -> ${percent(last.metrics.replies.managerToSupervisorWithin2d)}, supervisor->specialist(2d) ${percent(
        first.metrics.replies.supervisorToSpecialistWithin2d,
      )} -> ${percent(last.metrics.replies.supervisorToSpecialistWithin2d)}, specialist(1d) ${percent(
        first.metrics.replies.specialistReplyWithin1d,
      )} -> ${percent(last.metrics.replies.specialistReplyWithin1d)}`,
    );
  }
  lines.push("");
  lines.push("## Key Artifacts");
  lines.push("");
  lines.push(`- Daily reports: ${path.relative(runtime.paths.runDir, runtime.paths.dailyDir)}`);
  lines.push(`- State snapshots: ${path.relative(runtime.paths.runDir, runtime.paths.snapshotsDir)}`);
  lines.push(`- Screenshots: ${path.relative(runtime.paths.runDir, runtime.paths.screenshotsDir)}`);
  lines.push(`- Traces: ${path.relative(runtime.paths.runDir, runtime.paths.tracesDir)}`);
  lines.push(`- Events JSONL: ${path.relative(runtime.paths.runDir, runtime.paths.eventsFile)}`);
  lines.push("");

  await writeTextFile(runtime.paths.finalReportFile, lines.join("\n"));
}

export async function persistRunArtifacts({
  runtime,
  status,
  fatalError,
  events,
  dailySummaries,
}) {
  const eventLines = events.map((event) => JSON.stringify(event)).join("\n");
  await writeTextFile(runtime.paths.eventsFile, eventLines ? `${eventLines}\n` : "");

  const manifest = readJsonFile(runtime.paths.runManifestFile);
  await writeJsonFile(runtime.paths.runManifestFile, {
    ...manifest,
    status,
    endAt: new Date().toISOString(),
    error: fatalError ? fatalError.message : "",
    accounts: runtime.roleCatalog?.all || manifest.accounts || [],
    summary: {
      daysCompleted: dailySummaries.length,
      totalEvents: events.length,
      dailyReportsDir: runtime.paths.dailyDir,
      finalReportFile: runtime.paths.finalReportFile,
    },
  });
}

function renderKpis(kpis) {
  return Object.entries(kpis)
    .map(([key, value]) => `${key}=${percent(value)}`)
    .join(", ");
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function ratio(numerator, denominator) {
  const den = Number(denominator || 0);
  if (den <= 0) {
    return 0;
  }
  return Number(numerator || 0) / den;
}

function renderKeyValuePairs(mapLike) {
  const entries = Object.entries(mapLike || {});
  if (!entries.length) {
    return "(none)";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function renderStatusTransition(before, after) {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  return [...keys]
    .sort()
    .map((key) => `${key}:${Number(before?.[key] || 0)}->${Number(after?.[key] || 0)}`)
    .join(", ");
}
