---
title: Batch Operation Coverage Specification
version: 2.0.0
date: 2026-09-16
---

> Current contract: use the generated `coolify_*` operations in `src/generated/operations.ts` and explicit wrappers registered with `registerTool` in `src/server.ts`; older action-oriented examples in this artifact are superseded. Executable checks live in Bun tests.


## Purpose

Specify local mocked-fetch coverage for the explicit batch wrappers in `src/capabilities.ts`.

## Requirements

The `src/server.test.ts` suite SHALL assert generated method/path/body behavior for `coolify_bulk_update_application_env`, `coolify_restart_project_applications`, `coolify_stop_all_applications`, and `coolify_redeploy_project_applications`, including invalid confirmation and partial mutation cases.

#### Scenario: Valid bulk environment update

- **WHEN** `coolify_bulk_update_application_env` receives application UUIDs, `key`, and `value`
- **THEN** it calls the generated environment update operation with only the supported body fields

#### Scenario: Valid project operations

- **WHEN** a project wrapper receives `project_uuid`
- **THEN** it lists applications, filters the project, and calls the matching generated restart or deploy operation
