# Test Report

- Task ID: `task-e377f7d927-20260408T163755`
- Created: `2026-04-08T16:37:55`
- Workspace: `D:\ProjectPackage\TangProject`
- User Request: `写一个工具,双击可以快速将当前的前后端代码部署到阿里云服务器,并验证`

## Environment Used

- Evaluation mode: blind-first-pass
- Validation surface: real-runtime
- Tools: powershell, ssh, scp, curl, npm
- Initial readable artifacts: prd.md, test-plan.md
- Initial withheld artifacts: execution-log.md, task-state.json
- Initial verdict before withheld inspection: yes

Record the tester's first-pass visibility honestly. In `blind-first-pass`, the tester should record `yes` only after writing an initial verdict before inspecting withheld artifacts.

## Results

Add one subsection per executed test case using the test case ids from `test-plan.md`.

Each subsection should use this shape:

`### T1: concise title`

- `Result: passed|failed|blocked|not_run`
- `Covers: P1-AC1`
- `Command run: exact command or manual action`
- `Environment proof: runtime, URL, browser session, fixture, or deployment proof`
- `Evidence refs: screenshot, video, trace, HAR, or log refs`
- `Notes: concise findings`

For `real-browser` validation, include at least one evidence ref that resolves to an existing non-task-artifact file, such as `evidence/home.png`, `evidence/trace.zip`, or `evidence/session.har`.

### T1: 本地静态检查可通过

- Result: passed
- Covers: P1-AC2
- Command run: npm run check
- Environment proof: Windows PowerShell, workspace D:\ProjectPackage\TangProject
- Evidence refs: terminal output (npm run check, 2026-04-08)
- Notes: server.js 和 public/app.js 语法检查通过。

### T2: 缺少部署环境文件时快速失败

- Result: passed
- Covers: P1-AC2
- Command run: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.notfound
- Environment proof: Windows PowerShell
- Evidence refs: terminal output (missing deploy env file error, 2026-04-08)
- Notes: 脚本按预期快速失败并输出缺失文件路径。

### T3: 双击入口与执行链路存在

- Result: passed
- Covers: P1-AC1
- Command run: 审阅 deploy-aliyun.bat
- Environment proof: launcher file in repo root
- Evidence refs: deploy-aliyun.bat
- Notes: bat 会调用 scripts/deploy-aliyun.ps1，并在失败时 pause 保留输出。

### T4: 真实部署与远端容器重建

- Result: passed
- Covers: P1-AC3
- Command run: set `ALIYUN_SSH_PASSWORD` then run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.deploy.remote`
- Environment proof: Windows PowerShell + real Aliyun host root@47.116.122.8
- Evidence refs: terminal output (remote upload + docker compose build --no-cache + up -d --force-recreate, 2026-04-08)
- Notes: 部署链路完整执行，容器成功重建并运行。

### T5: 部署后健康检查断言

- Result: passed
- Covers: P2-AC1, P2-AC2
- Command run: curl -s http://47.116.122.8:3000/api/health and curl -s http://47.116.122.8:3000/api/bootstrap
- Environment proof: public endpoint is reachable
- Evidence refs: terminal output (health/bootstrap responses, 2026-04-08)
- Notes: health 返回 configured=true，bootstrap 返回 projects/tasks 数组。

### T6: 文档可用性检查

- Result: passed
- Covers: P2-AC3
- Command run: 审阅 README.md 新增“一键部署到阿里云（双击）”章节
- Environment proof: repo local file review
- Evidence refs: README.md
- Notes: 已包含准备项、双击入口与失败排查说明。

## Final Verdict

- Outcome: passed
- Verified acceptance ids: P1-AC1, P1-AC2, P1-AC3, P2-AC1, P2-AC2, P2-AC3
- Blocking prerequisites:
- Summary: 双击部署工具已完成，真实阿里云部署与内外网接口校验均通过。

## Open Issues

- None.
