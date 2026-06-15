# CI/CD Evidence

## Environments And Deployment Targets
- Production: `root@47.116.122.8`, `/root/apps/tangproject`, service `tang-project`, public URL `http://47.116.122.8:3000`

## Build, Test, Lint, Package, Deploy, Rollback Commands
- `npm run check`
- `python C:\Users\BJB110\.codex\skills\clear-frontend-copy\scripts\scan_frontend_copy.py --root public --format markdown`
- `node scripts/verify-frontend-display-text.mjs --base-url http://127.0.0.1:3015 --account user-li-wei --password 123456 --output-dir output/playwright/fix-frontend-garbled-prod-20260615-local-green-v2`
- `node scripts/verify-frontend-display-text.mjs --base-url http://47.116.122.8:3000 --account user-li-wei --password 123456 --output-dir output/playwright/fix-frontend-garbled-prod-20260615-prod-green`
- Remote deploy: backup current frontend files, upload `public/index.html`, `public/app.js`, `public/styles.css`, `public/modules/ui-text-utils.js`, run `docker compose build --no-cache tang-project`, then `docker compose up -d --force-recreate tang-project`.
- Rollback: restore `.frontend-backup-20260615160306` for the uploaded frontend files and rerun `docker compose build` plus `up -d --force-recreate`.

## Pipeline Files Changed
- `scripts/verify-frontend-display-text.mjs`

## Required Secrets And Owners
- Production SSH password from project deployment documentation; owner: local operator/project.
- Production `OPENAI_API_KEY` must not be printed, changed, or recorded by this task.

## Artifact And Release Output
- Remote backup directory: `/root/apps/tangproject/.frontend-backup-20260615160306`
- Recreated production service: `tang-project`
- Production release artifact: updated frontend bundle with normalized display text

## RED Evidence
- Production Playwright audit failed before deploy and reported mojibake and leaked HTML fragments in visible text.

## GREEN Verification Evidence
- Production `/api/health` reports `configured: true` and `baseUrl: "http://39.106.23.28:8080"`.
- Local and production Playwright verification passed after the frontend fix.

## Manual Approvals And Blockers
- User requested production deployment after the frontend fix.
- No blockers remained after code sync and rebuild.

## Rollback Procedure And Validation
- Restore uploaded frontend files from `/root/apps/tangproject/.frontend-backup-20260615160306`.
- Rebuild and recreate `tang-project`.
- Validate `/api/health` and the frontend display-text audit again.
