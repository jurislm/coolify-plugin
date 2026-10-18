---
title: Tool Registry Specification
version: 2.1.0
date: 2026-09-23
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define the MCP surface produced by `@jurislm/coolify-plugin`: generated `coolify_*` tools from the pinned OpenAPI contract plus explicit composite tools.

## Requirements

### Requirement: Generated operations are registered as focused tools

When `src/server.ts` creates an MCP server, it SHALL call `registerTool` once for every operation in `src/generated/operations.ts`. Every generated name SHALL start with `coolify_`, and the catalog SHALL match `api/manifest.json`.

#### Scenario: Register the generated contract

- **WHEN** a client calls `tools/list`
- **THEN** every generated operation is present with its generated input/output schema and HTTP annotations

### Requirement: Composite capabilities remain explicit

The server SHALL additionally register `coolify_get_mcp_version`, `coolify_get_infrastructure_overview`, `coolify_get_environment`, `coolify_diagnose_application`, `coolify_diagnose_server`, `coolify_find_issues`, `coolify_restart_project_applications`, `coolify_bulk_update_application_env`, `coolify_stop_all_applications`, `coolify_redeploy_project_applications`, and `coolify_docker_network_alias` from `src/capabilities.ts`.

#### Scenario: Register wrapper capabilities

- **WHEN** a client calls `tools/list`
- **THEN** all explicit wrapper names are present in addition to generated operations

### Requirement: Successful and failed calls have safe structured output

Every successful handler SHALL return a `ToolEnvelope`-shaped `structuredContent` and matching serialized text. Fields whose names mark credentials (private keys, tokens, secrets, passwords, authorization, cookies, API keys, webhook URLs) SHALL be recursively redacted, URL credentials and secret query parameters SHALL be redacted in every string, and the configured access token SHALL never appear. Environment variable values are returned as received apart from access-token redaction. `docker_compose_raw` and `custom_docker_run_options` are returned as received apart from URL credential and access-token redaction; the rendered `docker_compose` SHALL be omitted. Runtime failures SHALL become explicit tool errors without exposing credentials.

#### Scenario: Safe response boundary

- **WHEN** a generated or wrapper handler receives a successful response containing a secret field
- **THEN** both structured and text content contain `[REDACTED]` instead of the secret value

#### Scenario: Environment values are returned verbatim

- **WHEN** an env tool receives environment variables, including ones with `is_shown_once: true`
- **THEN** both structured and text content contain the actual `value` and `real_value`

#### Scenario: Compose responses carry only the raw compose

- **WHEN** a service or application list or detail tool receives `docker_compose` and `docker_compose_raw`
- **THEN** the output omits the rendered `docker_compose` and returns `docker_compose_raw`, `command`, and `custom_docker_run_options` as received, apart from URL credential and access-token redaction

### Requirement: The runtime is local stdio only

The plugin SHALL launch only the `mcp.json` stdio command. It SHALL not add a remote MCP URL, OAuth transport, vault, or hosted server.
