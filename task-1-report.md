# Task 1 report — Coolify plugin

## Status

- Branch: `codex/coolify-plugin`
- Version baseline commit: `fee9f18d1bc958b2b90cbab4476e0e95da0830a0` (pushed to public `main`)
- Round 3 implementation commit: `b858d57101a1e010e603330a9caa0b851e6f9825`
- Package bootstrap: `@jurislm/coolify-plugin@3.6.0`; published release: `@jurislm/coolify-plugin@3.7.1` (`v3.7.1`) after the `v3.7.0` verify failure (public, local-stdio runtime)
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
- Delivery assets: `skills/coolify/SKILL.md`, `.woodpecker/ci.yml`, `.woodpecker/release.yml`, `.woodpecker/release-pr-auto-merge.yml`, `.woodpecker/npm-release.yml`, and `scripts/ci/` release checks.
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
- Exact historical local evidence: `bun run check` exit 0 (26 tests, 62 assertions); `bun run build` exit 0; `bun pm pack --dry-run` exit 0 (34 files, including `api/manifest.json` and the snapshot); `git diff --check` exit 0; `bun scripts/check-openapi.ts` exit 0; `CI_COMMIT_TAG=v3.6.0 bun scripts/check-release-tag.ts` is the current bootstrap tag contract; `bun install --frozen-lockfile` exit 0.
- No live Coolify acceptance, NPM publish, remote CI run, or external readback was claimed or performed.

## Fix round 4

- Replaced the package-content checker’s NPM subprocess with the Bun-native `bun pm pack --dry-run` pipeline. It parses Bun `packed <size> <path>` output, checks required files, and rejects anything other than exactly one `api/manifest.json`. `package.json` invokes the same Bun command explicitly.
- Added narrow generated response compatibility for `/databases`, `/resources`, and application deployments. Known arrays and `data`/`deployments`/`items`/`results` wrappers pass operation-specific schemas; deployments normalize to arrays before `callTool` output validation.
- Restored v3.6 composite behavior: `Promise.allSettled` partial data/errors for overview, application/server diagnostics, and issue scans; safe environment summaries; reachability/usability/resource health checks; 200-line/50,000-character log bounds; deployment normalization; and `coolify_get_environment` database-type cross-reference using `database_type`/`type` and environment id/UUID/name fallbacks.
- Refreshed active unarchived OpenSpec contracts to the generated `coolify_*`/`registerTool`/Bun architecture. `openspec/changes/archive/` remained unchanged. README now states NPM release is allowed and remote MCP, OAuth, vault, hosting, and OpenAI Plugin Directory submission are out of scope.
- Exact round-4 evidence: `bun run check` exit 0 (35 tests, 83 assertions); `bun run build` exit 0; `bun pm pack --dry-run` exit 0 (34 files, including `api/manifest.json` and `openapi/coolify-openapi.json`); official plugin validator exit 0; `git diff --check` exit 0; `bun install --frozen-lockfile` exit 0; bootstrap release tag contract is `CI_COMMIT_TAG=v3.6.0`; offline OpenAPI verification exit 0.
- No live Coolify acceptance, GitHub CI run, NPM publish, or external readback was claimed or performed.

## Final readback

- Fresh `bun run check`: exit 0, 38 tests/89 assertions; official plugin validator: exit 0; GitHub readback: `jurislm/coolify-plugin` PUBLIC, release merge `edde68d122e67cc00470ba056862013b31aec10a`, package manifest `3.7.1`, tags `v3.7.0` and `v3.7.1`.
- Codex local marketplace install/readback: `coolify-plugin@jurislm-local`, bootstrap version `3.6.0`, installed manifest and `mcp.json` present in local cache.
- `npm pack --dry-run --json`: `@jurislm/coolify-plugin@3.6.0`, 36 files. NPM readback: latest `3.7.1`, tarball URL returned `200`, and tarball `package.json` is `3.7.1`. The earlier `v3.7.0` tag verify failed on the fixed `3.6.0` test expectation and did not publish; no `v0.1.0` tag was created.

## Release automation alignment

- Main push: `.woodpecker/release.yml` runs Release Please GitHub Release then Release PR; `.woodpecker/release-pr-auto-merge.yml` serializes and validates the Release PR before merge.
- Tag push: `.woodpecker/npm-release.yml` verifies `v<package.version>` and runs Bun-native pack before token-scoped public publish.
- `release-please-config.json` synchronizes `package.json`, `plugin.json`, and `.codex-plugin/plugin.json`; local release workflow tests are included in `bun run check`.

## Woodpecker readback

- `jurislm/coolify-plugin` is active and public as Woodpecker repo `23`.
- Secret metadata is configured without value readback: `npm_token` for `tag`, and `personal_access_tokens_fine_grained_tokens_jurislm` for `push`.
- Main pipeline `#23`, release-branch/PR checks `#21/#22`, and tag publish pipeline `#24` for `v3.7.1` succeeded.

## Legacy closeout

- `@jurislm/coolify-mcp@*` was deprecated through the npm web UI; registry readback returns the deprecation message for version `3.6.0`.
- `jurislm/coolify-mcp` is archived and public (`isArchived=true`); no alias package was created.

## Fix round 5

- Collection compatibility is now fail-closed and limited to `/databases`, `/resources`, `/deployments`, and `/deployments/applications/{uuid}`. Arrays and named array wrappers (`data`, `items`, `results`, `databases`, `resources`, `deployments`) normalize to arrays; null, strings, and unknown objects throw safe errors. Generated schemas are `z.array(z.unknown())` only for those normalized paths, and `src/server.ts` parses every generated response schema before emitting structured output.
- Added direct MCP regression coverage for database/resource arrays, deployment `{ count, deployments }`, null, string, and unknown-object responses. The fallback manifest now references `./.mcp.json` and still omits `apps`; package-content checks confirm `.mcp.json` and examples ship.
- Synchronized active response-optimization and OpenSpec contracts with the 200-line/50,000-character log bound and current generated `coolify_*`/`registerTool`/Bun architecture. All active non-archive references to the removed resolver/class, old paths, nonexistent integration command, and consolidated application contract are absent; archive diff remains empty.
- `check-openapi.ts` now verifies the official `manifest.sourceUrl` in addition to persisted SHA-256 and contract counts; regression coverage verifies a non-authoritative URL fails.
- Exact round-5 evidence: `bun run check` exit 0 (38 tests, 89 assertions); `bun run build` exit 0; `bun pm pack --dry-run` exit 0 (34 files, exactly one `api/manifest.json`); official plugin validator exit 0; `git diff --check` exit 0; `git diff --cached --check` exit 0; `bun install --frozen-lockfile` exit 0; bootstrap tag check is `CI_COMMIT_TAG=v3.6.0` and first automatic release target is `v3.7.0`.
- No live Coolify/provider request, GitHub CI readback, NPM publish, or external acceptance readback was performed or claimed.
