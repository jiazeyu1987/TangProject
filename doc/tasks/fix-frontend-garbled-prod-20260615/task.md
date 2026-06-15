# Fix Frontend Garbled Text And Deploy Production - 2026-06-15

## Goal
Fix frontend garbled text in `public/`, verify the user-facing UI renders readable simplified Chinese, and publish the verified frontend to the production server `47.116.122.8`.

## Milestones
1. [x] Scan frontend text sources and reproduce the garbled-text failure.
2. [x] Add or update a regression verification that fails before the fix.
3. [x] Fix garbled frontend copy without changing unrelated behavior.
4. [x] Run targeted local verification and browser/UI verification.
5. [x] Deploy the verified change to production without overwriting production Responses configuration.
6. [x] Verify production health and frontend text after deployment.
7. [x] Run task closeout cleanup preview.

## Expected Verification
- Frontend copy scan reports no unresolved `garbled_text` findings in `public/`.
- Regression verification fails before the fix and passes after the fix.
- `npm run check` passes.
- Playwright/browser verification confirms the production page exposes readable Chinese text and no mojibake signatures.
- Production `/api/health` remains `configured: true` and keeps `baseUrl: "http://39.106.23.28:8080"`.

## Status
Completed.

## Current Blockers
- None.

## Verification Evidence
- Frontend copy scan on `public/` reported `garbled_text: 0`.
- Regression verification now checks representative mojibake samples through `UiTextUtils.normalizeDisplayText`.
- Local Playwright verification passed at `http://127.0.0.1:3015`.
- Production deployment recreated `tang-project` on `47.116.122.8`.
- Production backup directory created: `/root/apps/tangproject/.frontend-backup-20260615160306`.
- Production health reports `configured: true` and `baseUrl: "http://39.106.23.28:8080"`.
- Production Playwright verification passed.
- Bug regression evidence validation passed.
- CI/CD evidence validation passed.
- Task closeout cleanup preview passed with no delete, blocked, or warning entries.

## Cleanup Keep
- `doc/tasks/fix-frontend-garbled-prod-20260615/bug-regression-evidence.md`
- `doc/tasks/fix-frontend-garbled-prod-20260615/ci-cd-evidence.md`
