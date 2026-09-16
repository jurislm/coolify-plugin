---
title: Tool Registry Specification
version: 2.0.0
date: 2026-09-16
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define the MCP surface produced by `@jurislm/coolify-plugin`: generated `coolify_*` tools from the pinned OpenAPI contract plus explicit v3.6 composite wrappers.

## Requirements

### Requirement: Generated operations are registered as focused tools

When `src/server.ts` creates an MCP server, it SHALL call `registerTool` once for every operation in `src/generated/operations.ts`. Every generated name SHALL start with `coolify_`, and the catalog SHALL match `api/manifest.json`.

#### Scenario: Register the generated contract

- **WHEN** a client calls `tools/list`
- **THEN** every generated operation is present with its generated input/output schema and HTTP annotations

### Requirement: v3.6 composite capabilities remain explicit

The server SHALL additionally register `coolify_get_mcp_version`, `coolify_get_infrastructure_overview`, `coolify_get_environment`, `coolify_diagnose_application`, `coolify_diagnose_server`, `coolify_find_issues`, `coolify_restart_project_applications`, `coolify_bulk_update_application_env`, `coolify_stop_all_applications`, `coolify_redeploy_project_applications`, and `coolify_docker_network_alias` from `src/capabilities.ts`.

#### Scenario: Register wrapper capabilities

- **WHEN** a client calls `tools/list`
- **THEN** all explicit wrapper names are present in addition to generated operations

### Requirement: Successful and failed calls have safe structured output

Every successful handler SHALL return a `ToolEnvelope`-shaped `structuredContent` and matching serialized text. Sensitive values SHALL be recursively redacted. Runtime failures SHALL become explicit tool errors without exposing credentials.

#### Scenario: Safe response boundary

- **WHEN** a generated or wrapper handler receives a successful response containing a secret field
- **THEN** both structured and text content contain `[REDACTED]` instead of the secret value

### Requirement: The runtime is local stdio only

The plugin SHALL launch only the `mcp.json` stdio command. It SHALL not add a remote MCP URL, OAuth transport, vault, or hosted server.
