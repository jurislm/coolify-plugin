# Repository Guidance

## Scope
- This repository ships a local stdio Coolify MCP server for Codex and Cursor. Keep that transport and packaging scope intact.

## Source and architecture
- `openapi/coolify-openapi.json` is the checked-in Coolify v4.3.23 contract snapshot. `api/manifest.json` records its official source, hashes, and corrections.
- `scripts/generate-openapi.ts` generates `src/generated/`. Change the contract inputs or generator, then run `bun run api:generate`; do not hand-edit generated outputs.
- `src/server.ts` registers generated API operations; `src/capabilities.ts` owns explicit composite tools.
- `src/config.ts` selects configuration values. Keep each URL/token pair from one source and preserve secret redaction in `src/client.ts`.

## Packaging
- Portable plugin files live at the repository root. Cursor-specific files live under `plugins/cursor/`.
- Keep `plugins/cursor/skills/coolify/SKILL.md` in sync with `skills/coolify/SKILL.md`.

## Verification
- Run `bun run check` after source, API contract, or plugin manifest changes.
- Do not add comments to source code.
