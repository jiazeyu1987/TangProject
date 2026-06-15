# Bug Regression Evidence

## Bug Summary
Frontend pages contain or render garbled text. User-facing frontend copy must render as readable simplified Chinese.

## Expected Behavior
All visible frontend copy in `public/` should be readable simplified Chinese, except approved technical terms such as `API`, `Token`, `URL`, and `ID`.

## Reproduction
1. Start local app on `http://127.0.0.1:3015`.
2. Open production `http://47.116.122.8:3000/` in Playwright.
3. Login with `user-li-wei / 123456`.
4. Observe mojibake fragments in the entry, ledger, and task views.

## Root Cause
- Production was still serving an older frontend bundle.
- The frontend text normalizer did not yet treat some corrupted UTF-8/GBK-style fragments as garbled.

## Regression Test
- `scripts/verify-frontend-display-text.mjs`
- Added direct normalization checks for representative mojibake samples through `UiTextUtils.normalizeDisplayText`.

## RED Evidence
- Production run failed before deploy and showed mojibake in visible page text.
- The updated verification script now fails on the old production bundle and passes on the fixed local bundle.

RED: `node scripts/verify-frontend-display-text.mjs --base-url http://47.116.122.8:3000 --account user-li-wei --password 123456 --output-dir output/playwright/fix-frontend-garbled-prod-20260615-red-v2` -> FAIL, production page showed mojibake and leaked HTML fragments.

## GREEN Evidence
- `npm run check`
- `python C:\Users\BJB110\.codex\skills\clear-frontend-copy\scripts\scan_frontend_copy.py --root public --format markdown`
- `node scripts/verify-frontend-display-text.mjs --base-url http://127.0.0.1:3015 --account user-li-wei --password 123456 --output-dir output/playwright/fix-frontend-garbled-prod-20260615-local-green-v2`
- `node scripts/verify-frontend-display-text.mjs --base-url http://47.116.122.8:3000 --account user-li-wei --password 123456 --output-dir output/playwright/fix-frontend-garbled-prod-20260615-prod-green`

GREEN: Local and production checks passed after updating frontend text normalization and deploying the rebuilt production container.

## Verification
- Production `/api/health` reports `configured: true` and `baseUrl: "http://39.106.23.28:8080"`.
- Production Playwright audit reports `ok: true`.

## Risk And Regression Scope
- Scope is frontend copy, display text normalization, and static UI rendering in `public/`.
- Production deployment preserved `RESPONSES_BASE_URL=http://39.106.23.28:8080`.

## Blockers And Follow-Up
- None at task start.
