# Test Plan Template

- Task ID: `task-e377f7d927-20260408T163755`
- Created: `2026-04-08T16:37:55`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `写一个工具,双击可以快速将当前的前后端代码部署到阿里云服务器,并验证`

## Test Scope

验证双击部署工具在真实仓库中的可执行性、失败前置检查、远端发布流程与部署后健康检查。
不覆盖业务功能回归测试（例如 intake 结构化提取内容质量）。

## Environment

- OS: Windows PowerShell 5+。
- Workspace: `D:\ProjectPackage\TangProject`。
- Local tools: `powershell`、`ssh`、`scp`、`npm`。
- Remote host: `47.116.122.8`，部署目录 `/root/apps/tangproject`。
- Deploy env file: `D:\ProjectPackage\TangProject\.env.deploy`（含非空 `OPENAI_API_KEY`）。

## Accounts and Fixtures

- SSH 账号：`root@47.116.122.8`（key 或密码）。
- 远端账号需具备部署目录写权限和 Docker 执行权限。
- 如缺失账号或权限，测试必须标记 `blocked` 并记录缺失前提。

If any required item is missing, the tester must fail fast and record the missing prerequisite.

## Commands

1. `npm run check`
   - 期望：退出码 0。
2. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.notfound`
   - 期望：退出非 0，错误明确指出缺少部署环境文件。
3. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.deploy`
   - 期望：完成同步、远端 compose 重建启动、健康检查断言通过，退出码 0。
4. `curl -s http://47.116.122.8:3000/api/health`
   - 期望：JSON 中 `configured` 为 `true`。
5. `curl -s http://47.116.122.8:3000/api/bootstrap`
   - 期望：JSON 含 `projects` 与 `tasks` 数组。

## Test Cases

Use stable test case ids. Every acceptance id from the PRD should appear in at least one `Covers` field.

### T1: 本地静态检查可通过

- Covers: P1-AC2
- Level: integration
- Command: `npm run check`
- Expected: 返回 0 且 `server.js`、`public/app.js` 语法检查通过。

### T2: 缺少部署环境文件时快速失败

- Covers: P1-AC2
- Level: integration
- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.notfound`
- Expected: 返回非 0，报错包含缺失文件路径。

### T3: 双击入口与执行链路存在

- Covers: P1-AC1
- Level: manual
- Command: 双击 `deploy-aliyun.bat`（或检查其调用命令）
- Expected: 能调用 `scripts/deploy-aliyun.ps1`，失败时窗口保留输出，成功时展示完成提示。

### T4: 真实部署与远端容器重建

- Covers: P1-AC3
- Level: e2e
- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.deploy`
- Expected: 执行包含文件同步、远端 `docker compose build --no-cache`、`docker compose up -d --force-recreate`。

### T5: 部署后健康检查断言

- Covers: P2-AC1, P2-AC2
- Level: e2e
- Command: `curl -s http://47.116.122.8:3000/api/health` and `curl -s http://47.116.122.8:3000/api/bootstrap`
- Expected: health 返回 `configured=true`，bootstrap 返回 `projects` 和 `tasks` 数组且可解析。

### T6: 文档可用性检查

- Covers: P2-AC3
- Level: manual
- Command: 审阅 `README.md` 新增的一键部署章节
- Expected: 包含准备项、双击入口、失败排查说明。

## Coverage Matrix

| Case ID | Area | Scenario | Level | Acceptance IDs | Evidence |
| --- | --- | --- | --- | --- | --- |
| T1 | local checks | 语法检查 | integration | P1-AC2 | command output |
| T2 | fail-fast | 缺少 env 文件 | integration | P1-AC2 | command output |
| T3 | launcher | 双击入口链路 | manual | P1-AC1 | launcher script content + manual note |
| T4 | deploy pipeline | 远端重建启动 | e2e | P1-AC3 | deployment log |
| T5 | post-deploy verify | health/bootstrap 校验 | e2e | P2-AC1, P2-AC2 | API response logs |
| T6 | docs | README 指引完整性 | manual | P2-AC3 | file diff/review note |

## Evaluator Independence

- Mode: blind-first-pass
- Validation surface: real-runtime
- Required tools: powershell, ssh, scp, curl
- First-pass readable artifacts: prd.md, test-plan.md
- Withheld artifacts: execution-log.md, task-state.json
- Real environment expectation: Run against the real repo and runtime. If a UI or interaction path is in scope, use a real browser or session and record concrete evidence.
- Escalation rule: Do not inspect withheld artifacts until the tester has written an initial verdict or the main agent explicitly asks for discrepancy analysis.

## Pass / Fail Criteria

- Pass when:
  - T1/T2/T3/T6 通过；
  - 若具备 SSH 与部署凭据，T4/T5 通过；
  - 全部 acceptance id 有证据。
- Fail when:
  - 任一对应 acceptance id 的测试失败；
  - 发生静默降级、跳过关键校验或无明确失败原因。
- Blocked when:
  - 服务器访问权限、远端 Docker 能力或部署环境变量不可用。

## Regression Scope

- `README.md` 其他“本地运行”说明未被破坏。
- `docker-compose.yml`、`Dockerfile` 未因本次工具开发产生行为变更。
- 业务接口 `/api/health`、`/api/bootstrap` 响应结构未被修改。

## Reporting Notes

Write results to `test-report.md`.

The tester must remain independent from the executor and should prefer blind-first-pass unless the task explicitly needs full-context evaluation.
