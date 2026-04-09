# TangProject Agent Guide

## First Read
New Codex threads should read the following files before changing code or touching servers:

1. `doc/README.md`
2. `doc/code-structure.md`
3. `doc/server-info.md`

## Project Rules
- No fallback by default.
- Fail fast on missing prerequisites.
- Do not silently downgrade behavior, data source, model, API, or algorithm.
- If a fallback path is not explicitly required, ask before adding it.
- If fallback is explicitly requested, keep it minimal, clearly marked, and easy to remove later.
- Prefer removing implicit fallback branches during refactors unless they are required.

## Doc Tree
```text
doc/
  README.md
  code-structure.md
  server-info.md
```

## Project Snapshot
- Backend entry is `server.js`. It is a single-file Express service.
- Frontend static files live in `public/`.
- Runtime data and schemas live in `data/`.
- Deployment scripts live in `scripts/`, plus `测试服务器.bat` and `正式服务器.bat`.
- Server addresses, passwords, ports, deploy paths, and verification commands are documented in `doc/server-info.md`.
- If the task involves deployment, remote troubleshooting, or server access, read `doc/server-info.md` first.
