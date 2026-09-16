---
title: Batch Operations Specification
version: 2.0.0
date: 2026-09-16
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Define the explicit `coolify_*` batch wrappers in `src/capabilities.ts`.

## Requirements

### Requirement: Batch wrappers return partial aggregate results

`coolify_restart_project_applications`, `coolify_bulk_update_application_env`, `coolify_stop_all_applications`, and `coolify_redeploy_project_applications` SHALL use `Promise.allSettled` for per-resource mutations and return `{ summary, succeeded, failed }`.

#### Scenario: Mixed mutation results

- **WHEN** one resource mutation fails
- **THEN** successful resources remain in `succeeded`, the failure is in `failed` with an error message, and the batch completes

### Requirement: Project restart and redeploy use generated operations

- **WHEN** a project UUID is supplied
- **THEN** the wrapper lists applications, filters `project_uuid`, and calls the generated restart or deploy operation for each match

### Requirement: Bulk env update uses only supported generated fields

- **WHEN** application UUIDs, `key`, and `value` are supplied
- **THEN** the wrapper sends only `{ key, value }` to the generated environment update schema
- **WHEN** the UUID list is empty
- **THEN** no provider request is made and the aggregate is empty

### Requirement: Emergency stop requires confirmation

- **WHEN** `confirm_stop_all_applications` is not literal `true`
- **THEN** the wrapper rejects the call before any provider request
- **WHEN** confirmation is true
- **THEN** only applications with running or healthy status are stopped
