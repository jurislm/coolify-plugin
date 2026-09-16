---
title: Database Backups Specification
version: 1.0.0
date: 2026-05-02
---

## Purpose

Define the MCP tool surface for managing database backup schedules and their execution history through the Coolify API.

## Requirements

### Requirement: The database_backups tool must support eight actions via a focused generated action parameter

The `database_backups` MCP tool MUST support: `list_schedules`, `get_schedule`, `list_executions`, `get_execution`, `delete_execution`, `create`, `update`, `delete`. All actions require `database_uuid`.

#### Scenario: List backup schedules

- **WHEN** a caller invokes `action: "list_schedules"` with a `database_uuid`
- **THEN** the client calls `GET /api/v1/databases/{database_uuid}/backups` and returns an array of `DatabaseBackup` objects

#### Scenario: Get a single backup schedule

- **WHEN** a caller invokes `action: "get_schedule"` with both `database_uuid` and `backup_uuid`
- **THEN** the client calls `GET /api/v1/databases/{database_uuid}/backups/{backup_uuid}` and returns the `DatabaseBackup`
- **WHEN** `backup_uuid` is omitted
- **THEN** the handler returns `"Error: backup_uuid required"` without calling the API

#### Scenario: List execution history for a backup schedule

- **WHEN** a caller invokes `action: "list_executions"` with `database_uuid` and `backup_uuid`
- **THEN** the client calls `GET /api/v1/databases/{database_uuid}/backups/{backup_uuid}/executions` and returns a `BackupExecution` array

#### Scenario: Get a single execution record

- **WHEN** a caller invokes `action: "get_execution"` with all three UUIDs (`database_uuid`, `backup_uuid`, `execution_uuid`)
- **THEN** the client calls `GET /api/v1/databases/{database_uuid}/backups/{backup_uuid}/executions/{execution_uuid}`
- **WHEN** either `backup_uuid` or `execution_uuid` is missing
- **THEN** the handler returns `"Error: backup_uuid, execution_uuid required"`

#### Scenario: Delete a backup execution record

- **WHEN** a caller invokes `action: "delete_execution"` with the three UUIDs
- **THEN** the client calls `DELETE /api/v1/databases/{database_uuid}/backups/{backup_uuid}/executions/{execution_uuid}`
- **WHEN** `delete_s3: true` is provided
- **THEN** the request body includes `{ "delete_s3": true }` to also remove the file from S3 storage

### Requirement: Backup schedule CRUD must map configuration fields to the Coolify API

#### Scenario: Create a backup schedule

- **WHEN** a caller invokes `action: "create"` with configuration fields (`frequency`, `save_s3`, `s3_storage_uuid`, `enabled`, retention fields, etc.)
- **THEN** the client calls `POST /api/v1/databases/{database_uuid}/backups` with the provided configuration and returns the created `DatabaseBackup`

#### Scenario: Update a backup schedule

- **WHEN** a caller invokes `action: "update"` with `backup_uuid` and one or more configuration fields
- **THEN** the client calls `PATCH /api/v1/databases/{database_uuid}/backups/{backup_uuid}` and returns a `MessageResponse`

#### Scenario: Delete a backup schedule

- **WHEN** a caller invokes `action: "delete"` with `backup_uuid`
- **THEN** the client calls `DELETE /api/v1/databases/{database_uuid}/backups/{backup_uuid}` and returns a `MessageResponse`
