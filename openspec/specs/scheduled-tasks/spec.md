---
title: Scheduled Tasks Specification
version: 1.0.0
date: 2026-05-02
---

> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.


## Purpose

Define the MCP tool surface for managing scheduled tasks (cron-style) attached to applications and services, including their execution history.

## Requirements

### Requirement: The scheduled_tasks tool must route all CRUD and execution-history actions to the correct resource sub-path

The `scheduled_tasks` MCP tool accepts a `resource_type` parameter (`application` or `service`) to determine the API sub-path. All actions require `resource_uuid`.

#### Scenario: List scheduled tasks for a resource

- **WHEN** a caller invokes `action: "list"` with `resource_type: "application"` and `resource_uuid`
- **THEN** the client calls `GET /api/v1/applications/{uuid}/scheduled-tasks` and returns a `ScheduledTask` array
- **WHEN** `resource_type` is `"service"`
- **THEN** the path becomes `/services/{uuid}/scheduled-tasks`

#### Scenario: Create a scheduled task

- **WHEN** a caller invokes `action: "create"` with `resource_type`, `resource_uuid`, and a `CreateScheduledTaskRequest` payload
- **THEN** the client calls `POST /api/v1/{resource_path}/{uuid}/scheduled-tasks` and returns the created `ScheduledTask`

#### Scenario: Update a scheduled task

- **WHEN** a caller invokes `action: "update"` with `resource_type`, `resource_uuid`, `task_uuid`, and an `UpdateScheduledTaskRequest` payload
- **THEN** the client calls `PATCH /api/v1/{resource_path}/{uuid}/scheduled-tasks/{task_uuid}` and returns the updated `ScheduledTask`

#### Scenario: Delete a scheduled task

- **WHEN** a caller invokes `action: "delete"` with `resource_type`, `resource_uuid`, and `task_uuid`
- **THEN** the client calls `DELETE /api/v1/{resource_path}/{uuid}/scheduled-tasks/{task_uuid}` and returns a `MessageResponse`

#### Scenario: List execution history for a scheduled task

- **WHEN** a caller invokes `action: "list_executions"` with `resource_type`, `resource_uuid`, and `task_uuid`
- **THEN** the client calls `GET /api/v1/{resource_path}/{uuid}/scheduled-tasks/{task_uuid}/executions` and returns a `ScheduledTaskExecution` array
