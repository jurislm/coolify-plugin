# Task 1 report — Coolify plugin

## Status

- Branch: `codex/coolify-plugin`
- Implementation commit: `8859c577152799c1f0d90739596fc6b072bad792`
- Round 3 implementation commit: `b858d57101a1e010e603330a9caa0b851e6f9825`
- Package: `@jurislm/coolify-plugin@0.1.0` (publicly publishable, local-stdio runtime)
- Authoritative snapshot: `https://raw.githubusercontent.com/coollabsio/coolify/main/openapi.json`
- Snapshot SHA-256: `4dbb392aac5e0a46186c4e6e5237f86d9534bb99bf6b8b82351a513598af3900`
- Contract: OpenAPI document version 3.1.0, info version 0.1, 192 paths, 275 operations

This report is inside the target repository because the later instruction prohibited writes outside it. The originally requested external report path was therefore not modified.

## Changed files

- Package and local distribution: `package.json`, `bun.lock`, `README.md`, `LICENSE`, `plugin.json`, `mcp.json`, `.mcp.json`, `.codex-plugin/plugin.json`, `.mcp.json.example`, `.app.json.example`.
- Plugin behavior: `src/config.ts`, `src/client.ts`, `src/errors.ts`, `src/capabilities.ts`, `src/server.ts`, `src/stream.ts`, `src/transports/stdio.ts`, `src/index.ts`.
- Generated API contract: `openapi/coolify-openapi.json`, `api/manifest.json`, `src/generated/coolify-api.ts`, `src/generated/coolify-zod.ts`, `src/generated/operations.ts`.
- Reproducibility and validation: `scripts/update-openapi.ts`, `scripts/generate-openapi.ts`, `scripts/check-openapi.ts`, `scripts/validate-plugin-manifests.ts`, `scripts/package-contents-check.ts`, `scripts/check-release-tag.ts`.
- Tests: config, client/redaction, generated contract, collection-response compatibility, MCP metadata/annotations/ToolEnvelope, v3.6 wrapper partial results and environment cross-reference, package-path parsing, release tag, stream parsing, stdio transport, and actual stdio protocol.
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
- `bun test`: 23 passed, 0 failed, 56 assertions.
- `bun run api:check`: generated artifacts reproducible with no diff.
- `bun run manifest:check` and the Codex plugin validator: passed.
- `bun run build`: passed.
- `bun pm pack --dry-run`: passed through `bun run package:check`; package contains the compiled server, both local-stdio registrations, fallback manifest, skill, README, and LICENSE.
- The stdio protocol test builds the package, parses `mcp.json`, launches its declared `bun dist/index.js` command with test-only canonical credentials, and lists `coolify_list_applications` through the MCP SDK.

## Fix round 1

- Successful JSON responses now recursively redact environment values, private keys, tokens, secrets, passwords, authorization data, and cookies before both `structuredContent` and text serialization. Regression tests cover nested values, the MCP output boundary, timeout `AbortSignal`, and one-call/no-retry mutation behavior.
- Restored v3.6 composite capabilities as focused `coolify_*` wrappers: plugin version, infrastructure overview, application/server diagnostics, issue scan, project restart/redeploy, bulk application-env update, emergency stop-all, and Docker network alias remediation. Direct legacy API capabilities remain covered by the focused generated operations.
- `api/manifest.json` now records `openapiVersion` and `infoVersion` separately, and `api:check` verifies the persisted snapshot SHA-256 offline before generated parity.
- Root `plugin.json` is the Agent Plugins 1.0 portable manifest with its canonical `$schema` and `extensions.com.openai.interface`; root `mcp.json` uses the matching Agent Plugins MCP schema and local stdio configuration. `.codex-plugin/plugin.json` remains fallback metadata only.
- Removed `private: true`; the package and requested examples are included in the dry-run tarball. `.mcp.json.example` is secret-free.
- Fix-round checks: `bun run api:check`, `bun run manifest:check`, `bun run build`, `bun test`, `bun run check`, `bun pm pack --dry-run`, and `git diff --check` all exited 0.

## Fix round 2

- The portable and fallback stdio registrations now use `cwd: "./"`; both the manifest validator and shipped-dist protocol test assert it.
- Every capability-internal generated operation now parses its generated input schema before fetch. The bulk env wrapper is strict, accepts only `app_uuids`, `key`, and `value`, and sends only `{ "key", "value" }` to `PATCH /applications/{uuid}/envs`.
- Project redeploy now passes the generated `uuid` query key to `POST /deploy` instead of the unsupported `uuid_or_tag` key.
- Mocked MCP/fetch tests now exercise every restored wrapper: version, diagnostics, issue scan, restart, bulk env update, stop-all confirmation, redeploy, and Docker network alias remediation. They assert the generated method/path/body contracts rather than only checking tool registration.
- Fix-round checks: `bun run api:check`, `bun run manifest:check`, `bun run build`, `bun test`, `bun run check`, `bun pm pack --dry-run`, and `git diff --check` all exited 0; `bun test` reported 23 passing tests and 56 assertions.

## Unresolved concerns

- No live Coolify instance credentials were supplied, so no real API mutation was attempted. The official contract, generated tool catalog, fetch behavior, redaction behavior, package contents, and local stdio protocol were verified without contacting a configured Coolify instance.
- The official OpenAPI snapshot includes provider API operations that may accept provider-owned OAuth fields; the plugin adds no OAuth transport or flow. Its only MCP transport is local stdio.

## Fix round 3

- Moved the canonical manifest to `api/manifest.json`; `openapi/coolify-openapi.json` remains the only persisted snapshot, and the old `openapi/manifest.json` path is rejected as a conflict.
- Added offline persisted-snapshot SHA-256 verification plus independent OpenAPI document/info version, path-count, and operation-count checks before generated parity. `api:check` now includes `api/manifest.json`, `openapi`, and `src/generated` in its diff gate.
- Completed Woodpecker CI and tag release verification with Alpine Git installation, `CI_COMMIT_TAG=v<package.version>` assertion, `NPM_TOKEN` mapping from `npm_token`, temporary NPM auth config cleanup, and `bun publish --access public`. `publishConfig.access` is public; no publish was executed in this local verification.
- Refreshed active OpenSpec context and unarchived docs to the current package, Bun tests, generated artifacts, `registerTool`, and local stdio architecture. `openspec/changes/archive/` was not modified. Removed unused `jest.config.js` and refreshed the lockfile package name.
- Exact local evidence: `bun run check` exit 0 (26 tests, 62 assertions); `bun run build` exit 0; `bun pm pack --dry-run` exit 0 (34 files, including `api/manifest.json` and the snapshot); `git diff --check` exit 0; `bun scripts/check-openapi.ts` exit 0; `CI_COMMIT_TAG=v0.1.0 bun scripts/check-release-tag.ts` exit 0; `bun install --frozen-lockfile` exit 0.
- No live Coolify acceptance, NPM publish, remote CI run, or external readback was claimed or performed.

## Fix round 4

- Replaced the package-content checker’s NPM subprocess with the Bun-native `bun pm pack --dry-run` pipeline. It parses Bun `packed <size> <path>` output, checks required files, and rejects anything other than exactly one `api/manifest.json`. `package.json` invokes the same Bun command explicitly.
- Added narrow generated response compatibility for `/databases`, `/resources`, and application deployments. Known arrays and `data`/`deployments`/`items`/`results` wrappers pass operation-specific schemas; deployments normalize to arrays before `callTool` output validation.
- Restored v3.6 composite behavior: `Promise.allSettled` partial data/errors for overview, application/server diagnostics, and issue scans; safe environment summaries; reachability/usability/resource health checks; 200-line/50,000-character log bounds; deployment normalization; and `coolify_get_environment` database-type cross-reference using `database_type`/`type` and environment id/UUID/name fallbacks.
- Refreshed active unarchived OpenSpec contracts to the generated `coolify_*`/`registerTool`/Bun architecture. `openspec/changes/archive/` remained unchanged. README now states NPM release is allowed and remote MCP, OAuth, vault, hosting, and OpenAI Plugin Directory submission are out of scope.
- Exact round-4 evidence: `bun run check` exit 0 (35 tests, 83 assertions); `bun run build` exit 0; `bun pm pack --dry-run` exit 0 (34 files, including `api/manifest.json` and `openapi/coolify-openapi.json`); official plugin validator exit 0; `git diff --check` exit 0; `bun install --frozen-lockfile` exit 0; release tag check exit 0 for `CI_COMMIT_TAG=v0.1.0`; offline OpenAPI verification exit 0.
- No live Coolify acceptance, GitHub CI run, NPM publish, or external readback was claimed or performed.
