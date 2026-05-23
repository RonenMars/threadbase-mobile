# Threadbase Mobile — Roadmap

Forward-looking work items. Each entry is a brief description; expand into a plan under `docs/superpowers/plans/` when picked up.

## Backlog

### CI / Quality

1. **GitHub Actions: Tests + E2E**
   Wire up CI on push/PR to run the Jest unit suite and the Maestro E2E mock suite (`npm run test:e2e:mock`). Includes booting an iOS simulator on the macOS runner, installing Maestro, building the app, and running `e2e/03_hub.yaml` + `e2e/04_session_detail.yaml`. Block merges on red.
