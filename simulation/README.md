# Simulation Runtime

This directory contains the codex-driven daily UI simulation runtime.

## Run

```bash
npm run sim:month -- --scenario default-month
```

One-day real-model smoke run:

```bash
npm run sim:month -- --scenario day1-real-model
```

## Hard prerequisites

- Docker Desktop is installed and running.
- Chromium browser binary is installed for Playwright:

```bash
npx playwright install chromium
```

## Model provider mode

- `codex-session` (required):
  - Uses local Codex CLI session for per-step action decisions.
  - No `OPENAI_API_KEY` environment variable is required by the simulator.
  - `codex login` must be completed on the machine before running.
  - Any other provider value fails fast at scenario load time.

## Output layout

Each run writes to:

```text
output/simulations/<runId>/
  run-manifest.json
  events.jsonl
  final-report.md
  daily/
  snapshots/
  artifacts/screenshots/
  artifacts/traces/
  env/
```

## Notes

- Simulation mode is enabled in the app container with:
  - `SIMULATION_MODE=true`
  - `SIMULATION_CLOCK_FILE=/app/data/runtime/sim-clock.json`
- Role actions only use browser primitives and never mutate store data directly.
