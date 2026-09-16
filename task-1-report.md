# Task 1 report — Coolify plugin

## Status

- Branch: `codex/coolify-plugin`
- Implementation commit: `8859c577152799c1f0d90739596fc6b072bad792`
- Package: `@jurislm/coolify-plugin@0.1.0` (publicly publishable, local-stdio runtime)
- Authoritative snapshot: `https://raw.githubusercontent.com/coollabsio/coolify/main/openapi.json`
- Snapshot SHA-256: `4dbb392aac5e0a46186c4e6e5237f86d9534bb99bf6b8b82351a513598af3900`
- Contract: OpenAPI document version 3.1.0, info version 0.1, 192 paths, 275 operations

This report is inside the target repository because the later instruction prohibited writes outside it. The originally requested external report path was therefore not modified.

## Changed files

- Package and local distribution: `package.json`, `bun.lock`, `README.md`, `LICENSE`, `plugin.json`, `mcp.json`, `.mcp.json`, `.codex-plugin/plugin.json`, `.mcp.json.example`, `.app.json.example`.
- Plugin behavior: `src/config.ts`, `src/client.ts`, `src/errors.ts`, `src/capabilities.ts`, `src/server.ts`, `src/stream.ts`, `src/transports/stdio.ts`, `src/index.ts`.
- Generated API contract: `openapi/coolify-openapi.json`, `openapi/manifest.json`, `src/generated/coolify-api.ts`, `src/generated/coolify-zod.ts`, `src/generated/operations.ts`.
- Reproducibility and validation: `scripts/update-openapi.ts`, `scripts/generate-openapi.ts`, `scripts/validate-plugin-manifests.ts`, `scripts/package-contents-check.ts`.
- Tests: config, client/redaction, generated contract, MCP metadata/annotations/ToolEnvelope, stream parsing, stdio transport, and actual stdio protocol.
- Delivery assets: `skills/coolify/SKILL.md`, `.woodpecker/ci.yml`, `.woodpecker/release.yml`.
- Removed: legacy consolidated MCP/client/types/tests, old local OpenAPI documentation, Docker/public NPM/release configuration, GitHub Actions release pipeline, and orphaned Husky lint-staged hook.

## Commands and exit codes

| Command | Exit |
| --- | ---: |
| `bun install --frozen-lockfile` (initial legacy baseline) | 0 |
| `bun test` (before install) | 1 — missing legacy dependencies |
| `bun test src/config.test.ts` (TDD red) | 1 |
| `bun test src/config.test.ts` (green) | 0 |
| `bun test src/client.test.ts` (TDD red) | 1 |
| `bun test src/client.test.ts` (green) | 0 |
| `bun test src/server.test.ts` (TDD red) | 1 |
| `bun test src/server.test.ts` (green) | 0 |
| `bun run api:fetch` | 0 |
| `bun run api:generate` | 0 |
| `bun run api:check` | 0 |
| `bun run manifest:check` | 0 |
| `python3 .../validate_plugin.py <target>` | 0 |
| `bun run check` | 0 |
| `git diff --check` | 0 |

## Final verification

- `bun run check`: exit 0.
- `bun test`: 14 passed, 0 failed, 40 assertions.
- `bun run api:check`: generated artifacts reproducible with no diff.
- `bun run manifest:check` and the Codex plugin validator: passed.
- `bun run build`: passed.
- `npm pack --dry-run --json`: passed through `bun run package:check`; package contains the compiled server, both local-stdio registrations, fallback manifest, skill, README, and LICENSE.
- The stdio protocol test builds the package, parses `mcp.json`, launches its declared `bun dist/index.js` command with test-only canonical credentials, and lists `coolify_list_applications` through the MCP SDK.

## Fix round 1

- Successful JSON responses now recursively redact environment values, private keys, tokens, secrets, passwords, authorization data, and cookies before both `structuredContent` and text serialization. Regression tests cover nested values, the MCP output boundary, timeout `AbortSignal`, and one-call/no-retry mutation behavior.
- Restored v3.6 composite capabilities as focused `coolify_*` wrappers: plugin version, infrastructure overview, application/server diagnostics, issue scan, project restart/redeploy, bulk application-env update, emergency stop-all, and Docker network alias remediation. Direct legacy API capabilities remain covered by the focused generated operations.
- `openapi/manifest.json` now records `openapiVersion` and `infoVersion` separately and tests both values.
- Root `plugin.json` is the Agent Plugins 1.0 portable manifest with its canonical `$schema` and `extensions.com.openai.interface`; root `mcp.json` uses the matching Agent Plugins MCP schema and local stdio configuration. `.codex-plugin/plugin.json` remains fallback metadata only.
- Removed `private: true`; the package and requested examples are included in the dry-run tarball. `.mcp.json.example` is secret-free.
- Fix-round checks: `bun run api:check`, `bun run manifest:check`, `bun run build`, `bun test`, `bun run check`, `npm pack --dry-run`, and `git diff --check` all exited 0.

## Unresolved concerns

- No live Coolify instance credentials were supplied, so no real API mutation was attempted. The official contract, generated tool catalog, fetch behavior, redaction behavior, package contents, and local stdio protocol were verified without contacting a configured Coolify instance.
- The official OpenAPI snapshot includes provider API operations that may accept provider-owned OAuth fields; the plugin adds no OAuth transport or flow. Its only MCP transport is local stdio.
