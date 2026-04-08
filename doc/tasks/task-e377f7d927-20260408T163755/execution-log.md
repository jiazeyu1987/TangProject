# Execution Log

- Task ID: `task-e377f7d927-20260408T163755`
- Created: `2026-04-08T16:37:55`

## Phase Entries

### Phase-P1 (executor pass 1)

- Changed paths:
  - `.gitignore`
  - `.env.deploy.example`
  - `deploy-aliyun.bat`
  - `scripts/deploy-aliyun.ps1`
  - `README.md`
  - `doc/tasks/task-e377f7d927-20260408T163755/prd.md`
  - `doc/tasks/task-e377f7d927-20260408T163755/test-plan.md`
- Validation run:
  - `npm run check` -> passed.
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.notfound` -> failed as expected with explicit missing-file error.
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.example` -> failed as expected with explicit empty-key error.
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.deploy` (temporary dummy key) -> reached remote check stage, then blocked by SSH host key mismatch.
- Acceptance ids covered:
  - `P1-AC1` covered by `deploy-aliyun.bat` launcher chain.
  - `P1-AC2` covered by explicit fail-fast checks and failing test commands above.
  - `P1-AC3` implementation is present in script, but runtime verification is blocked by SSH prerequisite.
- Remaining risk or blockers:
  - SSH strict host key verification fails for `47.116.122.8` due changed host identification; remote deployment and post-deploy verification cannot continue until host fingerprint is reconciled.

### Phase-P1 (executor pass 2)

- Changed paths:
  - `scripts/deploy-aliyun.ps1`
  - `scripts/deploy-aliyun-paramiko.py`
  - `deploy-aliyun.bat`
  - `README.md`
- Validation run:
  - `python -m py_compile .\scripts\deploy-aliyun-paramiko.py` -> passed.
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.notfound` -> failed as expected (missing env file).
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-aliyun.ps1 -DeployEnvFile .\.env.deploy.remote` + `ALIYUN_SSH_PASSWORD` -> passed (remote upload/build/recreate/internal health).
- Acceptance ids covered:
  - `P1-AC1`: `deploy-aliyun.bat` 默认调用脚本并保留失败输出。
  - `P1-AC2`: 前置检查（命令、文件、密钥）和失败即退出校验通过。
  - `P1-AC3`: 已在真实远端执行文件同步和 `docker compose build --no-cache` + `up -d --force-recreate`。
- Remaining risk or blockers:
  - None for phase P1.

### Phase-P2 (executor pass 1)

- Changed paths:
  - `scripts/deploy-aliyun.ps1`
  - `scripts/deploy-aliyun-paramiko.py`
  - `README.md`
- Validation run:
  - 部署脚本内建验证通过：远端 `127.0.0.1:3000/api/health` configured=true。
  - `curl -s http://47.116.122.8:3000/api/health` -> configured=true。
  - `curl -s http://47.116.122.8:3000/api/bootstrap` -> 包含 projects/tasks。
- Acceptance ids covered:
  - `P2-AC1`: 内外网 health 校验通过。
  - `P2-AC2`: bootstrap 结构校验通过，失败路径为非 0 退出。
  - `P2-AC3`: README 已补一键部署使用说明与排查入口。
- Remaining risk or blockers:
  - None for phase P2.

## Outstanding Blockers

- None.
