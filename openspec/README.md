# OpenSpec Directory

This directory stores spec-driven artifacts for `@jurislm/coolify-plugin`.

`api/manifest.json` and the persisted snapshot under `openapi/` are the API-contract source of truth for generation. Runtime code lives in `src/`; generated operations are registered with MCP `registerTool`; composite behavior lives in `src/capabilities.ts`.

Tests are colocated as `src/*.test.ts` and `scripts/*.test.ts` and run with Bun. The package exposes local stdio only and accepts the canonical `COOLIFY_BASE_URL` and `COOLIFY_ACCESS_TOKEN` environment variables.

`specs/` contains active requirements. `changes/archive/` contains historical records and is intentionally preserved unchanged.
