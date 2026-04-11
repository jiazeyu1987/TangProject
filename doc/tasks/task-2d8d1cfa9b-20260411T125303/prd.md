# PRD

- Task ID: `task-2d8d1cfa9b-20260411T125303`
- Created: `2026-04-11`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `修复前端上的乱码问题，将英文转换成中文`

## Goal

修复前端页面中所有用户可见的乱码文案，并把页面可见英文标签改为中文，保证页面显示一致、可读、可用。

## Scope

- `public/app.js`
- `public/index.html`
- 本任务产出的验证证据文件（`output/task-2d8d1cfa9b-20260411T125303/`）

## Non-Goals

- 不修改后端接口逻辑与数据结构。
- 不新增业务功能，仅修复文案与展示问题。
- 不做部署动作（仅本地验证）。

## Preconditions

- 本地 Node.js 与依赖可用（可运行 `npm run check`）。
- 本地可访问 `http://127.0.0.1:3000`。
- Playwright 运行环境可用（用于真实浏览器验证）。

若任一前置条件不满足，按 fail-fast 停止并记录。

## Impacted Areas

- 前端入口标题、Tab 区块眉题、追问按钮与追问弹框标题。
- 历史信息、项目详情、备份管理、任务动作等文案渲染逻辑。
- 纪要页/汇总页静态文本与 toast 提示文本。

## Phase Plan

### P1: 前端文案修复

- Objective: 消除 `public/app.js` 中乱码并统一中文文案，同时将 `public/index.html` 可见英文标签改为中文。
- Owned paths:
  - `public/app.js`
  - `public/index.html`
- Dependencies: 无新增依赖。
- Deliverables:
  - 乱码文案修复完成
  - 页面可见英文标签中文化

### P2: 验证与证据沉淀

- Objective: 通过静态检查与真实浏览器 E2E 确认修复有效。
- Owned paths:
  - `output/task-2d8d1cfa9b-20260411T125303/final-e2e-summary.json`
  - `output/task-2d8d1cfa9b-20260411T125303/final-e2e-ui-text.png`
- Dependencies: 本地服务可访问，Playwright 可运行。
- Deliverables:
  - 静态检查通过
  - E2E 结果为 passed
  - 证据文件落盘

## Phase Acceptance Criteria

### P1

- P1-AC1: `public/app.js` 中用户可见乱码文案被修复为中文可读文案（含历史信息、任务按钮、备份区、项目详情提示等）。
- P1-AC2: `public/index.html` 关键可见英文标签改为中文（入口眉题、追问按钮、追问弹窗标题、信号/台账/任务/汇总眉题等）。
- Evidence expectation:
  - 代码 diff 显示 `public/app.js`、`public/index.html` 文案变更。

### P2

- P2-AC1: `npm run check` 成功。
- P2-AC2: 真实浏览器 E2E 文案校验通过，`final-e2e-summary.json` 中 `finalResult = passed`。
- Evidence expectation:
  - 命令输出通过记录
  - `output/task-2d8d1cfa9b-20260411T125303/final-e2e-summary.json`
  - `output/task-2d8d1cfa9b-20260411T125303/final-e2e-ui-text.png`

## Done Definition

- P1、P2 全部标记 completed。
- P1-AC1、P1-AC2、P2-AC1、P2-AC2 均有证据支撑。
- `check_completion --apply` 通过。

## Blocking Conditions

- 本地服务不可访问且无法恢复。
- Playwright 运行失败且无法提供真实浏览器验证证据。
- `npm run check` 失败。
