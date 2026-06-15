# CI/CD Evidence

## Environments And Targets
- Production: `root@47.116.122.8`, `/root/apps/tangproject`, service `tang-project`, public URL `http://47.116.122.8:3000`
- Testing: out of scope for this first pass.

## Required Secrets
- User-provided replacement `OPENAI_API_KEY`; owner: local operator.
- Secret value is intentionally not recorded in this evidence.

## Planned Commands
- Preflight production SSH access.
- Read production `/api/health` before modification.
- Back up remote `.env.example` and `.env.deploy` if present.
- Update remote environment files with target `RESPONSES_BASE_URL` and secret key.
- Recreate `tang-project` with Docker Compose.
- Verify internal and public `/api/health`.

## Pipeline Files Changed
- None planned.

## Artifact And Release Output
- Remote environment backup files:
  - `/root/apps/tangproject/.env.example.bak-20260615152801`
  - `/root/apps/tangproject/.env.deploy.bak-20260615152801`
- Recreated production Docker Compose service `tang-project`.

## Rollback
- Restore the timestamped remote env backup.
- Recreate `tang-project` with Docker Compose.
- Verify `/api/health` returns the previous expected base URL and `configured: true`.

## Manual Approvals And Blockers
- User explicitly requested production update first.
- No blockers at task start.

## Verification
- RED: production public `/api/health` initially reported `baseUrl: "https://api.asxs.top/v1"`, which did not match the requested target.
- GREEN: production internal `/api/health` reported `configured: true`, `baseUrl: "http://39.106.23.28:8080"`, `model: "gpt-5.4"`.
- GREEN: production public `/api/health` reported `configured: true`, `baseUrl: "http://39.106.23.28:8080"`, `model: "gpt-5.4"`.
- GREEN: container `RESPONSES_BASE_URL` matched the requested target.
- GREEN: container `OPENAI_API_KEY` SHA-256 hash matched the user-provided replacement key; the key was not printed or recorded.
