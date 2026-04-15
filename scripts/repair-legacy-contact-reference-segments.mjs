import fs from "node:fs";
import path from "node:path";

function main() {
  const options = parseArgs(process.argv.slice(2));
  const storePath = path.resolve(options.storePath);
  const store = readJson(storePath);
  const result = repairStoreContactReferences(store);

  if (!options.apply) {
    process.stdout.write(`${JSON.stringify(buildOutput({ options, storePath, result }), null, 2)}\n`);
    return;
  }

  if (!result.changed) {
    process.stdout.write(`${JSON.stringify(buildOutput({ options, storePath, result }), null, 2)}\n`);
    return;
  }

  const backupPath = resolveBackupPath(storePath, options.backupPath);
  ensureParentDir(backupPath);
  fs.copyFileSync(storePath, backupPath);
  if (store.meta && typeof store.meta === "object" && !Array.isArray(store.meta)) {
    store.meta.updatedAt = new Date().toISOString();
  }
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(buildOutput({ options, storePath, result, backupPath, applied: true }), null, 2)}\n`,
  );
}

function parseArgs(argv) {
  const options = {
    storePath: "data/store.json",
    backupPath: "",
    apply: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--store") {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error("--store requires a file path.");
      }
      options.storePath = nextValue;
      index += 1;
      continue;
    }
    if (arg === "--backup") {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error("--backup requires a file path.");
      }
      options.backupPath = nextValue;
      index += 1;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/repair-legacy-contact-reference-segments.mjs [--store <path>] [--apply] [--backup <path>]",
      "",
      "Dry-run by default. Use --apply to write the repaired store file.",
    ].join("\n"),
  );
}

function resolveBackupPath(storePath, rawBackupPath) {
  if (rawBackupPath) {
    return path.resolve(rawBackupPath);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(path.dirname(storePath), "backups", `store.contact-reference-repair.${timestamp}.json`);
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Store file does not exist: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildOutput({ options, storePath, result, backupPath = "", applied = false }) {
  return {
    ok: true,
    mode: options.apply ? "apply" : "dry-run",
    applied,
    storePath,
    backupPath: backupPath || null,
    changed: result.changed,
    summary: result.summary,
    samples: result.samples,
  };
}

function repairStoreContactReferences(targetStore) {
  const projectById = new Map(asArray(targetStore.projects).map((item) => [asString(item?.id), item]));
  const updatesByProjectId = new Map();
  const tasksByProjectId = new Map();
  const updatesById = new Map();

  for (const update of asArray(targetStore.updates)) {
    update.contactEntries = normalizeStoredContactEntries(update.contactEntries);
    const projectId = asString(update.projectId);
    updatesById.set(asString(update.id), update);
    if (!updatesByProjectId.has(projectId)) {
      updatesByProjectId.set(projectId, []);
    }
    updatesByProjectId.get(projectId).push(update);
  }

  for (const task of asArray(targetStore.tasks)) {
    task.relatedContactIds = normalizeStringIdArray(task.relatedContactIds);
    const projectId = asString(task.projectId);
    if (!tasksByProjectId.has(projectId)) {
      tasksByProjectId.set(projectId, []);
    }
    tasksByProjectId.get(projectId).push(task);
  }

  for (const updates of updatesByProjectId.values()) {
    updates.sort((left, right) => compareIsoDesc(left?.createdAt, right?.createdAt));
  }

  const summary = {
    entitiesChanged: {
      project: 0,
      update: 0,
      task: 0,
    },
    fieldsChanged: 0,
    fieldsBackfilled: 0,
    contactSegmentsCreated: 0,
    warningsAdded: 0,
  };
  const changedEntityKeys = {
    project: new Set(),
    update: new Set(),
    task: new Set(),
  };
  const warningSamples = [];
  const backfillSamples = [];

  for (const update of asArray(targetStore.updates)) {
    const project = projectById.get(asString(update.projectId));
    const hospitalId = asString(project?.hospitalId);
    const preferredMentions = update.contactEntries.map((entry) => ({
      contactId: entry.contactId,
      matchText: entry.name,
    }));
    const warnings = [];
    let entityChanged = false;
    for (const [legacyField, segmentField] of [
      ["feedbackSummary", "feedbackSummarySegments"],
      ["blockers", "blockersSegments"],
      ["opportunities", "opportunitiesSegments"],
      ["nextStep", "nextStepSegments"],
    ]) {
      const fieldResult = ensureStoredTextFieldReferences({
        targetStore,
        entity: update,
        legacyField,
        segmentField,
        hospitalId,
        preferredMentions,
      });
      warnings.push(...fieldResult.warnings);
      entityChanged = entityChanged || fieldResult.changed;
      applyFieldSummary({
        entityType: "update",
        entityId: asString(update.id),
        legacyField,
        fieldResult,
        summary,
        warningSamples,
        backfillSamples,
      });
    }
    const previousWarnings = JSON.stringify(normalizeStoredReferenceWarnings(update.contactReferenceWarnings));
    update.contactReferenceWarnings = mergeStoredReferenceWarnings(update.contactReferenceWarnings, warnings);
    if (JSON.stringify(update.contactReferenceWarnings) !== previousWarnings) {
      entityChanged = true;
      summary.warningsAdded += update.contactReferenceWarnings.length - JSON.parse(previousWarnings).length;
    }
    if (entityChanged) {
      changedEntityKeys.update.add(asString(update.id));
    }
  }

  for (const task of asArray(targetStore.tasks)) {
    const project = projectById.get(asString(task.projectId));
    const hospitalId = asString(project?.hospitalId);
    const sourceUpdate = asString(task.updateId) ? updatesById.get(asString(task.updateId)) : null;
    const preferredMentions = sourceUpdate
      ? sourceUpdate.contactEntries.map((entry) => ({
          contactId: entry.contactId,
          matchText: entry.name,
        }))
      : [];
    const warnings = [];
    let entityChanged = false;
    for (const [legacyField, segmentField] of [
      ["title", "titleSegments"],
      ["description", "descriptionSegments"],
    ]) {
      const fieldResult = ensureStoredTextFieldReferences({
        targetStore,
        entity: task,
        legacyField,
        segmentField,
        hospitalId,
        preferredMentions,
      });
      warnings.push(...fieldResult.warnings);
      entityChanged = entityChanged || fieldResult.changed;
      applyFieldSummary({
        entityType: "task",
        entityId: asString(task.id),
        legacyField,
        fieldResult,
        summary,
        warningSamples,
        backfillSamples,
      });
    }

    const previousRelatedContactIds = JSON.stringify(normalizeStringIdArray(task.relatedContactIds));
    task.relatedContactIds = normalizeStringIdArray([
      ...task.relatedContactIds,
      ...extractContactIdsFromSegments(task.titleSegments),
      ...extractContactIdsFromSegments(task.descriptionSegments),
    ]);
    if (JSON.stringify(task.relatedContactIds) !== previousRelatedContactIds) {
      entityChanged = true;
    }

    const previousWarnings = JSON.stringify(normalizeStoredReferenceWarnings(task.contactReferenceWarnings));
    task.contactReferenceWarnings = mergeStoredReferenceWarnings(task.contactReferenceWarnings, warnings);
    if (JSON.stringify(task.contactReferenceWarnings) !== previousWarnings) {
      entityChanged = true;
      summary.warningsAdded += task.contactReferenceWarnings.length - JSON.parse(previousWarnings).length;
    }

    if (entityChanged) {
      changedEntityKeys.task.add(asString(task.id));
    }
  }

  for (const project of asArray(targetStore.projects)) {
    const projectUpdates = updatesByProjectId.get(asString(project.id)) || [];
    const projectTasks = tasksByProjectId.get(asString(project.id)) || [];
    const latestUpdate = (project.latestUpdateId && updatesById.get(asString(project.latestUpdateId))) || projectUpdates[0] || null;
    const nextActionContactIds = normalizeStringIdArray(
      projectTasks.flatMap((task) => normalizeStringIdArray(task.relatedContactIds)),
    );
    const preferredSummaryMentions = latestUpdate
      ? latestUpdate.contactEntries.map((entry) => ({
          contactId: entry.contactId,
          matchText: entry.name,
        }))
      : [];
    const warnings = [];
    let entityChanged = false;
    for (const config of [
      {
        legacyField: "latestSummary",
        segmentField: "latestSummarySegments",
        preferredMentions: preferredSummaryMentions,
      },
      {
        legacyField: "nextAction",
        segmentField: "nextActionSegments",
        preferredMentions: nextActionContactIds.map((contactId) => ({
          contactId,
          matchText: getContactNameFromStore(targetStore, contactId),
        })),
      },
    ]) {
      const fieldResult = ensureStoredTextFieldReferences({
        targetStore,
        entity: project,
        legacyField: config.legacyField,
        segmentField: config.segmentField,
        hospitalId: project.hospitalId,
        preferredMentions: config.preferredMentions,
      });
      warnings.push(...fieldResult.warnings);
      entityChanged = entityChanged || fieldResult.changed;
      applyFieldSummary({
        entityType: "project",
        entityId: asString(project.id),
        legacyField: config.legacyField,
        fieldResult,
        summary,
        warningSamples,
        backfillSamples,
      });
    }

    const previousWarnings = JSON.stringify(normalizeStoredReferenceWarnings(project.contactReferenceWarnings));
    project.contactReferenceWarnings = mergeStoredReferenceWarnings(project.contactReferenceWarnings, warnings);
    if (JSON.stringify(project.contactReferenceWarnings) !== previousWarnings) {
      entityChanged = true;
      summary.warningsAdded += project.contactReferenceWarnings.length - JSON.parse(previousWarnings).length;
    }

    if (entityChanged) {
      changedEntityKeys.project.add(asString(project.id));
    }
  }

  summary.entitiesChanged.project = changedEntityKeys.project.size;
  summary.entitiesChanged.update = changedEntityKeys.update.size;
  summary.entitiesChanged.task = changedEntityKeys.task.size;
  const changed =
    Boolean(summary.fieldsChanged) ||
    Boolean(summary.entitiesChanged.project) ||
    Boolean(summary.entitiesChanged.update) ||
    Boolean(summary.entitiesChanged.task) ||
    Boolean(summary.warningsAdded);

  return {
    changed,
    summary,
    samples: {
      backfills: backfillSamples,
      warnings: warningSamples,
    },
  };
}

function applyFieldSummary({ entityType, entityId, legacyField, fieldResult, summary, warningSamples, backfillSamples }) {
  if (fieldResult.changed) {
    summary.fieldsChanged += 1;
  }
  if (fieldResult.backfilled) {
    summary.fieldsBackfilled += 1;
    summary.contactSegmentsCreated += fieldResult.contactSegmentsCreated;
    if (backfillSamples.length < 12) {
      backfillSamples.push({
        entityType,
        entityId,
        field: legacyField,
        contactSegmentsCreated: fieldResult.contactSegmentsCreated,
        renderedText: fieldResult.renderedText,
        segments: fieldResult.afterSegments,
      });
    }
  }
  for (const warning of fieldResult.warnings) {
    if (warningSamples.length >= 12) {
      break;
    }
    warningSamples.push({
      entityType,
      entityId,
      ...warning,
    });
  }
}

function ensureStoredTextFieldReferences({
  targetStore,
  entity,
  legacyField,
  segmentField,
  hospitalId,
  preferredMentions = [],
}) {
  const existingSegments = Array.isArray(entity?.[segmentField])
    ? normalizeStoredTextSegments(entity[segmentField], entity?.[legacyField])
    : null;
  const beforeSegments = normalizeStoredTextSegments(existingSegments, entity?.[legacyField]);
  const text = asText(entity?.[legacyField]) || renderStoredTextSegments(targetStore, existingSegments, entity?.[legacyField]);
  const normalizedSegments = normalizeStoredTextSegments(existingSegments, text);
  const hasContactReferences = normalizedSegments.some(
    (segment) => segment.type === "contact" && asString(segment.contactId),
  );

  if (!text) {
    entity[segmentField] = normalizedSegments;
    return buildFieldResult({
      legacyField,
      beforeSegments,
      afterSegments: entity[segmentField],
      warnings: [],
      renderedText: text,
    });
  }

  if (hasContactReferences) {
    entity[segmentField] = normalizedSegments;
    return buildFieldResult({
      legacyField,
      beforeSegments,
      afterSegments: entity[segmentField],
      warnings: [],
      renderedText: text,
    });
  }

  const { matches, unresolvedNames } = buildMigrationMentionCandidates({
    targetStore,
    hospitalId,
    preferredMentions,
  });
  const built = buildTextSegmentsFromMentions({
    text,
    matches,
    unresolvedNames,
  });
  entity[segmentField] = built.segments;
  return buildFieldResult({
    legacyField,
    beforeSegments,
    afterSegments: entity[segmentField],
    warnings: built.warnings.map((warning) => ({
      field: legacyField,
      name: warning.name,
      reason: warning.reason,
    })),
    renderedText: text,
  });
}

function buildFieldResult({ legacyField, beforeSegments, afterSegments, warnings, renderedText }) {
  const beforeJson = JSON.stringify(beforeSegments);
  const afterJson = JSON.stringify(afterSegments);
  const beforeContactSegments = countContactSegments(beforeSegments);
  const afterContactSegments = countContactSegments(afterSegments);
  return {
    legacyField,
    changed: beforeJson !== afterJson,
    backfilled: beforeContactSegments === 0 && afterContactSegments > 0,
    contactSegmentsCreated: beforeContactSegments === 0 ? afterContactSegments : 0,
    warnings,
    renderedText,
    afterSegments,
  };
}

function buildMigrationMentionCandidates({ targetStore, hospitalId, preferredMentions = [] }) {
  const hospitalContacts = asArray(targetStore?.contacts).filter((contact) => asString(contact?.hospitalId) === asString(hospitalId));
  const preferredByText = new Map();
  for (const mention of asArray(preferredMentions)) {
    const contactId = clipText(asString(mention?.contactId), 80);
    const matchText = clipText(asString(mention?.matchText), 120);
    if (!contactId || !matchText) {
      continue;
    }
    const contact = hospitalContacts.find((item) => asString(item?.id) === contactId);
    if (!contact) {
      continue;
    }
    const key = matchText.toLowerCase();
    if (!preferredByText.has(key)) {
      preferredByText.set(key, { matchText, contactIds: new Set(), fallbackText: matchText });
    }
    preferredByText.get(key).contactIds.add(asString(contact.id));
  }

  const hospitalByName = new Map();
  for (const contact of hospitalContacts) {
    const name = clipText(asString(contact?.name), 120);
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (!hospitalByName.has(key)) {
      hospitalByName.set(key, { matchText: name, contactIds: new Set() });
    }
    hospitalByName.get(key).contactIds.add(asString(contact.id));
  }

  const matches = [];
  const unresolvedNames = [];

  for (const item of preferredByText.values()) {
    const contactIds = [...item.contactIds];
    if (contactIds.length === 1) {
      matches.push({
        contactId: contactIds[0],
        matchText: item.matchText,
        fallbackText: item.fallbackText || item.matchText,
      });
      continue;
    }
    unresolvedNames.push(item.matchText);
  }

  for (const [key, item] of hospitalByName.entries()) {
    if (preferredByText.has(key)) {
      continue;
    }
    const contactIds = [...item.contactIds];
    if (contactIds.length === 1) {
      matches.push({
        contactId: contactIds[0],
        matchText: item.matchText,
        fallbackText: item.matchText,
      });
      continue;
    }
    unresolvedNames.push(item.matchText);
  }

  return {
    matches,
    unresolvedNames: uniqueStrings(unresolvedNames),
  };
}

function buildTextSegmentsFromMentions({ text, matches = [], unresolvedNames = [] }) {
  const sourceText = asText(text);
  if (!sourceText) {
    return { segments: [], warnings: [] };
  }

  const uniqueMatches = [];
  const seenMatches = new Set();
  for (const item of asArray(matches)) {
    const contactId = clipText(asString(item?.contactId), 80);
    const matchText = clipText(asString(item?.matchText), 120);
    const fallbackText = clipText(asText(item?.fallbackText) || matchText, 120);
    if (!contactId || !matchText) {
      continue;
    }
    const key = `${contactId}::${matchText.toLowerCase()}`;
    if (seenMatches.has(key)) {
      continue;
    }
    seenMatches.add(key);
    uniqueMatches.push({
      contactId,
      matchText,
      fallbackText,
    });
  }

  const occurrences = [];
  for (const match of uniqueMatches) {
    let searchFrom = 0;
    while (searchFrom < sourceText.length) {
      const foundAt = sourceText.indexOf(match.matchText, searchFrom);
      if (foundAt < 0) {
        break;
      }
      occurrences.push({
        start: foundAt,
        end: foundAt + match.matchText.length,
        match,
      });
      searchFrom = foundAt + match.matchText.length;
    }
  }

  occurrences.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return right.match.matchText.length - left.match.matchText.length;
  });

  const segments = [];
  let cursor = 0;
  for (const occurrence of occurrences) {
    if (occurrence.start < cursor) {
      continue;
    }
    if (occurrence.start > cursor) {
      segments.push({
        type: "text",
        text: sourceText.slice(cursor, occurrence.start),
      });
    }
    segments.push({
      type: "contact",
      contactId: occurrence.match.contactId,
      fallbackText: occurrence.match.fallbackText,
    });
    cursor = occurrence.end;
  }

  if (cursor < sourceText.length) {
    segments.push({
      type: "text",
      text: sourceText.slice(cursor),
    });
  }

  const warnings = [];
  const seenWarnings = new Set();
  for (const unresolvedName of uniqueStrings(unresolvedNames)) {
    if (!unresolvedName || !sourceText.includes(unresolvedName)) {
      continue;
    }
    const key = unresolvedName.toLowerCase();
    if (seenWarnings.has(key)) {
      continue;
    }
    seenWarnings.add(key);
    warnings.push({
      name: unresolvedName,
      reason: "ambiguous-name",
    });
  }

  return {
    segments: coalesceStoredTextSegments(segments.length ? segments : [{ type: "text", text: sourceText }]),
    warnings,
  };
}

function renderStoredTextSegments(targetStore, rawSegments, fallbackText = "") {
  return normalizeStoredTextSegments(rawSegments, fallbackText)
    .map((segment) => {
      if (segment.type === "contact") {
        return getContactNameFromStore(targetStore, segment.contactId) || segment.fallbackText || "";
      }
      return asText(segment.text);
    })
    .join("");
}

function normalizeStoredContactEntries(rawEntries) {
  return asArray(rawEntries)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const normalized = {
        contactId: clipText(asString(item.contactId), 80),
        name: clipText(asString(item.name), 40),
        role: clipText(asString(item.role), 40),
      };
      if (!normalized.contactId && !normalized.name) {
        return null;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeStoredTextSegments(rawSegments, fallbackText = "") {
  if (!Array.isArray(rawSegments) || !rawSegments.length) {
    const text = asText(fallbackText);
    return text ? [{ type: "text", text }] : [];
  }

  const normalized = [];
  for (const item of rawSegments) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    if (item.type === "contact") {
      const contactId = clipText(asString(item.contactId), 80);
      const fallbackValue = clipText(asText(item.fallbackText || item.text || item.name), 120);
      if (!contactId && !fallbackValue) {
        continue;
      }
      normalized.push({
        type: "contact",
        contactId,
        fallbackText: fallbackValue,
      });
      continue;
    }

    const text = asText(item.text || item.value);
    if (!text) {
      continue;
    }
    normalized.push({ type: "text", text });
  }

  return coalesceStoredTextSegments(normalized);
}

function normalizeStoredReferenceWarnings(rawWarnings) {
  if (!Array.isArray(rawWarnings)) {
    return [];
  }
  const deduped = [];
  const seen = new Set();
  for (const item of rawWarnings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const normalized = {
      field: clipText(asString(item.field), 80),
      name: clipText(asString(item.name), 80),
      reason: clipText(asString(item.reason), 80) || "ambiguous-name",
      message: clipText(asText(item.message), 240),
    };
    if (!normalized.field || !normalized.name) {
      continue;
    }
    const key = `${normalized.field}::${normalized.name.toLowerCase()}::${normalized.reason}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
}

function normalizeStringIdArray(rawValues) {
  return uniqueStrings(asArray(rawValues).map((item) => clipText(asString(item), 80)).filter(Boolean));
}

function coalesceStoredTextSegments(segments) {
  const normalized = [];
  for (const segment of asArray(segments)) {
    if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
      continue;
    }
    if (segment.type === "text") {
      const text = asText(segment.text);
      if (!text) {
        continue;
      }
      const previous = normalized[normalized.length - 1];
      if (previous?.type === "text") {
        previous.text += text;
      } else {
        normalized.push({ type: "text", text });
      }
      continue;
    }
    if (segment.type === "contact") {
      const contactId = clipText(asString(segment.contactId), 80);
      const fallbackText = clipText(asText(segment.fallbackText), 120);
      if (!contactId && !fallbackText) {
        continue;
      }
      normalized.push({
        type: "contact",
        contactId,
        fallbackText,
      });
    }
  }
  return normalized;
}

function mergeStoredReferenceWarnings(existingWarnings, nextWarnings) {
  return normalizeStoredReferenceWarnings([...(existingWarnings || []), ...(nextWarnings || [])]);
}

function extractContactIdsFromSegments(rawSegments) {
  return normalizeStringIdArray(
    normalizeStoredTextSegments(rawSegments).map((segment) => (segment.type === "contact" ? segment.contactId : "")),
  );
}

function getContactNameFromStore(targetStore, contactId) {
  const normalizedContactId = clipText(asString(contactId), 80);
  if (!normalizedContactId) {
    return "";
  }
  return asArray(targetStore?.contacts).find((item) => asString(item?.id) === normalizedContactId)?.name || "";
}

function countContactSegments(rawSegments) {
  return normalizeStoredTextSegments(rawSegments).filter(
    (segment) => segment.type === "contact" && asString(segment.contactId),
  ).length;
}

function compareIsoDesc(left, right) {
  return new Date(right || 0).getTime() - new Date(left || 0).getTime();
}

function clipText(value, maxLength) {
  const text = asString(value);
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).filter(Boolean))];
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
