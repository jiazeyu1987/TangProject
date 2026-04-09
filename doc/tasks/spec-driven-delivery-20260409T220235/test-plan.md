# Test Plan Template

- Task ID: `spec-driven-delivery-20260409T220235`
- Created: `2026-04-09T22:02:35`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `根据参考图片调整纪要录入回复界面，新增或改造回复专用录入条目与历史时间线展示，按 spec-driven-delivery 流程交付`

## Test Scope

Describe what must be validated and which flows or modules are intentionally out of scope.

## Environment

List required services, startup steps, environment variables, seed data, and platform assumptions.

## Accounts and Fixtures

List any required roles, credentials, fixtures, or datasets.

If any required item is missing, the tester must fail fast and record the missing prerequisite.

## Commands

List the exact commands to run, including narrow checks and broader regression checks.

For each command, note the expected success signal.

## Test Cases

Use stable test case ids. Every acceptance id from the PRD should appear in at least one `Covers` field.

### T1: [title]

- Covers: P1-AC1
- Level:
- Command:
- Expected:

Repeat for every important path, regression branch, or failure mode.

## Coverage Matrix

| Case ID | Area | Scenario | Level | Acceptance IDs | Evidence |
| --- | --- | --- | --- | --- | --- |
| T1 | [module or flow] | [what is validated] | [unit/integration/e2e/manual] | P1-AC1 | [where to record proof] |

## Evaluator Independence

- Mode: blind-first-pass
- Validation surface: real-runtime
- Required tools:
- First-pass readable artifacts: prd.md, test-plan.md
- Withheld artifacts: execution-log.md, task-state.json
- Real environment expectation: Run against the real repo and runtime. If a UI or interaction path is in scope, use a real browser or session and record concrete evidence.
- Escalation rule: Do not inspect withheld artifacts until the tester has written an initial verdict or the main agent explicitly asks for discrepancy analysis.

## Pass / Fail Criteria

- Pass when:
- Fail when:

## Regression Scope

List adjacent areas that must be rechecked because of coupling, shared contracts, or high-risk logic.

## Reporting Notes

Write results to `test-report.md`.

The tester must remain independent from the executor and should prefer blind-first-pass unless the task explicitly needs full-context evaluation.
