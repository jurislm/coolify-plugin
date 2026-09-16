---
title: Storages Specification
version: 1.0.0
date: 2026-05-02
---

> Status: superseded source-history record; the requirements and scenarios below are non-normative. The current contract is generated `coolify_*` operations in `src/generated/operations.ts` plus explicit wrappers registered with `registerTool` in `src/server.ts`. Executable checks live in Bun tests.


## Purpose

Define the MCP tool surface for managing persistent volume mounts (local persistent volumes and local file volumes) attached to applications, databases, and services.

## Requirements

### Requirement: The storages tool must route list/create/update/delete to the correct resource type sub-path

The `storages` MCP tool accepts a `resource_type` parameter (`application`, `database`, or `service`) that determines which Coolify API sub-path is used. All actions require `resource_uuid`.

#### Scenario: List storages for a resource

- **WHEN** a caller invokes `action: "list"` with `resource_type: "application"` and `resource_uuid`
- **THEN** the client calls `GET /api/v1/applications/{uuid}/storages` and returns a `StorageListResponse`
- **WHEN** `resource_type` is `"database"` or `"service"`
- **THEN** the path becomes `/databases/{uuid}/storages` or `/services/{uuid}/storages` respectively

#### Scenario: Create a storage mount

- **WHEN** a caller invokes `action: "create"` with `resource_type`, `resource_uuid`, and a `CreateStorageRequest` payload
- **THEN** the client calls `POST /api/v1/{resource_type_path}/{uuid}/storages` and returns a `LocalPersistentVolume` or `LocalFileVolume`

#### Scenario: Update a storage mount

- **WHEN** a caller invokes `action: "update"` with `resource_type`, `resource_uuid`, and an `UpdateStorageRequest` payload
- **THEN** the client calls `PATCH /api/v1/{resource_type_path}/{uuid}/storages` and returns the updated volume

#### Scenario: Delete a storage mount

- **WHEN** a caller invokes `action: "delete"` with `resource_type`, `resource_uuid`, and `storage_uuid`
- **THEN** the client calls `DELETE /api/v1/{resource_type_path}/{uuid}/storages/{storage_uuid}` and returns a `MessageResponse`
