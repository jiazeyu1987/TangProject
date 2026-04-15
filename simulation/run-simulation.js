import path from "node:path";

import { loadScenario } from "./scenario-loader.js";
import { initializeRuntime, shutdownRuntime } from "./runtime/environment.js";
import { buildFinalReport, buildDailyReport, persistRunArtifacts } from "./runtime/reporter.js";
import { createRoleAgents, disposeRoleAgents } from "./runtime/role-agent.js";
import { collectStoreMetrics, scoreDailyMetrics } from "./runtime/scoring.js";
import { readJsonFile, toIsoDateByOffset, writeJsonFile } from "./runtime/helpers.js";

export async function runSimulation({ projectRoot, scenarioName }) {
  const scenario = loadScenario({ projectRoot, scenarioName });
  const runtime = await initializeRuntime({ projectRoot, scenario });
  const events = [];
  const dailySummaries = [];
  let fatalError = null;
  let status = "running";

  try {
    const roleAgents = await createRoleAgents({
      runtime,
      scenario,
    });
    try {
      const baselineStore = readJsonFile(runtime.paths.storeFile);
      const baselineMetrics = collectStoreMetrics({
        store: baselineStore,
        roleCatalog: roleAgents.roleCatalog,
      });
      await writeJsonFile(runtime.paths.baselineMetricsFile, baselineMetrics);

      for (let dayIndex = 0; dayIndex < scenario.days; dayIndex += 1) {
        const simDate = toIsoDateByOffset(scenario.startDate, dayIndex);
        const dayEvents = [];
        const dayStartedAt = new Date().toISOString();

        await runtime.clock.setDay({
          simDate,
          dayIndex,
          turnIndex: 0,
        });

        let firstRoundAllIdle = true;
        for (let roundIndex = 0; roundIndex < scenario.turnBudget.roundsPerDay; roundIndex += 1) {
          let roundHasActions = false;
          for (let roleIndex = 0; roleIndex < roleAgents.turnOrder.length; roleIndex += 1) {
            const turnOrdinal =
              roundIndex * roleAgents.turnOrder.length + roleIndex + 1;
            const clockSnapshot = await runtime.clock.setDay({
              simDate,
              dayIndex,
              turnIndex: turnOrdinal,
            });
            const agent = roleAgents.turnOrder[roleIndex];
            const turnResult = await agent.runTurn({
              simDate,
              dayIndex,
              roundIndex,
              turnOrdinal,
              maxActions: scenario.turnBudget.maxActionsPerTurn,
              simulatedDateTime: clockSnapshot.currentDateTime,
            });
            dayEvents.push(...turnResult.events);
            events.push(...turnResult.events);
            if (turnResult.events.some((item) => item.actionType !== "idle")) {
              roundHasActions = true;
            }
          }
          if (roundIndex === 0) {
            firstRoundAllIdle = !roundHasActions;
            if (firstRoundAllIdle) {
              break;
            }
          }
        }

        const storeSnapshot = readJsonFile(runtime.paths.storeFile);
        const metrics = collectStoreMetrics({
          store: storeSnapshot,
          roleCatalog: roleAgents.roleCatalog,
        });
        const score = scoreDailyMetrics({
          baseline: baselineMetrics,
          current: metrics,
          scorecards: scenario.scorecards,
          dayEvents,
        });
        const dailySummary = {
          simDate,
          dayIndex,
          dayStartedAt,
          dayFinishedAt: new Date().toISOString(),
          firstRoundAllIdle,
          eventCount: dayEvents.length,
          metrics,
          score,
        };
        dailySummaries.push(dailySummary);
        await buildDailyReport({
          runtime,
          scenario,
          dailySummary,
          dayEvents,
        });
      }

      status = "completed";
    } finally {
      await disposeRoleAgents(roleAgents);
    }
  } catch (error) {
    fatalError = error;
    status = "failed";
  } finally {
    await persistRunArtifacts({
      runtime,
      scenario,
      status,
      fatalError,
      events,
      dailySummaries,
    });
    await buildFinalReport({
      runtime,
      scenario,
      status,
      fatalError,
      events,
      dailySummaries,
    });
    await shutdownRuntime(runtime);
  }

  if (fatalError) {
    throw fatalError;
  }

  return {
    ok: status === "completed",
    runId: runtime.runId,
    outputDir: path.relative(projectRoot, runtime.paths.runDir),
    report: runtime.paths.finalReportFile,
  };
}
