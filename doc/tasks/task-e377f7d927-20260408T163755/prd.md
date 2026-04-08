# PRD Template

- Task ID: `task-e377f7d927-20260408T163755`
- Created: `2026-04-08T16:37:55`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `写一个工具,双击可以快速将当前的前后端代码部署到阿里云服务器,并验证`

## Goal

提供一个 Windows 下可双击运行的部署工具，将当前仓库前后端代码发布到阿里云服务器 `47.116.122.8` 的 `/root/apps/tangproject`，并在发布后自动执行健康检查验证。

## Scope

- 新增双击入口脚本（`.bat`）。
- 新增部署执行脚本（PowerShell）。
- 脚本内实现本地前置检查、文件同步、远端 `docker compose` 重建与启动、部署后接口验证。
- 更新 README，补充“一键部署工具”使用方式和失败排查入口。

## Non-Goals

- 不修改业务 API 逻辑（`server.js`）和前端交互（`public/*`）。
- 不引入 CI/CD 平台（GitHub Actions/Jenkins）自动化。
- 不新增回退或兼容分支（严格失败并报错）。
- 不托管或生成线上密钥，仅读取本地提供的部署环境文件。

## Preconditions

- 本地 Windows 可执行 `powershell`、`ssh`、`scp`、`npm`。
- 本地已安装 Node 依赖，可执行 `npm run check`。
- 本地存在部署环境文件（含非空 `OPENAI_API_KEY`）。
- 服务器 `47.116.122.8` 可通过 SSH 访问，并具有 `/root/apps/tangproject` 写权限。
- 远端已安装 `docker` 与 `docker compose`（插件或独立命令）。
- 远端端口策略允许访问 `3000`（用于外网健康检查）。

If any item is missing, stop and record it in `task-state.json.blocking_prereqs`.

## Impacted Areas

- `deploy-aliyun.bat`（新增）：双击入口。
- `scripts/deploy-aliyun.ps1`（新增）：核心部署与验证逻辑。
- `README.md`：新增部署工具说明。
- `ALIYUN_DOCKER_NODE_CODEX_RUNBOOK.md`：作为部署参数与目标目录的依据。
- 依赖运行命令：`npm run check`、`docker compose build/up/ps`、`curl /api/health`。

## Phase Plan

Use stable phase ids. Do not renumber ids after execution has started.

### P1: 实现双击部署工具

- Objective: 提供一个可双击触发、可重复执行、失败即退出的一键部署入口与执行脚本。
- Owned paths:
  - `deploy-aliyun.bat`
  - `scripts/deploy-aliyun.ps1`
- Dependencies:
  - `.env.deploy`（部署环境文件）
  - `ssh` / `scp`
  - `docker compose`（远端）
- Deliverables:
  - 双击可启动部署流程
  - 本地和远端前置检查
  - 文件同步 + 远端重建启动

### P2: 部署后验证与文档落地

- Objective: 在脚本中内建部署后验证，并补齐用户可执行文档。
- Owned paths:
  - `scripts/deploy-aliyun.ps1`
  - `README.md`
- Dependencies:
  - 可访问的 `http://47.116.122.8:3000`
  - 服务提供 `/api/health`、`/api/bootstrap`
- Deliverables:
  - 健康检查断言（`configured=true` 且返回结构符合预期）
  - 错误信息清晰可定位
  - README 包含一键部署步骤与必要前提

## Phase Acceptance Criteria

List criteria under the matching phase id. Every criterion must use a stable acceptance id.

### P1

- P1-AC1: 存在可双击入口 `deploy-aliyun.bat`，会调用 `scripts/deploy-aliyun.ps1` 并在失败时保留窗口输出。
- P1-AC2: PowerShell 脚本在执行部署前完成前置检查：命令可用性、关键文件存在、部署环境变量文件存在且 `OPENAI_API_KEY` 非空；任一不满足立即退出并输出明确原因。
- P1-AC3: 脚本会同步指定文件到服务器并执行远端 `docker compose build --no-cache` 与 `docker compose up -d --force-recreate`。
- Evidence expectation: 代码路径与命令输出记录在 `execution-log.md#Phase-P1`。

### P2

- P2-AC1: 脚本完成部署后验证远端 `http://127.0.0.1:3000/api/health` 与 `http://47.116.122.8:3000/api/health`，并断言 `configured=true`。
- P2-AC2: 脚本验证 `GET /api/bootstrap` 可返回项目与任务数组，任一验证失败即退出非 0。
- P2-AC3: README 增加“一键部署”说明，包含准备项、双击入口、失败排查入口。
- Evidence expectation: 验证命令与结果记录在 `execution-log.md#Phase-P2` 与 `test-report.md`。

## Done Definition

- P1、P2 均为 `completed`。
- `P1-AC1` ~ `P2-AC3` 全部有对应执行证据。
- 测试报告包含独立验证结论，`test_status=passed`。
- `check_completion.py --apply` 通过。

## Blocking Conditions

- 本地无法执行 `ssh/scp/npm/powershell`。
- 缺少部署环境文件，或其中 `OPENAI_API_KEY` 为空。
- 无法 SSH 登录目标服务器。
- 远端缺少 `docker` 或 `docker compose`。
- 部署后 `api/health` 或 `api/bootstrap` 校验失败。
- 任一阻塞条件触发后必须停止，不允许 fallback、mock、静默降级。
