# Test Plan

- Task ID: `spec-driven-delivery-20260409T220235`
- Created: `2026-04-09T22:02:35`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `根据图片需求完成内容`

## Test Scope

Validate the reply-specific 纪要录入 flow end to end:

- clicking `回复/回答` from a timeline remark opens a dedicated reply mode
- the source remark is visible in the entry page
- the reply is submitted through the existing remark-reply path before the intake record is saved
- the detail timeline exposes reply/read history clearly after the save
- the normal non-reply intake path still works

Out of scope:

- auth redesign
- unrelated project/task/followup screens
- data migration or schema redesign
- any fallback, mock, or compatibility behavior

## Environment

- Run against the real repository and the real app runtime
- Start the app with `npm start` in a separate terminal unless it is already running
- Use the app’s reported local origin and verify that `/api/health` responds successfully there
- Use a real browser session for all UI checks; do not validate this task against a mock server or static replay
- The current store or seed data must already contain a reply-capable project remark thread
- If a required remark thread or login session is missing, fail fast instead of creating synthetic fixtures

## Accounts and Fixtures

- A tester-capable login/session with access to at least one project containing a timeline remark that shows `回复/回答` and `已读`
- The target project must already exist in the current store or seed data
- If the required account or fixture is unavailable, stop and record the missing prerequisite

## Commands

1. `npm run check`
- Expected success signal: exits 0 with no check failures

2. `npm start`
- Expected success signal: the app starts cleanly and the reported origin serves the real UI plus `/api/health`

3. `npx --yes --package @playwright/cli@latest playwright-cli --help`
- Expected success signal: the CLI prints its command list and exits 0, confirming the browser automation tool is available

4. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow open http://127.0.0.1:3000 --browser=chromium --headed --persistent`
- Expected success signal: a real Chromium browser opens on the app and the session is available for follow-up CLI commands

5. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow snapshot`
- Expected success signal: a current page snapshot is printed so the tester can capture element refs for the reply row, note field, and submit controls

## Test Cases

Use stable test case ids. Every acceptance id from the PRD should appear in at least one `Covers` field.

### T1: Enter reply mode from a timeline remark

- Covers: P1-AC1, P1-AC2
- Level: manual
- Command:
  1. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow open http://127.0.0.1:3000 --browser=chromium --headed --persistent`
  2. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow snapshot`
  3. Use the current snapshot to click the reply action ref for `回答`
  4. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow snapshot`
  5. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow screenshot`
- Expected: clicking `回复/回答` switches the entry page into reply mode, shows the source remark, and updates the header/labels/placeholders to reply-oriented language

### T2: Submit the reply and persist linkage

- Covers: P2-AC1, P2-AC2
- Level: e2e
- Command:
  1. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow snapshot`
  2. Use the current snapshot to fill the reply textarea ref with `已根据留言完成回复，并同步补充纪要。`
  3. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow tracing-start`
  4. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow network`
  5. Use the current snapshot to click the submit button ref
  6. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow tracing-stop`
  7. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow screenshot`
- Expected: the reply content is posted through the remark-reply flow before the intake save, and the resulting record/history keeps the source remark linkage and reply text

### T3: Verify timeline history and non-reply regression

- Covers: P3-AC1, P3-AC2
- Level: manual
- Command:
  1. `npm run check`
  2. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow snapshot`
  3. Use the current snapshot to click the read-state action ref for `已读`
  4. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow snapshot`
  5. `npx --yes --package @playwright/cli@latest playwright-cli -s=reply-flow screenshot`
- Expected: the detail timeline clearly shows reply/read history, and the baseline non-reply intake path still passes the repository check

## Coverage Matrix

| Case ID | Area | Scenario | Level | Acceptance IDs | Evidence |
| --- | --- | --- | --- | --- | --- |
| T1 | Entry reply mode | Clicking reply from a remark opens reply-specific compose state with source context | manual | P1-AC1, P1-AC2 | Snapshot output, screenshot output, and `test-report.md` case entry |
| T2 | Reply persistence | Reply content is stored through the existing reply flow before intake submit | e2e | P2-AC1, P2-AC2 | Tracing output, network output, screenshot output, and `test-report.md` case entry |
| T3 | Timeline + regression | Detail timeline shows reply/read history and standard intake remains healthy | manual | P3-AC1, P3-AC2 | Snapshot output, screenshot output, `npm run check` output, and `test-report.md` case entry |

## Evaluator Independence

- Mode: blind-first-pass
- Validation surface: real-browser
- Required tools: playwright
- First-pass readable artifacts: prd.md, test-plan.md
- Withheld artifacts: execution-log.md, task-state.json
- Real environment expectation: run the test cases against the real repo and runtime in a real browser session, and do not inspect withheld artifacts until an initial verdict exists
- Escalation rule: if the first pass fails, keep the tester independent and retry only after the executor fixes the reported gaps

## Pass / Fail Criteria

- Pass when all three test cases pass, the required browser evidence is recorded, and `npm run check` succeeds
- Pass only if the reply flow behaves as a dedicated reply mode and the saved history matches the target remark
- Fail when any required fixture, browser path, reply request, save step, or history display is missing or when the task relies on fallback, mock, or silent downgrade behavior

## Regression Scope

- Standard intake entry and submit flow outside reply mode
- Project detail timeline rendering and remark action affordances
- Reply/read API interactions already used by the timeline rows
- Login/session bootstrap and project selection
- Any shared reply-state reset logic around the supplement flow

## Reporting Notes

Write results to `test-report.md`.

Record per-case verdicts, the environment used, the generated browser evidence paths from the CLI run, and the final pass/fail decision. Do not reveal `execution-log.md` or `task-state.json` on the first tester pass.
