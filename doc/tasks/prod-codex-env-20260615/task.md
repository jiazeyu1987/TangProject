# Production Codex Environment Update - 2026-06-15

## Goal
Update the production server Codex Responses configuration only:

- Target server: `root@47.116.122.8`
- Deploy directory: `/root/apps/tangproject`
- Service: `tang-project`
- `RESPONSES_BASE_URL` target: `http://39.106.23.28:8080`
- `OPENAI_API_KEY`: replace with the user-provided key without recording the secret value.

Testing server changes are intentionally out of scope for this first pass.

## Milestones
1. [x] Confirm production target and current runtime configuration.
2. [x] Back up production remote environment files.
3. [x] Replace production `RESPONSES_BASE_URL` and `OPENAI_API_KEY`.
4. [x] Recreate the production container so the environment changes take effect.
5. [x] Verify production `/api/health` reports the target base URL and configured Responses API.
6. [x] Run task closeout cleanup preview.

## Expected Verification
- Production SSH access succeeds.
- Remote `.env.example` exists before modification.
- Backup copies are created before modification.
- Running container reports `baseUrl: "http://39.106.23.28:8080"`.
- Running container reports `configured: true`.
- No secret value is written to task evidence.

## Status
Completed.

## Current Blockers
- None.

## Verification Evidence
- Production remote env backups created:
  - `/root/apps/tangproject/.env.example.bak-20260615152801`
  - `/root/apps/tangproject/.env.deploy.bak-20260615152801`
- Production container `tang-project` recreated with Docker Compose.
- Internal health check reports `configured: true`, `baseUrl: "http://39.106.23.28:8080"`, `model: "gpt-5.4"`.
- Public health check reports `configured: true`, `baseUrl: "http://39.106.23.28:8080"`, `model: "gpt-5.4"`.
- Container `OPENAI_API_KEY` hash matched the user-provided replacement key; secret value was not printed or recorded.
- CI/CD evidence validation passed.
- Task closeout cleanup preview passed with no blocked paths.

## Cleanup Keep
- `doc/tasks/prod-codex-env-20260615/ci-cd-evidence.md`
