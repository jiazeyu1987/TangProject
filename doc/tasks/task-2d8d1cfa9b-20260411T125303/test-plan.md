# Test Plan

- Task ID: `task-2d8d1cfa9b-20260411T125303`
- Created: `2026-04-11`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `修复前端上的乱码问题，将英文转换成中文`

## Test Scope

- 验证前端关键页面文案无乱码。
- 验证关键可见英文标签已替换为中文。
- 验证改动不引入语法回归。

## Environment

- 本地服务：`http://127.0.0.1:3000`
- Node.js 项目依赖已安装
- Playwright 可运行

## Accounts and Fixtures

- 无需特定账号（文案校验可在未登录态完成）

若环境不可用，立即 fail-fast。

## Commands

- `npm run check`
  - 预期：`check:app` 与 `check:sim` 全部通过。
- `node -`（内联 Playwright 脚本）
  - 预期：输出 `E2E_OK ...final-e2e-summary.json`，且 summary `finalResult=passed`。

## Test Cases

### T1: 静态检查通过

- Covers: P2-AC1
- Level: integration
- Command: `npm run check`
- Expected: 退出码为 0，无语法报错。

### T2: 关键文案中文化（真实浏览器）

- Covers: P1-AC1, P1-AC2, P2-AC2
- Level: e2e
- Command: `node -`（执行 Playwright 文案校验脚本）
- Expected: 标题与关键按钮/眉题均为中文、无已知乱码特征串，且生成 summary 与截图证据，`finalResult=passed`。

## Coverage Matrix

| Case ID | Area | Scenario | Level | Acceptance IDs | Evidence |
| --- | --- | --- | --- | --- | --- |
| T1 | 前端静态检查 | app.js/index.html 语法与静态检查 | integration | P2-AC1 | 命令输出 |
| T2 | 前端页面文案 | 中文文案与乱码检查（真实浏览器） | e2e | P1-AC1, P1-AC2, P2-AC2 | `output/task-2d8d1cfa9b-20260411T125303/final-e2e-summary.json`, `.../final-e2e-ui-text.png` |

## Evaluator Independence

- Mode: blind-first-pass
- Validation surface: real-browser
- Required tools: playwright
- First-pass readable artifacts: prd.md, test-plan.md
- Withheld artifacts: execution-log.md, task-state.json
- Real environment expectation: 基于真实页面加载进行文案校验，不使用 mock。
- Escalation rule: 首轮先给出独立结果，必要时再对照执行日志。

## Pass / Fail Criteria

- Pass when:
  - T1/T2 全部通过
  - summary 报告 `finalResult=passed`
- Fail when:
  - 任一检查失败
  - 出现新的乱码或关键英文未替换

## Regression Scope

- 纪要录入页
- 历史信息弹框
- 追问弹框
- 汇总页三级管理与备份区
- 项目详情中的任务与留言文案

## Reporting Notes

- 测试结果写入 `test-report.md`。
