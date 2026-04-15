# PRD

- Task ID: `spec-driven-delivery-20260409T220235`
- Created: `2026-04-09T22:02:35`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `根据图片需求完成内容`

## Goal

Adjust the 纪要录入 reply flow so a click on timeline `回复/回答` enters a dedicated reply mode instead of only seeding a generic supplement draft. In that mode the UI must:

- make the reply intent explicit in the page header and supporting copy
- show the source remark being replied to
- switch the date and note controls to reply-oriented language
- send the reply through the existing remark-reply path before the supplemental intake submission
- keep the detail timeline readable for reply/read history

The change must preserve the existing project, task, and intake behaviors outside this reply path.

## Scope

In scope:

- `public/index.html` for the entry-page layout and reply-mode copy
- `public/app.js` for reply-mode state, remark selection, submit sequencing, and timeline rendering
- `public/styles.css` for the reply-mode and timeline presentation updates
- `server.js` only if the existing reply/read payload contract must be surfaced more clearly in the UI

## Non-Goals

- No redesign of auth, project creation, task management, or follow-up features
- No schema migration or data model rewrite
- No fallback branches, mock data, or compatibility shims
- No changes to unrelated intake flows that do not originate from a remark reply action
- No attempt to reproduce the screenshots by hiding missing data or silently substituting another flow

## Preconditions

- The repository must run locally with `npm run check` and `npm start`
- The tester must be able to open the real app in a browser, not a mock or static replay
- The current store or seed data must contain at least one project with a timeline remark that exposes `回复/回答` and `已读` actions
- A tester session with access to that project must be available through the app’s normal login path
- Playwright must be available for real-browser validation

If any prerequisite is missing, stop and record the exact missing item in `task-state.json.blocking_prereqs`.

## Impacted Areas

- `public/index.html` entry form structure, labels, and helper text
- `public/app.js` reply-mode state, `startSupplementFromRemark`, `ensureSupplementRemarkReply`, submit flow, and timeline row rendering
- `public/styles.css` reply-mode layout, source-remark display, and timeline affordances
- `server.js` reply/read endpoints and the stored remark view model if the UI needs additional reply metadata
- `data/store.json` only as the runtime data source used by the existing APIs
- Browser-based regression coverage for the intake flow and project detail timeline

## Phase Plan

Use stable phase ids. Do not renumber ids after execution has started.

### P1: Reply mode entry surface

- Objective: Make the reply action visibly switch the entry page into a dedicated reply mode with the target remark shown on screen.
- Owned paths: `public/index.html`, `public/app.js`, `public/styles.css`
- Dependencies: existing remark rows, remark selection state, and authenticated access to a project detail view
- Deliverables: reply-specific header/copy, visible source-remark block, reply-oriented labels/placeholders, and focus behavior that lands in the reply field

### P2: Reply submission and linkage

- Objective: Preserve the source remark association and submit the reply content through the existing reply endpoint before the intake record is stored.
- Owned paths: `public/app.js`, `server.js`, `data/store.json`
- Dependencies: existing `POST /api/project-remarks/:remarkId/reply` behavior and the current intake submit path
- Deliverables: submit sequencing, payload mapping, post-submit state reset, and no stale reply context after save

### P3: Timeline history and regression guard

- Objective: Make the detail timeline clearly expose reply/read history while keeping the standard intake flow intact.
- Owned paths: `public/app.js`, `public/styles.css`
- Dependencies: the existing detail timeline data and the reply/read APIs already present in the app
- Deliverables: readable reply/read history rows, clear action affordances, and verified regression coverage for the non-reply entry path

## Phase Acceptance Criteria

### P1

- P1-AC1: Clicking a timeline `回复/回答` action switches the entry page into a reply-specific mode with a visible source-remark block and a reply-oriented page header/copy.
- P1-AC2: In reply mode, the date and note controls use reply-oriented labels or placeholders, and the screen no longer reads like a generic supplement draft.
- Evidence expectation: a real-browser screenshot and Playwright trace showing the transition into reply mode from the remark row.

### P2

- P2-AC1: Submitting from reply mode posts the reply content through the existing remark-reply flow before the intake record is saved.
- P2-AC2: The saved record preserves the target remark linkage and the entered reply text, and the UI returns to a clean post-submit state without stale reply context.
- Evidence expectation: network evidence or trace showing the reply request followed by the intake submit, plus the resulting persisted history visible in the app.

### P3

- P3-AC1: The detail timeline makes reply and read history legible, with the source remark, reply action, and read state visible in the row or expansion that matches the screenshot intent.
- P3-AC2: The standard non-reply intake path still works and `npm run check` remains clean after the reply-flow changes.
- Evidence expectation: a real-browser screenshot or trace of the updated timeline and a successful `npm run check` result.

## Done Definition

The task is complete only when:

- every phase in `## Phase Plan` is completed
- every acceptance criterion listed above has matching evidence in `execution-log.md` or `test-report.md`
- the tester has validated the result in a real browser against the real app runtime
- the final UI reflects the reply-specific mode, source remark context, and history visibility required by the screenshots
- no fallback, mock, or silent downgrade was introduced to satisfy the task

## Blocking Conditions

- Missing runtime prerequisites such as `npm start`, `npm run check`, Playwright, or browser access
- Missing seeded remark data or login access required to reach a reply-capable project detail page
- Missing or incompatible reply/read endpoint behavior that prevents the existing flow from operating end to end
- Any attempt to solve the task through fallback, mock behavior, or silent downgrade instead of the requested UI change
